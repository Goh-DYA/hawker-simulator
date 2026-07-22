import {
  MAX_RECOVERY_GRANT_CENTS,
  createPeriodLedger,
  grantRecovery,
  recordLedgerEntry,
} from "./economy";
import { validatePlacement } from "./grid";
import { validateWorldNavigationAccess } from "./pathfinding";
import { asMoneyCents, type MoneyCents } from "./money";
import type { GameState, PlacedObject } from "./types";

export interface RecoveryReclaim {
  readonly object: PlacedObject;
  readonly purpose: "starter-stall" | "essential";
}

export interface RecoveryPolicyRequest {
  /** Stable id for one unresolved valid-setup episode. */
  readonly episodeId: string;
  /** Cash required to reach the independently validated playable setup. */
  readonly validSetupCostCents: MoneyCents;
  /** Starter/essential objects restored at zero purchase and zero resale value. */
  readonly reclaimed?: readonly RecoveryReclaim[];
  /** Caller-confirmed minimum setup criteria after applying the proposed reclaims. */
  readonly setupValidated?: boolean;
}

export interface RecoveryPolicyResult {
  readonly state: GameState;
  readonly grantedCents: MoneyCents;
  readonly remainingShortfallCents: MoneyCents;
  readonly reclaimedObjectIds: readonly string[];
  readonly alreadyResolved: boolean;
  readonly resolved: boolean;
}

/**
 * Advances one setup-recovery episode. The caller identifies a genuinely valid
 * setup shortfall; core enforces one cumulative S$650 grant, validates every
 * zero-value reclaim, and keeps the episode retryable until the resulting
 * minimum setup is explicitly validated and reachable.
 */
export function applyRecoveryPolicy(
  source: GameState,
  request: RecoveryPolicyRequest,
): RecoveryPolicyResult {
  const episodeId = request.episodeId.trim();
  if (!episodeId) throw new RangeError("Recovery episode id must not be empty");
  if (source.recovery.resolvedEpisodeIds.includes(episodeId)) {
    return {
      state: source,
      grantedCents: asMoneyCents(0),
      remainingShortfallCents: asMoneyCents(Math.max(
        0,
        request.validSetupCostCents - source.economy.cashCents,
      )),
      reclaimedObjectIds: [],
      alreadyResolved: true,
      resolved: true,
    };
  }

  const objects: Record<string, PlacedObject> = { ...source.objects };
  const queues: Record<string, readonly string[]> = { ...source.queues };
  const reclaimedObjectIds: string[] = [];
  for (const reclaim of request.reclaimed ?? []) {
    const object = reclaim.object;
    if (objects[object.id]) throw new RangeError(`Recovery object id already exists: ${object.id}`);
    const definition = source.catalog.placeables[object.definitionId];
    if (!definition) throw new RangeError(`Recovery definition does not exist: ${object.definitionId}`);
    if (reclaim.purpose === "starter-stall" && definition.kind !== "stall") {
      throw new RangeError("A starter-stall reclaim must use a stall definition");
    }
    if (reclaim.purpose === "essential" && definition.kind === "decoration") {
      throw new RangeError("A decorative object cannot be reclaimed as an essential");
    }
    const validation = validatePlacement(source.map, objects, source.catalog, object, {
      reservedPoints: [
        ...source.accessPoints.map((point) => point.position),
        ...source.routeGuidePoints,
      ],
    });
    if (!validation.valid) {
      throw new RangeError(`Recovery object ${object.id} is invalid: ${validation.reasons.join("; ")}`);
    }
    objects[object.id] = { ...object, open: definition.kind === "stall" ? object.open : false };
    if (definition.kind === "stall") queues[object.id] = [];
    reclaimedObjectIds.push(object.id);
  }

  const sequenceId = source.servicePeriod.sequenceId;
  let ledger = source.periodLedgers[sequenceId] ?? createPeriodLedger(
    sequenceId,
    source.economy.cashCents,
  );
  const alreadyGrantedCents = ledger.entries
    .filter((entry) => entry.kind === "recovery" && entry.referenceId === episodeId)
    .reduce((total, entry) => total + entry.amountCents, 0);
  const remainingAllowanceCents = Math.max(
    0,
    MAX_RECOVERY_GRANT_CENTS - alreadyGrantedCents,
  );
  const requestedShortfallCents = Math.max(
    0,
    request.validSetupCostCents - source.economy.cashCents,
  );
  const grantNowCents = Math.min(requestedShortfallCents, remainingAllowanceCents);
  const grant = grantRecovery(
    source.economy,
    asMoneyCents(source.economy.cashCents + grantNowCents),
  );
  const remainingShortfallCents = asMoneyCents(Math.max(
    0,
    request.validSetupCostCents - grant.economy.cashCents,
  ));
  if (grant.grantedCents > 0) {
    ledger = recordLedgerEntry(ledger, {
      id: `period-${sequenceId}-recovery-${episodeId}`,
      kind: "recovery",
      amountCents: grant.grantedCents,
      tick: source.tick,
      referenceId: episodeId,
    });
  }
  const setupReachable = validateWorldNavigationAccess(
    source.map,
    source.accessPoints,
    objects,
    source.catalog,
  ) === undefined;
  const resolved = request.setupValidated === true &&
    setupReachable &&
    remainingShortfallCents === 0;
  const event = {
    type: "recovery-granted" as const,
    tick: source.tick,
    entityId: episodeId,
    message: resolved
      ? "Validated the recovered minimum setup"
      : reclaimedObjectIds.length > 0
        ? `Recovered setup with ${reclaimedObjectIds.length} zero-value essential object(s)`
        : "Recovered valid-setup cash shortfall",
    amountCents: grant.grantedCents,
  };
  return {
    state: {
      ...source,
      objects,
      queues,
      economy: grant.economy,
      recovery: {
        resolvedEpisodeIds: resolved
          ? [...source.recovery.resolvedEpisodeIds, episodeId].sort()
          : source.recovery.resolvedEpisodeIds,
        zeroResaleObjectIds: [
          ...new Set([...source.recovery.zeroResaleObjectIds, ...reclaimedObjectIds]),
        ].sort(),
      },
      periodLedgers: { ...source.periodLedgers, [sequenceId]: ledger },
      events: [event],
    },
    grantedCents: grant.grantedCents,
    remainingShortfallCents,
    reclaimedObjectIds,
    alreadyResolved: false,
    resolved,
  };
}
