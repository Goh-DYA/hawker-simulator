/**
 * Pointer and keyboard interaction for the runtime: the interaction state, tile handling, the
 * tool, rotation and speed setters, hit-testing and placed-object IDs.
 *
 * Every function here reads only its arguments. The selection, pending move, queue draft,
 * access-point and speed state lives in one {@link InteractionState} that the composition root
 * creates once and never replaces, so its fields are always the live values. The handlers reach
 * the session state, catalog and side effects through an {@link InteractionContext}, whose
 * getters are called at each use, so a command run part-way through a handler is seen by the
 * reads after it.
 */
import {
  getObjectOccupiedTiles,
  getObjectQueueAnchor,
  type Customer,
  type GameCommand,
  type GameState,
  type GridPoint,
  type PlacedObject,
  type Rotation,
  type SimulationCatalog,
} from "@/src/game/core";
import { renderedCustomerPosition, type CustomerMovementState } from "./render/customers";
import type { BuildTool, GameSpeed, RuntimeEvent } from "./types";

/** The counters behind generated access-point and placed-object IDs. */
export interface IdSequences {
  /** Number used for the next `entrance-N` or `exit-N` access-point ID. */
  accessSequence: number;
  /** Lowest number tried for the next `placed-N` object ID. */
  objectSequence: number;
}

/** The build selection that a placement preview is made from. */
export interface PlacementSelection {
  /** Placeable definition chosen for the place tool, if any. */
  readonly selectedBuildId: string | undefined;
  /** Rotation the next placement uses. */
  readonly selectedRotation: Rotation;
}

/**
 * Resolves the customer occupying the grid tile where their avatar is rendered.
 *
 * @param customers - The customers to test.
 * @param point - The grid tile that was hit.
 * @param reducedMotion - Whether avatars are drawn without in-between movement.
 * @returns The hit customer with the lowest ID, or `undefined` when none is there.
 */
export function customerAtRenderedGridPoint<T extends CustomerMovementState>(
  customers: readonly T[],
  point: GridPoint,
  reducedMotion = false,
): T | undefined {
  return customers
    .filter((customer) => {
      const position = renderedCustomerPosition(customer, reducedMotion);
      return (
        Math.floor(position.x + 0.5) === point.x &&
        Math.floor(position.y + 0.5) === point.y
      );
    })
    .sort((left, right) => left.id.localeCompare(right.id))[0];
}

/**
 * Finds the placed object covering a tile, preferring the most recently placed one.
 *
 * @param state - The live game state.
 * @param catalog - The layered catalog, for footprints.
 * @param point - The grid tile that was hit.
 * @returns The topmost object on the tile, or `undefined` when the tile is empty.
 */
export function objectAt(
  state: GameState,
  catalog: SimulationCatalog,
  point: GridPoint,
): PlacedObject | undefined {
  return Object.values(state.objects)
    .reverse()
    .find((object) =>
      getObjectOccupiedTiles(object, catalog).some(
        (occupied) => occupied.x === point.x && occupied.y === point.y,
      ),
    );
}

/**
 * Finds the customer whose rendered avatar is on a tile.
 *
 * @param state - The live game state.
 * @param point - The grid tile that was hit.
 * @param reducedMotion - Whether avatars are drawn without in-between movement.
 * @returns The hit customer, or `undefined` when none is there.
 */
export function customerAt(
  state: GameState,
  point: GridPoint,
  reducedMotion: boolean,
): Customer | undefined {
  return customerAtRenderedGridPoint(
    Object.values(state.customers),
    point,
    reducedMotion,
  );
}

/**
 * Builds the preview object the place tool would put on a tile.
 *
 * @param selection - The selected build item and rotation.
 * @param point - The tile under the cursor.
 * @returns The preview object, or `undefined` when no build item is selected.
 */
export function placementCandidate(
  selection: PlacementSelection,
  point: GridPoint,
): PlacedObject | undefined {
  if (!selection.selectedBuildId) return undefined;
  return {
    id: "preview-placement",
    definitionId: selection.selectedBuildId,
    origin: point,
    rotation: selection.selectedRotation,
    open: false,
  };
}

/**
 * Takes the next free `placed-N` object ID, advancing the object sequence past it.
 *
 * @param state - The live game state, whose object IDs are skipped.
 * @param sequences - The ID counters; `objectSequence` is advanced.
 * @returns An object ID that no placed object uses.
 */
export function nextObjectId(state: GameState, sequences: IdSequences): string {
  let candidate = `placed-${sequences.objectSequence++}`;
  while (state.objects[candidate]) candidate = `placed-${sequences.objectSequence++}`;
  return candidate;
}

/**
 * Resets the object sequence to one past the highest `placed-N` ID in the state.
 *
 * @param state - The live game state.
 * @param sequences - The ID counters; only `objectSequence` changes.
 */
export function recomputeObjectSequence(state: GameState, sequences: IdSequences) {
  sequences.objectSequence =
    Math.max(
      0,
      ...Object.keys(state.objects).map((id) => {
        const match = /^placed-(\d+)$/.exec(id);
        return match ? Number(match[1]) : 0;
      }),
    ) + 1;
}

/**
 * The runtime's interaction state: the active tool, selections, pending edits, cursor, speed and
 * ID counters. Mutated in place by the handlers and the controller.
 */
export interface InteractionState extends IdSequences {
  /** The active build tool. */
  buildTool: BuildTool;
  /** Placeable definition chosen for the place tool, if any. */
  selectedBuildId: string | undefined;
  /** The selected placed object, if any. */
  selectedObjectId: string | undefined;
  /** The selected guest, if any. */
  selectedCustomerId: string | undefined;
  /** The object the move tool has picked up and is waiting to drop, if any. */
  pendingMoveId: string | undefined;
  /** The stall whose queue is being edited, if any. */
  queueEditingStallId: string | undefined;
  /** The queue path being edited, starting at the stall's anchor. */
  queueDraft: readonly GridPoint[];
  /** The selected entrance or exit, if any. */
  selectedAccessPointId: string | undefined;
  /** The access-point kind waiting for a boundary tile, if any. */
  pendingAccessKind: "entrance" | "exit" | undefined;
  /** Rotation the next placement uses. */
  selectedRotation: Rotation;
  /** The tile under the cursor or keyboard focus. */
  hoverTile: GridPoint;
  /** The simulation speed multiplier; 0 is paused. */
  speed: GameSpeed;
  /** The speed restored when leaving the access or route tool. */
  speedBeforeLayoutEdit: GameSpeed;
}

/**
 * What the interaction handlers need from the composition root. Call the getters at each use;
 * never keep their results, because a command replaces the state and catalog.
 */
export interface InteractionContext {
  /** Returns the live game state. */
  getSessionState(): GameState;
  /** Returns the live layered catalog. */
  getCatalog(): SimulationCatalog;
  /** Returns whether avatars are drawn without in-between movement. */
  isReducedMotion(): boolean;
  /** The interaction state, which the root never replaces. */
  readonly interaction: InteractionState;
  /** Runs a command with persistence, and reports whether it was accepted. */
  runCommand(command: GameCommand): boolean;
  /** Pushes a HUD snapshot immediately. */
  emitHud(): void;
  /** Redraws the scene immediately, when it exists. */
  render(): void;
  /** Reports a runtime event to the HUD. */
  emitEvent(event: RuntimeEvent): void;
}

/**
 * Creates the interaction state a new runtime starts with: the select tool, nothing selected,
 * normal speed, and ID counters seeded from the state's access points and objects.
 *
 * @param state - The game state the runtime starts from.
 * @returns A fresh interaction state.
 */
export function create_interaction_state(state: GameState): InteractionState {
  return {
    buildTool: "select",
    selectedBuildId: undefined,
    selectedObjectId: undefined,
    selectedCustomerId: undefined,
    pendingMoveId: undefined,
    queueEditingStallId: undefined,
    queueDraft: [],
    selectedAccessPointId: undefined,
    pendingAccessKind: undefined,
    selectedRotation: 0,
    hoverTile: { x: 6, y: 6 },
    speed: 1,
    speedBeforeLayoutEdit: 1,
    accessSequence: state.accessPoints.length + 1,
    objectSequence: Object.keys(state.objects).length + 1,
  };
}

/**
 * Applies the active tool to a tile: picks or places an access point, toggles a route tile,
 * shortens or extends the queue draft, places, removes or moves an object, or selects the guest
 * or object there.
 *
 * @param ctx - The live session and side effects.
 * @param point - The tile that was clicked or activated.
 */
export function handleTile(ctx: InteractionContext, point: GridPoint) {
  ctx.interaction.hoverTile = point;
  if (ctx.interaction.buildTool === "access") {
    const existing = ctx.getSessionState().accessPoints.find(
      (accessPoint) => accessPoint.position.x === point.x && accessPoint.position.y === point.y,
    );
    if (existing) {
      ctx.interaction.selectedAccessPointId = existing.id;
      ctx.interaction.pendingAccessKind = undefined;
      ctx.emitEvent({ kind: "info", message: `${existing.kind === "entrance" ? "Entrance" : "Exit"} selected. Choose a boundary tile to move it.` });
      ctx.emitHud();
      ctx.render();
      return;
    }
    if (ctx.interaction.pendingAccessKind) {
      const kind = ctx.interaction.pendingAccessKind;
      const id = `${kind}-${ctx.interaction.accessSequence++}`;
      if (ctx.runCommand({ type: "add-access-point", accessPoint: { id, kind, position: point } })) {
        ctx.interaction.selectedAccessPointId = id;
        ctx.interaction.pendingAccessKind = undefined;
      }
      return;
    }
    if (ctx.interaction.selectedAccessPointId) {
      ctx.runCommand({ type: "move-access-point", accessPointId: ctx.interaction.selectedAccessPointId, position: point });
      return;
    }
    ctx.emitEvent({ kind: "info", message: "Choose Add entrance or Add exit, or select an existing access point." });
    return;
  }
  if (ctx.interaction.buildTool === "route") {
    const key = `${point.x},${point.y}`;
    const route_guide_points = ctx.getSessionState().routeGuidePoints;
    const removing = route_guide_points.some(
      (candidate) => candidate.x === point.x && candidate.y === point.y,
    );
    const points = removing
      ? route_guide_points.filter((candidate) => `${candidate.x},${candidate.y}` !== key)
      : [...route_guide_points, point];
    if (ctx.runCommand({ type: "configure-guest-route", points })) {
      ctx.emitEvent({
        kind: "info",
        message: removing
          ? `Removed preferred route tile ${key}.`
          : `Added preferred route tile ${key}. Guests will favour this aisle.`,
      });
    }
    return;
  }
  if (ctx.interaction.buildTool === "queue") {
    const queueEditingStallId = ctx.interaction.queueEditingStallId;
    const stall = queueEditingStallId ? ctx.getSessionState().objects[queueEditingStallId] : undefined;
    const definition = stall ? ctx.getCatalog().placeables[stall.definitionId] : undefined;
    if (!stall || definition?.kind !== "stall" || !definition.stall) return;
    const anchor = getObjectQueueAnchor(stall, ctx.getCatalog());
    if (!anchor) return;
    const draft = ctx.interaction.queueDraft.length > 0 ? ctx.interaction.queueDraft : [anchor];
    const existingIndex = draft.findIndex(
      (candidate) => candidate.x === point.x && candidate.y === point.y,
    );
    if (existingIndex >= 0) {
      const trimmed = draft.slice(0, existingIndex + 1);
      if (trimmed.length === draft.length) return;
      if (ctx.runCommand({ type: "configure-queue", objectId: stall.id, points: trimmed })) {
        ctx.interaction.queueDraft = trimmed;
        ctx.emitEvent({ kind: "info", message: `Queue shortened to ${trimmed.length} spaces.` });
      }
      return;
    }
    const tail = draft.at(-1) as GridPoint;
    if (Math.abs(tail.x - point.x) + Math.abs(tail.y - point.y) !== 1) {
      ctx.emitEvent({ kind: "warning", message: "Add queue spaces one adjacent tile at a time." });
      return;
    }
    if (draft.length >= definition.stall.queueCapacity) {
      ctx.emitEvent({ kind: "warning", message: `This stall supports ${definition.stall.queueCapacity} queue spaces.` });
      return;
    }
    const extended = [...draft, point];
    if (ctx.runCommand({ type: "configure-queue", objectId: stall.id, points: extended })) {
      ctx.interaction.queueDraft = extended;
      ctx.emitEvent({ kind: "info", message: `Queue now bends through ${extended.length} spaces.` });
    }
    return;
  }
  if (ctx.interaction.buildTool === "place") {
    const selectedBuildId = ctx.interaction.selectedBuildId;
    if (!selectedBuildId) return;
    const accepted = ctx.runCommand({
      type: "place-object",
      objectId: nextObjectId(ctx.getSessionState(), ctx.interaction),
      definitionId: selectedBuildId,
      origin: point,
      rotation: ctx.interaction.selectedRotation,
    });
    if (accepted) ctx.emitEvent({ kind: "info", message: "Placed. You can undo or keep building." });
    return;
  }

  if (ctx.interaction.buildTool === "remove") {
    const object = objectAt(ctx.getSessionState(), ctx.getCatalog(), point);
    if (!object) return;
    ctx.runCommand({ type: "remove-object", objectId: object.id });
    ctx.interaction.selectedObjectId = undefined;
    return;
  }

  if (ctx.interaction.buildTool === "move") {
    const pendingMoveId = ctx.interaction.pendingMoveId;
    if (!pendingMoveId) {
      ctx.interaction.pendingMoveId = objectAt(ctx.getSessionState(), ctx.getCatalog(), point)?.id;
      ctx.interaction.selectedObjectId = ctx.interaction.pendingMoveId;
      if (ctx.interaction.pendingMoveId) ctx.emitEvent({ kind: "info", message: "Choose a clear destination tile." });
    } else if (
      ctx.runCommand({ type: "move-object", objectId: pendingMoveId, origin: point })
    ) {
      ctx.interaction.pendingMoveId = undefined;
      ctx.interaction.selectedObjectId = undefined;
    }
    return;
  }

  const customer = customerAt(ctx.getSessionState(), point, ctx.isReducedMotion());
  ctx.interaction.selectedCustomerId = customer?.id;
  ctx.interaction.selectedObjectId = customer
    ? undefined
    : objectAt(ctx.getSessionState(), ctx.getCatalog(), point)?.id;
  ctx.emitHud();
  ctx.render();
}

/**
 * Switches the build tool, clearing the selections the new tool does not use. Entering the
 * access or route tool pauses the simulation, and leaving them restores the earlier speed.
 *
 * @param ctx - The live session and side effects.
 * @param tool - The tool to switch to.
 */
export function setBuildTool(ctx: InteractionContext, tool: BuildTool) {
  const interaction = ctx.interaction;
  const editingLayout = interaction.buildTool === "access" || interaction.buildTool === "route";
  const willEditLayout = tool === "access" || tool === "route";
  if (willEditLayout && !editingLayout) {
    interaction.speedBeforeLayoutEdit = interaction.speed === 0 ? 1 : interaction.speed;
    interaction.speed = 0;
  }
  interaction.buildTool = tool;
  if (tool !== "move") interaction.pendingMoveId = undefined;
  if (tool !== "place") interaction.selectedBuildId = undefined;
  if (tool !== "queue") {
    interaction.queueEditingStallId = undefined;
    interaction.queueDraft = [];
  }
  if (tool !== "queue") interaction.selectedObjectId = undefined;
  if (tool !== "access") {
    interaction.selectedAccessPointId = undefined;
    interaction.pendingAccessKind = undefined;
  }
  if (editingLayout && !willEditLayout) interaction.speed = interaction.speedBeforeLayoutEdit;
  ctx.emitHud();
  ctx.render();
}

/**
 * Rotates the selected object through a command, or, with nothing selected, turns the rotation
 * the next placement uses by 90 degrees.
 *
 * @param ctx - The live session and side effects.
 */
export function rotateSelection(ctx: InteractionContext) {
  const selectedObjectId = ctx.interaction.selectedObjectId;
  if (selectedObjectId) {
    ctx.runCommand({ type: "rotate-object", objectId: selectedObjectId });
    return;
  }
  ctx.interaction.selectedRotation = ((ctx.interaction.selectedRotation + 90) % 360) as Rotation;
  ctx.render();
}

/**
 * Sets the simulation speed and pushes the HUD.
 *
 * @param ctx - The live session and side effects.
 * @param next - The new speed multiplier; 0 pauses.
 */
export function setSpeed(ctx: InteractionContext, next: GameSpeed) {
  ctx.interaction.speed = next;
  ctx.emitHud();
}
