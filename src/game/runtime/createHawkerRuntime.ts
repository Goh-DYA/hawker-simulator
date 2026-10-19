/**
 * The runtime composition root: loads the save, builds the session and interaction state,
 * boots Phaser with the world scene, runs the per-frame simulation step and HUD pushes, and
 * returns the `RuntimeController` the UI drives.
 *
 * Phaser is loaded with a dynamic `import()` when the runtime is created.
 */
import type Phaser from "phaser";
import { DISH_BY_ID, STALLS, getNutritionVariantFamily } from "@/src/content";
import { has_dev_query_flag, IS_PRODUCTION_BUILD } from "@/src/config/env";
import {
  advanceSimulation,
  createSnapshot,
  getObjectQueueAnchor,
  xpRequiredForLevel,
  type GameCommand,
} from "@/src/game/core";
import type { RuntimeController, RuntimeOptions } from "./types";
import { buildCatalog, effectiveCatalog, localized } from "./catalog";
import { MAP_EXPANSION } from "./rules";
import { formatSimulationEvent } from "./activityFeed";
import {
  compute_menu_slots,
  isDishIdUnlockedForMenu,
  stallMenuProgression,
} from "./stallMenus";
import { compute_dish_mastery_rank, nutritionVisualKeyForVariant } from "./nutrition";
import { visualRecipeForDishVariant } from "./visuals/dish";
import { placeable_spec, stall_spec } from "./render/world";
import { load_runtime_save, type LoadedRuntimeSave } from "./saves";
import type { LabelSink, OverlayContext } from "./render/context";
import {
  create_interaction_state,
  handleTile,
  placementCandidate,
  recomputeObjectSequence,
  rotateSelection,
  setBuildTool,
  setSpeed,
  type InteractionContext,
} from "./interaction";
import {
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  create_game,
  create_scene_class,
  LOWER_END_FPS_LIMIT,
  STANDARD_FPS_LIMIT,
  type HawkerSceneHandle,
} from "./render/scene";
import {
  adopt_session,
  apply_catalog_layers,
  build_persistent_payload,
  create_runtime_session,
  dispatch_session_command,
  synchronize_stall_menus,
} from "./session";
import { build_runtime_snapshot, isCentreOpen } from "./snapshot";
import {
  create_fresh_session,
  reconcileRuntimeUnlocks,
  TILE_SIZE,
  type FreshSession,
} from "./world";

// Re-exported so existing importers of the save shape keep importing it from the runtime root.
export type { RuntimePersistentState } from "./saves";
// Re-exported so existing importers of the hit test keep importing it from the runtime root.
export { customerAtRenderedGridPoint } from "./interaction";

/** Shortest gap between two routine HUD snapshot pushes. */
const HUD_INTERVAL_MS = 220;
/** Gap between periodic autosaves while the simulation is running. */
const PERIODIC_SAVE_INTERVAL_MS = 15_000;

/**
 * Creates the hawker centre runtime inside a parent element.
 *
 * The first save candidate that loads wins; when a later candidate is used, a backup-restored
 * warning is emitted, and when none loads, the centre starts fresh with a recovery warning. The
 * controller is returned before the Phaser scene boots (see {@link RuntimeController}).
 *
 * @param options - The parent element, settings, save candidates and callbacks.
 * @returns The controller for the new runtime.
 */
export async function createHawkerRuntime(
  options: RuntimeOptions,
): Promise<RuntimeController> {
  const PhaserRuntime = (await import("phaser")).default;
  const { catalog: authoredCatalog, visuals } = buildCatalog();
  let recoveredNutritionSelection = false;
  let initial_session: FreshSession | LoadedRuntimeSave;
  try {
    const candidates = options.initialStates ?? [];
    let loaded: LoadedRuntimeSave | undefined;
    let lastLoadError: unknown;
    for (let index = 0; index < candidates.length; index += 1) {
      try {
        loaded = load_runtime_save(candidates[index], authoredCatalog);
        recoveredNutritionSelection = recoveredNutritionSelection || loaded.isRecovered;
        if (index > 0) {
          options.onEvent({
            kind: "warning",
            message: "The newest save was damaged; the automatic backup was restored.",
          });
        }
        break;
      } catch (error) {
        console.warn("[runtime] discarded save candidate", index, error);
        lastLoadError = error;
      }
    }
    if (!loaded && candidates.length > 0) throw lastLoadError;
    initial_session = loaded ?? create_fresh_session(authoredCatalog, options.createWorldSeed?.());
  } catch (error) {
    console.warn("[runtime] save recovered as new centre", error);
    options.onEvent({
      kind: "warning",
      message: `The previous save was recovered as a new centre: ${error instanceof Error ? error.message : "unknown save error"}`,
    });
    initial_session = create_fresh_session(authoredCatalog, options.createWorldSeed?.());
  }
  // Created once and never replaced: the session functions mutate its fields in place.
  const session = create_runtime_session(authoredCatalog, visuals, initial_session);

  if (recoveredNutritionSelection) {
    options.onEvent({
      kind: "warning",
      message: "One or more saved recipe choices were reset to reviewed defaults.",
    });
  }

  // The leading constant lets Vite drop this developer-only branch from production. Turbopack
  // (build:vercel) keeps the text, but it cannot run there: IS_PRODUCTION_BUILD is true and the
  // flag reads false.
  if (!IS_PRODUCTION_BUILD && has_dev_query_flag("visualQa")) {
    session.state = {
      ...session.state,
      economy: { ...session.state.economy, currency: 100_000 },
      progression: {
        ...session.state.progression,
        xp: xpRequiredForLevel(12),
        level: 12,
        reputation: 5,
        peakReputation: 5,
        unlockedDefinitionIds: Object.keys(session.catalog.placeables).sort(),
      },
    };
  }

  const runtime = { game: undefined as Phaser.Game | undefined };
  let activeScene: HawkerSceneHandle | undefined;
  // Created once and never replaced: the handlers and the controller mutate its fields in place.
  const interaction = create_interaction_state(session.state);
  let qualityMode = options.settings.quality;
  let reducedMotion = options.settings.reducedMotion;
  let highContrast = options.settings.highContrast;
  let debugOverlay = false;
  let lastHudAt = 0;
  session.lastPersistentRevenue = session.state.economy.lifetimeRevenue;
  session.lastPeriodicSaveAt = performance.now();
  const initial_frame_at = performance.now();

  synchronize_stall_menus(session);

  /** Names a definition ID for the activity feed, falling back to the ID. */
  function resolve_definition_name(definition_id: string): string {
    return session.visuals[definition_id]?.name ?? definition_id;
  }

  function runCommand(command: GameCommand, persist = true) {
    const result = dispatch_session_command(session, command);
    for (const event of result.events) {
      const runtimeEvent = formatSimulationEvent(event, resolve_definition_name);
      if (runtimeEvent) options.onEvent(runtimeEvent);
    }
    if ((result.accepted || result.hasMenusChanged) && persist) {
      options.onPersistentChange(build_persistent_payload(session));
    }
    activeScene?.render(true);
    emitHud(true);
    return result.accepted;
  }

  function emitHud(force = false) {
    const now = performance.now();
    if (!force && now - lastHudAt < HUD_INTERVAL_MS) return;
    lastHudAt = now;
    options.onSnapshot(
      build_runtime_snapshot({
        state: session.state,
        catalog: session.catalog,
        visuals: session.visuals,
        stallMenus: session.stallMenus,
        activeDishVariants: session.activeDishVariants,
        interaction: {
          buildTool: interaction.buildTool,
          selectedBuildId: interaction.selectedBuildId,
          selectedObjectId: interaction.selectedObjectId,
          selectedCustomerId: interaction.selectedCustomerId,
          selectedAccessPointId: interaction.selectedAccessPointId,
          speed: interaction.speed,
        },
        fps: runtime.game?.loop.actualFps || 60,
        simulationMs: session.lastSimulationMs,
      }),
    );
  }

  const interaction_context: InteractionContext = {
    getSessionState: () => session.state,
    getCatalog: () => session.catalog,
    isReducedMotion: () => reducedMotion,
    interaction,
    runCommand: (command) => runCommand(command),
    emitHud: () => emitHud(true),
    render: () => activeScene?.render(true),
    emitEvent: (event) => options.onEvent(event),
  };

  /**
   * Steps the simulation for one frame while the centre is open and not paused: feeds the last
   * step's cost back as arrival pressure, advances, reconciles unlocks and menus, reports events,
   * and saves on a change or when the periodic interval has passed.
   *
   * @param frame_delta_ms - The capped real time since the previous frame.
   * @param now - The frame's `performance.now()` reading, for the periodic save.
   * @returns The simulation tick after the frame.
   */
  function advance_frame(frame_delta_ms: number, now: number): number {
    if (interaction.speed > 0 && isCentreOpen(session.state, session.catalog)) {
      const startedAt = performance.now();
      session.state = {
        ...session.state,
        arrivalPerformancePressure: Math.max(0, Math.min(1, (session.lastSimulationMs - 8) / 16)),
      };
      const result = advanceSimulation(session.state, frame_delta_ms * interaction.speed);
      const beforeUnlockCount = session.state.progression.unlockedDefinitionIds.length;
      session.state = reconcileRuntimeUnlocks(result.state);
      if (interaction.selectedCustomerId && !session.state.customers[interaction.selectedCustomerId]) {
        interaction.selectedCustomerId = undefined;
        options.onEvent({
          kind: "info",
          message: "The selected guest finished their visit.",
        });
      }
      const menusChanged = synchronize_stall_menus(session);
      session.lastSimulationMs = performance.now() - startedAt;
      for (const event of result.events) {
        const runtimeEvent = formatSimulationEvent(event, resolve_definition_name);
        if (runtimeEvent) options.onEvent(runtimeEvent);
      }
      const catalogueChanged =
        session.state.progression.unlockedDefinitionIds.length > beforeUnlockCount;
      if (catalogueChanged) {
        options.onEvent({
          kind: "success",
          message: "New catalogue choices are now available.",
          importance: "important",
        });
      }
      const revenueChanged =
        session.state.economy.lifetimeRevenue !== session.lastPersistentRevenue;
      if (revenueChanged) {
        session.lastPersistentRevenue = session.state.economy.lifetimeRevenue;
      }
      if (catalogueChanged || menusChanged || revenueChanged) {
        options.onPersistentChange(build_persistent_payload(session));
        session.lastPeriodicSaveAt = now;
      } else if (now - session.lastPeriodicSaveAt >= PERIODIC_SAVE_INTERVAL_MS && session.state.tick > 0) {
        options.onPersistentChange(build_persistent_payload(session));
        session.lastPeriodicSaveAt = now;
      }
    }
    return session.state.tick;
  }

  /**
   * Applies a key press from the game area: arrows move the cursor, Enter applies the tool,
   * R rotates, Escape deselects the guest or returns to the select tool, U undoes, Space pauses or
   * resumes, and +/- zoom.
   *
   * @param key - The pressed key, lowercased.
   */
  function handle_key(key: string) {
    const hoverTile = interaction.hoverTile;
    if (key === "arrowup") interaction.hoverTile = { ...hoverTile, y: Math.max(0, hoverTile.y - 1) };
    else if (key === "arrowdown") interaction.hoverTile = { ...hoverTile, y: Math.min(session.state.map.height - 1, hoverTile.y + 1) };
    else if (key === "arrowleft") interaction.hoverTile = { ...hoverTile, x: Math.max(0, hoverTile.x - 1) };
    else if (key === "arrowright") interaction.hoverTile = { ...hoverTile, x: Math.min(session.state.map.width - 1, hoverTile.x + 1) };
    else if (key === "enter") handleTile(interaction_context, hoverTile);
    else if (key === "r") rotateSelection(interaction_context);
    else if (key === "escape") {
      if (interaction.selectedCustomerId) {
        interaction.selectedCustomerId = undefined;
        emitHud(true);
      } else {
        setBuildTool(interaction_context, "select");
      }
    }
    else if (key === "u") runCommand({ type: "undo" });
    else if (key === " ") setSpeed(interaction_context, interaction.speed === 0 ? 1 : 0);
    else if (key === "+" || key === "=") zoomBy(0.1);
    else if (key === "-" || key === "_") zoomBy(-0.1);
  }

  /**
   * Builds the context for one render, from the live state and interaction settings.
   *
   * @param add_label - Places a world label through the scene.
   * @returns The render context, extended with the build interaction state for the overlay.
   */
  function build_render_context(add_label: LabelSink): OverlayContext {
    const snapshot = createSnapshot(session.state);
    return {
      frame: {
        tick: snapshot.tick,
        qualityMode,
        isReducedMotion: reducedMotion,
        isHighContrast: highContrast,
      },
      snapshot,
      state: session.state,
      catalog: session.catalog,
      visuals: session.visuals,
      stallMenus: session.stallMenus,
      activeDishVariants: session.activeDishVariants,
      selectedObjectId: interaction.selectedObjectId,
      selectedCustomerId: interaction.selectedCustomerId,
      isDebugOverlay: debugOverlay,
      addLabel: add_label,
      effectiveCatalog: effectiveCatalog(session.state, session.catalog),
      buildTool: interaction.buildTool,
      selectedBuildId: interaction.selectedBuildId,
      hoverTile: interaction.hoverTile,
      placementCandidate: (point) => placementCandidate(interaction, point),
    };
  }

  const HawkerScene = create_scene_class(PhaserRuntime, {
    parent: options.parent,
    initialFrameAt: initial_frame_at,
    getMap: () => session.state.map,
    getHoverTile: () => interaction.hoverTile,
    setHoverTile: (point) => {
      interaction.hoverTile = point;
    },
    handleTile: (point) => handleTile(interaction_context, point),
    handleKey: handle_key,
    advanceFrame: advance_frame,
    getRenderContext: build_render_context,
    emitHud,
    onCreated: (scene) => {
      activeScene = scene;
    },
  }, options.settings);

  function zoomBy(delta: number) {
    if (!activeScene) return;
    activeScene.cameras.main.setZoom(
      PhaserRuntime.Math.Clamp(activeScene.cameras.main.zoom + delta, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM),
    );
  }

  const game = create_game(PhaserRuntime, options.parent, options.settings, HawkerScene);
  runtime.game = game;

  const controller: RuntimeController = {
    destroy() {
      game.destroy(true);
      activeScene = undefined;
    },
    selectBuildItem(itemId) {
      interaction.selectedBuildId = itemId;
      interaction.selectedRotation = 0;
      if (itemId) setBuildTool(interaction_context, "place");
      emitHud(true);
      activeScene?.render(true);
    },
    setBuildTool: (tool) => setBuildTool(interaction_context, tool),
    rotateSelection: () => rotateSelection(interaction_context),
    undo() {
      runCommand({ type: "undo" });
    },
    toggleOpen() {
      const stalls = Object.values(session.state.objects).filter(
        (object) => session.catalog.placeables[object.definitionId]?.kind === "stall",
      );
      if (stalls.length === 0) {
        options.onEvent({
          kind: "warning",
          message: "Place at least one food or drink stall before opening.",
        });
        return false;
      }
      const nextOpen = !isCentreOpen(session.state, session.catalog);
      for (const object of stalls) {
        runCommand({ type: "set-stall-open", objectId: object.id, open: nextOpen }, false);
      }
      options.onPersistentChange(build_persistent_payload(session));
      options.onEvent({
        kind: "info",
        message: nextOpen ? "Shutters up — the lunch crowd is arriving." : "Centre closed for layout changes.",
      });
      emitHud(true);
      activeScene?.render(true);
      return true;
    },
    setSpeed: (next) => setSpeed(interaction_context, next),
    setQuality(quality) {
      qualityMode = quality;
      runCommand({ type: "set-quality-mode", mode: quality });
      game.loop.setFPSLimit(quality === "standard" ? STANDARD_FPS_LIMIT : LOWER_END_FPS_LIMIT);
      activeScene?.render(true);
    },
    setReducedMotion(enabled) {
      reducedMotion = enabled;
      activeScene?.render(true);
    },
    setHighContrast(enabled) {
      highContrast = enabled;
      activeScene?.render(true);
    },
    setDebugOverlay(enabled) {
      debugOverlay = enabled;
      activeScene?.render(true);
    },
    zoomBy,
    centreCamera() {
      activeScene?.cameras.main.centerOn(
        (session.state.map.width * TILE_SIZE) / 2,
        (session.state.map.height * TILE_SIZE) / 2,
      );
    },
    exportState() {
      return build_persistent_payload(session);
    },
    importState(value) {
      const imported = load_runtime_save(value, session.authoredCatalog);
      adopt_session(session, imported);
      interaction.selectedCustomerId = undefined;
      if (imported.isRecovered) {
        options.onEvent({
          kind: "warning",
          message: "One or more imported recipe choices were reset to reviewed defaults.",
        });
      }
      recomputeObjectSequence(session.state, interaction);
      session.lastPersistentRevenue = session.state.economy.lifetimeRevenue;
      activeScene?.syncWorldBounds(true);
      activeScene?.render(true);
      emitHud(true);
    },
    reset() {
      adopt_session(session, create_fresh_session(session.authoredCatalog, options.createWorldSeed?.()));
      recomputeObjectSequence(session.state, interaction);
      interaction.selectedBuildId = undefined;
      interaction.selectedObjectId = undefined;
      interaction.selectedCustomerId = undefined;
      interaction.selectedAccessPointId = undefined;
      interaction.pendingAccessKind = undefined;
      interaction.buildTool = "select";
      interaction.speed = 1;
      interaction.speedBeforeLayoutEdit = 1;
      session.lastPersistentRevenue = 0;
      activeScene?.syncWorldBounds(true);
      activeScene?.render(true);
      emitHud(true);
      options.onPersistentChange(build_persistent_payload(session));
    },
    spawnCustomer() {
      session.state = { ...session.state, spawnCountdownMs: 0 };
      const result = advanceSimulation(session.state, session.state.config.fixedStepMs);
      session.state = result.state;
      synchronize_stall_menus(session);
      activeScene?.render(true);
      emitHud(true);
    },
    addCash(amount) {
      session.state = {
        ...session.state,
        economy: { ...session.state.economy, currency: Math.max(0, session.state.economy.currency + amount) },
      };
      options.onPersistentChange(build_persistent_payload(session));
      emitHud(true);
    },
    expandMap() {
      if (session.state.progression.level < MAP_EXPANSION.minimumLevel) {
        options.onEvent({
          kind: "warning",
          message: `Reach level ${MAP_EXPANSION.minimumLevel} to expand the dining hall.`,
        });
        return false;
      }
      const accepted = runCommand({
        type: "expand-map",
        addColumns: MAP_EXPANSION.addColumns,
        addRows: MAP_EXPANSION.addRows,
      });
      if (accepted) {
        activeScene?.syncWorldBounds(false);
        options.onEvent({
          kind: "success",
          message: "The dining hall expanded by four columns and two rows.",
          importance: "important",
        });
      }
      return accepted;
    },
    beginQueueEdit(objectId) {
      const stall = session.state.objects[objectId];
      const definition = stall ? session.catalog.placeables[stall.definitionId] : undefined;
      const anchor = stall ? getObjectQueueAnchor(stall, session.catalog) : undefined;
      if (!stall || definition?.kind !== "stall" || !definition.stall || !anchor) {
        options.onEvent({ kind: "warning", message: "Select a placed stall to edit its queue." });
        return false;
      }
      setBuildTool(interaction_context, "queue");
      interaction.queueEditingStallId = objectId;
      interaction.queueDraft = stall.queuePath?.length ? stall.queuePath.map((point) => ({ ...point })) : [anchor];
      interaction.selectedObjectId = objectId;
      interaction.selectedBuildId = undefined;
      interaction.pendingMoveId = undefined;
      options.onEvent({
        kind: "info",
        message: stall.queuePath?.length
          ? "Choose an existing queue space to shorten it, or an adjacent tile to extend it."
          : "Choose adjacent clear tiles to shape this stall's queue.",
      });
      emitHud(true);
      activeScene?.render(true);
      return true;
    },
    setQueueDirection(objectId, direction) {
      const accepted = runCommand({
        type: "set-stall-queue-direction",
        objectId,
        direction,
      });
      if (accepted) {
        interaction.queueEditingStallId = undefined;
        interaction.queueDraft = [];
        interaction.buildTool = "select";
        interaction.selectedObjectId = objectId;
        options.onEvent({ kind: "info", message: `Automatic queue now starts ${direction}.` });
        emitHud(true);
      }
      return accepted;
    },
    finishQueueEdit() {
      if (interaction.buildTool !== "queue") return;
      interaction.queueEditingStallId = undefined;
      interaction.queueDraft = [];
      interaction.buildTool = "select";
      options.onEvent({ kind: "info", message: "Queue route saved." });
      emitHud(true);
      activeScene?.render(true);
    },
    setDishEnabled(stallId, dishId, enabled) {
      const definition = STALLS.find((stall) => stall.id === stallId);
      if (!definition || !definition.dishIds.includes(dishId)) return false;
      if (enabled && !isDishIdUnlockedForMenu(dishId, stallMenuProgression(session.state))) {
        options.onEvent({
          kind: "warning",
          message: "That dish has not been unlocked yet.",
        });
        return false;
      }
      const current = [...(session.stallMenus[stallId] ?? [])];
      const hasDish = current.includes(dishId);
      if (enabled === hasDish) return true;
      const mastery = session.state.progression.stallMastery[stallId];
      const menuSlots = compute_menu_slots(definition, mastery?.upgradeLevel);
      if (enabled && current.length >= menuSlots) {
        options.onEvent({
          kind: "warning",
          message: `${localized(definition.nameKey)} has ${menuSlots} menu slots. Turn off another dish first.`,
        });
        return false;
      }
      if (!enabled && current.length <= 1) {
        options.onEvent({
          kind: "warning",
          message: "Every open stall needs at least one operating dish.",
        });
        return false;
      }
      const next = enabled
        ? [...current, dishId]
        : current.filter((candidate) => candidate !== dishId);
      session.stallMenus = { ...session.stallMenus, [stallId]: next };
      apply_catalog_layers(session);
      options.onPersistentChange(build_persistent_payload(session));
      emitHud(true);
      options.onEvent({
        kind: "info",
        message: `${localized(definition.nameKey)} menu updated.`,
      });
      return true;
    },
    setDishVariant(dishId, variantId) {
      const family = getNutritionVariantFamily(dishId);
      const variant = family?.variants.find((candidate) => candidate.id === variantId);
      if (!family || !variant) return false;
      const rank = compute_dish_mastery_rank(session.state.progression, dishId);
      if (variant.unlockRank > rank) {
        options.onEvent({
          kind: "warning",
          message: `Reach stall mastery rank ${variant.unlockRank} to serve that version.`,
        });
        return false;
      }
      if (session.activeDishVariants[dishId] === variantId) return true;
      session.activeDishVariants = { ...session.activeDishVariants, [dishId]: variantId };
      apply_catalog_layers(session);
      options.onPersistentChange(build_persistent_payload(session));
      emitHud(true);
      activeScene?.render(true);
      options.onEvent({
        kind: "info",
        message: `${variant.name} will be used for future orders.`,
      });
      return true;
    },
    selectCustomer(customerId) {
      interaction.selectedCustomerId = customerId && session.state.customers[customerId]
        ? customerId
        : undefined;
      emitHud(true);
      activeScene?.render(true);
    },
    addAccessPoint(kind) {
      setBuildTool(interaction_context, "access");
      interaction.pendingAccessKind = kind;
      interaction.selectedAccessPointId = undefined;
      interaction.selectedBuildId = undefined;
      interaction.selectedObjectId = undefined;
      options.onEvent({ kind: "info", message: `Choose a clear boundary tile for the new ${kind}.` });
      emitHud(true);
      activeScene?.render(true);
    },
    selectAccessPoint(accessPointId) {
      if (accessPointId && !session.state.accessPoints.some((point) => point.id === accessPointId)) return;
      setBuildTool(interaction_context, "access");
      interaction.selectedAccessPointId = accessPointId;
      interaction.pendingAccessKind = undefined;
      emitHud(true);
      activeScene?.render(true);
    },
    removeSelectedAccessPoint() {
      if (!interaction.selectedAccessPointId) return false;
      const accepted = runCommand({ type: "remove-access-point", accessPointId: interaction.selectedAccessPointId });
      if (accepted) interaction.selectedAccessPointId = undefined;
      return accepted;
    },
    clearGuestRoute() {
      if (session.state.routeGuidePoints.length === 0) return true;
      const accepted = runCommand({ type: "configure-guest-route", points: [] });
      if (accepted) {
        options.onEvent({ kind: "info", message: "Preferred guest route cleared." });
      }
      return accepted;
    },
    upgradeStall(definitionId) {
      const accepted = runCommand({ type: "upgrade-stall", definitionId });
      if (accepted) options.onEvent({ kind: "success", message: "Stall mastery upgrade purchased.", importance: "important" });
      return accepted;
    },
    renderPreview(definitionId) {
      const definition = session.catalog.placeables[definitionId];
      const visual = session.visuals[definitionId];
      if (!activeScene || !definition || !visual) return undefined;
      const frame = { isHighContrast: highContrast, isLowDetail: false };
      const { width, height } = definition.footprint;
      return activeScene.previewDataUrl(
        visual.category === "stall"
          ? stall_spec(definitionId, visual.name, visual.palette, visual.signShape, width, height, 0, "full", frame)
          : placeable_spec(definitionId, visual.category, width, height, 0, frame),
      );
    },
    renderDishPreview(dishId, variantId) {
      const dish = DISH_BY_ID.get(dishId);
      if (!activeScene || !dish) return undefined;
      const visualKey = nutritionVisualKeyForVariant(dishId, variantId ?? session.activeDishVariants[dishId]);
      return activeScene.previewDataUrl({
        kind: "dish",
        dishId,
        recipe: visualRecipeForDishVariant(dish, visualKey),
        eaten: 0,
        frame: { isHighContrast: highContrast, isLowDetail: false },
      });
    },
  };

  return controller;
}
