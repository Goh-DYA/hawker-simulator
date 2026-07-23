import { compareIds } from "./ordering";

export const MAX_PARTY_SIZE = 6;
export const MAX_PARTY_STALL_STOPS = 2;
export const PARTY_SPLIT_PATIENCE_RATIO = 0.4;

export interface PartyMemberRequest {
  readonly memberId: string;
  readonly budgetCents: number;
  /** Frozen visit needs sampled independently for this member. */
  readonly visitNeedIds: readonly string[];
  /** Dish IDs in the member's deterministic preference order. */
  readonly preferredDishIds: readonly string[];
}

export interface PartyDishOption {
  readonly dishId: string;
  readonly stallId: string;
  /** One or two actual serving stops; omitted for a single-dish option. */
  readonly stallIds?: readonly string[];
  readonly priceCents: number;
  readonly available: boolean;
  /** Restricts a member-specific Combo Board candidate to its owner. */
  readonly memberId?: string;
  readonly mealOfferId?: string;
  readonly preparationIds?: readonly [string, string];
  /** Higher values win before price when preference rank is otherwise equal. */
  readonly preferencePriority?: number;
}

export interface PlannedPartyOrder {
  readonly memberId: string;
  readonly visitNeedIds: readonly string[];
  readonly dishId: string;
  readonly stallId: string;
  readonly stallIds?: readonly string[];
  readonly priceCents: number;
  readonly mealOfferId?: string;
  readonly preparationIds?: readonly [string, string];
}

export type PartyOrderPlan =
  | {
      readonly accepted: true;
      readonly strategy: "joint-two-stop" | "single-stall-fallback";
      readonly stallIds: readonly string[];
      readonly orders: readonly PlannedPartyOrder[];
    }
  | {
      readonly accepted: false;
      readonly strategy: "none";
      readonly reason:
        | "invalid-party"
        | "invalid-options"
        | "no-atomic-plan";
      readonly stallIds: readonly [];
      readonly orders: readonly [];
    };

interface CandidateOrder extends PlannedPartyOrder {
  readonly preferenceRank: number;
  readonly preferred: boolean;
  readonly preferencePriority: number;
}

interface CompletePlan {
  readonly orders: readonly CandidateOrder[];
  readonly stallIds: readonly string[];
  readonly unpreferredCount: number;
  readonly preferenceScore: number;
  readonly preferencePriority: number;
  readonly totalPriceCents: number;
}

function isCanonicalId(value: string): boolean {
  return value.length > 0 && value.trim() === value;
}

function hasUniqueCanonicalIds(values: readonly string[]): boolean {
  const ids = new Set<string>();
  for (const value of values) {
    if (!isCanonicalId(value) || ids.has(value)) return false;
    ids.add(value);
  }
  return true;
}

function validatePartyMembers(
  members: readonly PartyMemberRequest[],
): boolean {
  if (members.length === 0 || members.length > MAX_PARTY_SIZE) return false;
  const ids = new Set<string>();
  for (const member of members) {
    if (
      !isCanonicalId(member.memberId) ||
      ids.has(member.memberId) ||
      !Number.isSafeInteger(member.budgetCents) ||
      member.budgetCents <= 0 ||
      member.preferredDishIds.length === 0 ||
      !hasUniqueCanonicalIds(member.preferredDishIds) ||
      !hasUniqueCanonicalIds(member.visitNeedIds)
    ) {
      return false;
    }
    ids.add(member.memberId);
  }
  return true;
}

function normalizePartyOptions(
  options: readonly PartyDishOption[],
): readonly PartyDishOption[] | undefined {
  const byDishAndStall = new Map<string, PartyDishOption>();
  for (const option of options) {
    if (
      !isCanonicalId(option.dishId) ||
      !isCanonicalId(option.stallId) ||
      (
        option.memberId !== undefined &&
        !isCanonicalId(option.memberId)
      ) ||
      !Number.isSafeInteger(option.priceCents) ||
      option.priceCents <= 0 ||
      (
        option.preferencePriority !== undefined &&
        (
          !Number.isSafeInteger(option.preferencePriority) ||
          option.preferencePriority < 0
        )
      )
    ) {
      return undefined;
    }
    const stallIds = option.stallIds ?? [option.stallId];
    const comboFields = [
      option.mealOfferId !== undefined,
      option.preparationIds !== undefined,
    ];
    if (
      stallIds.length < 1 ||
      stallIds.length > MAX_PARTY_STALL_STOPS ||
      !hasUniqueCanonicalIds(stallIds) ||
      stallIds[0] !== option.stallId ||
      comboFields.some(Boolean) !== comboFields.every(Boolean) ||
      (
        option.mealOfferId !== undefined &&
        (
          !isCanonicalId(option.mealOfferId) ||
          option.preparationIds?.length !== 2 ||
          !hasUniqueCanonicalIds(option.preparationIds ?? [])
        )
      )
    ) {
      return undefined;
    }
    const normalizedOption = {
      ...option,
      stallIds: [...stallIds],
      preparationIds: option.preparationIds
        ? [...option.preparationIds] as [string, string]
        : undefined,
    };
    const key = [
      option.memberId ?? "*",
      option.dishId,
      stallIds.join("|"),
      option.mealOfferId ?? "single",
    ].join("\u0000");
    const existing = byDishAndStall.get(key);
    if (
      existing &&
      (
        existing.priceCents !== option.priceCents ||
        existing.available !== option.available ||
        existing.preferencePriority !== option.preferencePriority ||
        existing.preparationIds?.join("|") !== option.preparationIds?.join("|")
      )
    ) {
      // Conflicting serving terms cannot be frozen deterministically.
      return undefined;
    }
    byDishAndStall.set(key, normalizedOption);
  }
  return [...byDishAndStall.values()].sort(
    (left, right) =>
      compareIds(left.stallId, right.stallId) ||
      compareIds(left.dishId, right.dishId) ||
      compareIds(left.memberId ?? "", right.memberId ?? "") ||
      compareIds(left.mealOfferId ?? "", right.mealOfferId ?? "") ||
      left.priceCents - right.priceCents,
  );
}

function preferenceRanks(
  preferredDishIds: readonly string[],
): ReadonlyMap<string, number> {
  return new Map(
    preferredDishIds.map((dishId, index) => [dishId, index]),
  );
}

function candidateOrders(
  member: PartyMemberRequest,
  options: readonly PartyDishOption[],
  serviceOrder: readonly string[],
): readonly CandidateOrder[] {
  const ranks = preferenceRanks(member.preferredDishIds);
  const allowedStalls = new Set(serviceOrder);
  return options
    .filter(
      (option) => {
        const stallIds = option.stallIds ?? [option.stallId];
        return (
          option.available &&
          option.priceCents <= member.budgetCents &&
          (option.memberId === undefined ||
            option.memberId === member.memberId) &&
          stallIds.every((stallId) => allowedStalls.has(stallId)) &&
          stallIds.every(
            (stallId, index) =>
              index === 0 ||
              serviceOrder.indexOf(stallIds[index - 1]!) <
                serviceOrder.indexOf(stallId),
          )
        );
      },
    )
    .map((option) => {
      const preferenceRank = ranks.get(option.dishId);
      const preferencePriority = option.preferencePriority ?? 0;
      return {
        memberId: member.memberId,
        visitNeedIds: [...member.visitNeedIds],
        dishId: option.dishId,
        stallId: option.stallId,
        stallIds: [...(option.stallIds ?? [option.stallId])],
        priceCents: option.priceCents,
        mealOfferId: option.mealOfferId,
        preparationIds: option.preparationIds
          ? [...option.preparationIds] as [string, string]
          : undefined,
        preferenceRank:
          preferencePriority > 0
            ? 0
            : preferenceRank ?? member.preferredDishIds.length,
        preferred: preferencePriority > 0 || preferenceRank !== undefined,
        preferencePriority,
      };
    })
    .sort(
      (left, right) =>
        Number(right.preferred) - Number(left.preferred) ||
        left.preferenceRank - right.preferenceRank ||
        right.preferencePriority - left.preferencePriority ||
        left.priceCents - right.priceCents ||
        compareIds(left.dishId, right.dishId) ||
        compareIds(left.stallId, right.stallId),
    );
}

function planForStalls(
  members: readonly PartyMemberRequest[],
  options: readonly PartyDishOption[],
  serviceOrder: readonly string[],
): CompletePlan | undefined {
  const orders: CandidateOrder[] = [];
  for (const member of members) {
    const selected = candidateOrders(member, options, serviceOrder)[0];
    if (!selected) return undefined;
    orders.push(selected);
  }
  const usedStalls = new Set(
    orders.flatMap((order) => order.stallIds ?? [order.stallId]),
  );
  const stallIds = serviceOrder.filter((stallId) =>
    usedStalls.has(stallId)
  );
  if (stallIds.length > MAX_PARTY_STALL_STOPS) return undefined;
  return {
    orders,
    stallIds,
    unpreferredCount: orders.filter((order) => !order.preferred).length,
    preferenceScore: orders.reduce(
      (total, order) => total + order.preferenceRank,
      0,
    ),
    preferencePriority: orders.reduce(
      (total, order) => total + order.preferencePriority,
      0,
    ),
    totalPriceCents: orders.reduce(
      (total, order) => total + order.priceCents,
      0,
    ),
  };
}

function comparePlans(left: CompletePlan, right: CompletePlan): number {
  return (
    left.unpreferredCount - right.unpreferredCount ||
    left.preferenceScore - right.preferenceScore ||
    right.preferencePriority - left.preferencePriority ||
    left.stallIds.length - right.stallIds.length ||
    left.totalPriceCents - right.totalPriceCents ||
    compareIds(left.stallIds.join("|"), right.stallIds.join("|")) ||
    compareIds(
      left.orders
        .map((order) => `${order.memberId}:${order.dishId}:${order.stallId}`)
        .join("|"),
      right.orders
        .map((order) => `${order.memberId}:${order.dishId}:${order.stallId}`)
        .join("|"),
    )
  );
}

function rejectedPlan(
  reason: Extract<PartyOrderPlan, { accepted: false }>["reason"],
): PartyOrderPlan {
  return {
    accepted: false,
    strategy: "none",
    reason,
    stallIds: [],
    orders: [],
  };
}

/**
 * Plans the whole party as one transaction. The result is stable under member
 * and option reordering, and no partial list is returned when any member cannot
 * be served within budget.
 */
export function planPartyOrders(
  members: readonly PartyMemberRequest[],
  sourceOptions: readonly PartyDishOption[],
): PartyOrderPlan {
  if (!validatePartyMembers(members)) {
    return rejectedPlan("invalid-party");
  }
  const options = normalizePartyOptions(sourceOptions);
  if (!options) return rejectedPlan("invalid-options");

  const orderedMembers = [...members].sort((left, right) =>
    compareIds(left.memberId, right.memberId),
  );
  const stalls = [
    ...new Set(
      options
        .filter((option) => option.available)
        .flatMap((option) => option.stallIds ?? [option.stallId]),
    ),
  ].sort(compareIds);

  const plans: CompletePlan[] = [];
  for (const stallId of stalls) {
    const plan = planForStalls(orderedMembers, options, [stallId]);
    if (plan) plans.push(plan);
  }
  for (let first = 0; first < stalls.length; first += 1) {
    for (let second = first + 1; second < stalls.length; second += 1) {
      const plan = planForStalls(orderedMembers, options, [
        stalls[first] as string,
        stalls[second] as string,
      ]);
      if (plan?.stallIds.length === MAX_PARTY_STALL_STOPS) plans.push(plan);
      const reversePlan = planForStalls(orderedMembers, options, [
        stalls[second] as string,
        stalls[first] as string,
      ]);
      if (reversePlan?.stallIds.length === MAX_PARTY_STALL_STOPS) {
        plans.push(reversePlan);
      }
    }
  }

  const selected = plans.sort(comparePlans)[0];
  if (!selected) return rejectedPlan("no-atomic-plan");
  return {
    accepted: true,
    strategy: selected.stallIds.length === MAX_PARTY_STALL_STOPS
      ? "joint-two-stop"
      : "single-stall-fallback",
    stallIds: selected.stallIds,
    orders: selected.orders.map(
      ({ preferenceRank, preferred, preferencePriority, ...order }) => {
        void preferenceRank;
        void preferred;
        void preferencePriority;
        return order;
      },
    ),
  };
}

export interface SeatCluster {
  readonly clusterId: string;
  readonly tableId: string;
  readonly availableSeatIds: readonly string[];
  /** Upstream pathfinding marks false when the party cannot reach this table. */
  readonly reachable?: boolean;
  /** Accessible seats are a subset of availableSeatIds. */
  readonly accessibleSeatIds?: readonly string[];
  /**
   * When supplied by production pathfinding, split seating may use only these
   * genuinely reachable adjacent clusters rather than geometric proximity.
   */
  readonly adjacentClusterIds?: readonly string[];
  /** Aggregate non-accessibility preference cost for the whole party. */
  readonly preferenceScore?: number;
  readonly centre: {
    readonly x: number;
    readonly y: number;
  };
}

export interface PartySeatAssignment {
  readonly kind: "atomic" | "adjacent-split";
  readonly explanationCode:
    | "party-seated-together"
    | "party-split-after-patience-threshold";
  readonly clusterIds: readonly string[];
  readonly tableIds: readonly string[];
  readonly seatIds: readonly string[];
}

export interface PartyPosition {
  readonly x: number;
  readonly y: number;
}

export function shouldAllowPartySplit(
  elapsedPatienceMs: number,
  totalPatienceMs: number,
): boolean {
  if (
    !Number.isFinite(elapsedPatienceMs) ||
    !Number.isFinite(totalPatienceMs) ||
    elapsedPatienceMs < 0 ||
    totalPatienceMs <= 0
  ) {
    return false;
  }
  return elapsedPatienceMs / totalPatienceMs >= PARTY_SPLIT_PATIENCE_RATIO;
}

function pointDistance(left: PartyPosition, right: PartyPosition): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function clusterDistance(left: SeatCluster, right: SeatCluster): number {
  return pointDistance(left.centre, right.centre);
}

function normalizedClusters(
  clusters: readonly SeatCluster[],
): readonly SeatCluster[] | undefined {
  const clusterIds = new Set<string>();
  const seatIds = new Set<string>();
  const normalized: SeatCluster[] = [];
  for (const cluster of clusters) {
    if (
      !isCanonicalId(cluster.clusterId) ||
      clusterIds.has(cluster.clusterId) ||
      !isCanonicalId(cluster.tableId) ||
      !Number.isFinite(cluster.centre.x) ||
      !Number.isFinite(cluster.centre.y) ||
      (
        cluster.reachable !== undefined &&
        typeof cluster.reachable !== "boolean"
      ) ||
      (
        cluster.preferenceScore !== undefined &&
        (
          !Number.isFinite(cluster.preferenceScore) ||
          cluster.preferenceScore < 0
        )
      ) ||
      !hasUniqueCanonicalIds(cluster.availableSeatIds) ||
      !hasUniqueCanonicalIds(cluster.accessibleSeatIds ?? []) ||
      !hasUniqueCanonicalIds(cluster.adjacentClusterIds ?? [])
    ) {
      return undefined;
    }
    const availableSeatIdSet = new Set(cluster.availableSeatIds);
    if (
      (cluster.accessibleSeatIds ?? []).some(
        (seatId) => !availableSeatIdSet.has(seatId),
      )
    ) {
      return undefined;
    }
    for (const seatId of cluster.availableSeatIds) {
      if (seatIds.has(seatId)) return undefined;
      seatIds.add(seatId);
    }
    clusterIds.add(cluster.clusterId);
    if (cluster.reachable === false) continue;
    normalized.push({
      ...cluster,
      centre: { ...cluster.centre },
      availableSeatIds: [...cluster.availableSeatIds].sort(compareIds),
      accessibleSeatIds: [...(cluster.accessibleSeatIds ?? [])].sort(
        compareIds,
      ),
      adjacentClusterIds: cluster.adjacentClusterIds
        ? [...cluster.adjacentClusterIds].sort(compareIds)
        : undefined,
    });
  }
  return normalized.sort((left, right) =>
    compareIds(left.clusterId, right.clusterId),
  );
}

function distanceFromParty(
  cluster: SeatCluster,
  partyPosition?: PartyPosition,
): number {
  return partyPosition === undefined
    ? 0
    : pointDistance(cluster.centre, partyPosition);
}

function accessibleSeatCount(clusters: readonly SeatCluster[]): number {
  return new Set(
    clusters.flatMap((cluster) => cluster.accessibleSeatIds ?? []),
  ).size;
}

function selectSeats(
  clusters: readonly SeatCluster[],
  partySize: number,
  requiredAccessibleSeats: number,
): readonly string[] | undefined {
  const accessible = [
    ...new Set(
      clusters.flatMap((cluster) => cluster.accessibleSeatIds ?? []),
    ),
  ].sort(compareIds);
  if (accessible.length < requiredAccessibleSeats) return undefined;
  const selectedAccessible = accessible.slice(0, requiredAccessibleSeats);
  const selectedAccessibleSet = new Set(selectedAccessible);
  const remaining = [
    ...new Set(clusters.flatMap((cluster) => cluster.availableSeatIds)),
  ]
    .filter((seatId) => !selectedAccessibleSet.has(seatId))
    .sort(compareIds);
  const seatIds = [
    ...selectedAccessible,
    ...remaining.slice(0, partySize - selectedAccessible.length),
  ];
  return seatIds.length === partySize ? seatIds : undefined;
}

/**
 * Selects one suitable cluster first, then the nearest valid adjacent pair
 * after 40% of patience is consumed. Seat IDs and tie-breaks are canonical so
 * input array ordering cannot alter the reservation.
 */
export function findPartySeatAssignment(
  partySize: number,
  sourceClusters: readonly SeatCluster[],
  elapsedPatienceMs: number,
  totalPatienceMs: number,
  maxAdjacentDistance = 4,
  partyPosition?: PartyPosition,
  requiredAccessibleSeats = 0,
): PartySeatAssignment | undefined {
  if (
    !Number.isSafeInteger(partySize) ||
    partySize < 1 ||
    partySize > MAX_PARTY_SIZE ||
    !Number.isSafeInteger(requiredAccessibleSeats) ||
    requiredAccessibleSeats < 0 ||
    requiredAccessibleSeats > partySize ||
    !Number.isFinite(maxAdjacentDistance) ||
    maxAdjacentDistance < 0 ||
    (
      partyPosition !== undefined &&
      (
        !Number.isFinite(partyPosition.x) ||
        !Number.isFinite(partyPosition.y)
      )
    )
  ) {
    return undefined;
  }
  const clusters = normalizedClusters(sourceClusters);
  if (!clusters) return undefined;

  const atomic = clusters
    .filter(
      (cluster) =>
        cluster.availableSeatIds.length >= partySize &&
        accessibleSeatCount([cluster]) >= requiredAccessibleSeats,
    )
    .sort(
      (left, right) =>
        left.availableSeatIds.length - right.availableSeatIds.length ||
        (left.preferenceScore ?? 0) - (right.preferenceScore ?? 0) ||
        distanceFromParty(left, partyPosition) -
          distanceFromParty(right, partyPosition) ||
        compareIds(left.clusterId, right.clusterId),
    )[0];
  if (atomic) {
    const seatIds = selectSeats(
      [atomic],
      partySize,
      requiredAccessibleSeats,
    );
    if (!seatIds) return undefined;
    return {
      kind: "atomic",
      explanationCode: "party-seated-together",
      clusterIds: [atomic.clusterId],
      tableIds: [atomic.tableId],
      seatIds,
    };
  }
  if (!shouldAllowPartySplit(elapsedPatienceMs, totalPatienceMs)) {
    return undefined;
  }

  const candidates: Array<{
    readonly left: SeatCluster;
    readonly right: SeatCluster;
    readonly adjacencyDistance: number;
    readonly partyDistance: number;
    readonly spareSeats: number;
    readonly preferenceScore: number;
  }> = [];
  for (let leftIndex = 0; leftIndex < clusters.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < clusters.length;
      rightIndex += 1
    ) {
      const left = clusters[leftIndex] as SeatCluster;
      const right = clusters[rightIndex] as SeatCluster;
      if (left.tableId === right.tableId) continue;
      const leftAdjacency = left.adjacentClusterIds;
      const rightAdjacency = right.adjacentClusterIds;
      if (
        (leftAdjacency !== undefined || rightAdjacency !== undefined) &&
        (
          !leftAdjacency?.includes(right.clusterId) ||
          !rightAdjacency?.includes(left.clusterId)
        )
      ) {
        continue;
      }
      const adjacencyDistance = clusterDistance(left, right);
      const capacity =
        left.availableSeatIds.length + right.availableSeatIds.length;
      if (
        capacity >= partySize &&
        accessibleSeatCount([left, right]) >= requiredAccessibleSeats &&
        adjacencyDistance <= maxAdjacentDistance
      ) {
        candidates.push({
          left,
          right,
          adjacencyDistance,
          partyDistance:
            distanceFromParty(left, partyPosition) +
            distanceFromParty(right, partyPosition),
          spareSeats: capacity - partySize,
          preferenceScore:
            (left.preferenceScore ?? 0) + (right.preferenceScore ?? 0),
        });
      }
    }
  }
  const selected = candidates.sort(
    (left, right) =>
      left.adjacencyDistance - right.adjacencyDistance ||
      left.preferenceScore - right.preferenceScore ||
      left.partyDistance - right.partyDistance ||
      left.spareSeats - right.spareSeats ||
      compareIds(
        `${left.left.clusterId}|${left.right.clusterId}`,
        `${right.left.clusterId}|${right.right.clusterId}`,
      ),
  )[0];
  if (!selected) return undefined;
  const seatIds = selectSeats(
    [selected.left, selected.right],
    partySize,
    requiredAccessibleSeats,
  );
  if (!seatIds) return undefined;
  return {
    kind: "adjacent-split",
    explanationCode: "party-split-after-patience-threshold",
    clusterIds: [selected.left.clusterId, selected.right.clusterId],
    tableIds: [selected.left.tableId, selected.right.tableId],
    seatIds,
  };
}

export type PartySeatReservationResult =
  | {
      readonly accepted: true;
      readonly reservations: Readonly<Record<string, string>>;
    }
  | {
      readonly accepted: false;
      readonly reason: "invalid-reservation" | "seat-unavailable";
      /** Same object reference as the input; no partial write occurred. */
      readonly reservations: Readonly<Record<string, string>>;
    };

/**
 * Reserves every selected seat for one visible party or writes none of them.
 */
export function reservePartySeatsAtomically(
  currentReservations: Readonly<Record<string, string>>,
  partyId: string,
  assignment: PartySeatAssignment,
): PartySeatReservationResult {
  if (
    !isCanonicalId(partyId) ||
    assignment.seatIds.length === 0 ||
    !hasUniqueCanonicalIds(assignment.seatIds)
  ) {
    return {
      accepted: false,
      reason: "invalid-reservation",
      reservations: currentReservations,
    };
  }
  if (
    assignment.seatIds.some(
      (seatId) => Object.hasOwn(currentReservations, seatId),
    )
  ) {
    return {
      accepted: false,
      reason: "seat-unavailable",
      reservations: currentReservations,
    };
  }
  const reservations = { ...currentReservations };
  for (const seatId of [...assignment.seatIds].sort(compareIds)) {
    reservations[seatId] = partyId;
  }
  return { accepted: true, reservations };
}
