"use client";

/**
 * The game shell: the client component that boots the Phaser runtime and lays out the
 * HUD, panels and dialogs around it.
 *
 * It owns the UI state (open panel, dialogs, tutorial and tour steps, settings and
 * toasts), mirrors the runtime's snapshot, and composes the hooks, panels, HUD and
 * dialog modules that render it. Until the runtime publishes its first snapshot, the UI
 * renders from `INITIAL_SNAPSHOT`, which is also what server rendering shows.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  DISHES,
  ECONOMY,
  PLACEABLES,
  STALLS,
  type PlaceableDefinition,
  type StallDefinition,
} from "@/src/content";
import { has_dev_query_flag, IS_PRODUCTION_BUILD } from "@/src/config/env";
import {
  build_save_file_name,
  clearGame,
  exportSave,
  importSave,
} from "@/src/game/persistence/saveStore";
import {
  DEFAULT_SETTINGS,
  get_voice_limit_for_quality,
  PREFERENCE_KEYS,
} from "@/src/game/persistence/preferences";
import { activate_waiting_update } from "@/src/game/pwa/registerPwa";
import { defaultStallMenusForProgression } from "@/src/game/runtime/stallMenus";
import type {
  BuildTool,
  GameSpeed,
  RuntimeSettings,
  RuntimeSnapshot,
} from "@/src/game/runtime/types";
import {
  customerVariantLabel,
  CustomerNutritionInspector,
  NutritionPulseCard,
  VariantLabDialog,
} from "./NutritionEducation";
import {
  dishLabel,
  dishStarRating,
  getContentPrice,
  localize,
  money,
  PANEL_COPY,
  type Panel,
  personaLabel,
  unlockLabel,
} from "./display";
import {
  install_focus_trap,
  is_interface_inert,
  MODAL_FOCUSABLE_SELECTOR,
  NUTRITION_TOUR_DONE_STEP,
  type NutritionTourStep,
  resolve_active_modal,
  SHEET_FOCUSABLE_SELECTOR,
  TUTORIAL_DONE_STEP,
  type TutorialStep,
} from "./focus";
import {
  HelpDialog,
  NutritionTourDialog,
  ResetDialog,
  SettingsDialog,
  TutorialDialog,
} from "./dialogs";
import {
  report_failure,
  useAnnouncer,
  useAutosave,
  useHawkerRuntime,
  usePaintedPreviews,
  usePreferenceWriter,
} from "./hooks";
import { collect_preview_requests, preview_key } from "./previews";
import { BuildPanel, SelectionCard, StallsPanel } from "./panels/catalogue";
import { ActionStrip, BottomDock, DebugPanel, TopBar, ToastStack, WorldToolbar } from "./hud";
import { MenuPanel } from "./panels/menu";
import { ActivityPanel, FocusPanel, InsightsPanel, ObjectiveCard } from "./panels/overview";

const INITIAL_LEVEL = 1;
const INITIAL_REPUTATION = ECONOMY.startingReputation;

const INITIAL_SNAPSHOT: RuntimeSnapshot = {
  cash: ECONOMY.startingCash,
  reputation: INITIAL_REPUTATION,
  level: INITIAL_LEVEL,
  experience: 0,
  nextLevelExperience: 120,
  day: 1,
  timeLabel: "10:30 AM",
  isOpen: false,
  speed: 1,
  quality: "standard",
  activeCustomers: 0,
  servedCustomers: 0,
  averageSatisfaction: 100,
  hasSatisfactionRatings: false,
  satisfactionTips: [],
  queuePressure: 0,
  queueFlowState: "good",
  queueFlowMessage: "No queues are forming and every stall approach is clear.",
  freeSeats: 8,
  totalSeats: 8,
  cleanliness: 100,
  trayReturnStations: 1,
  buildTool: "select",
  routeGuidePoints: [],
  unlockedContentIds: [],
  stallMenus: defaultStallMenusForProgression({
    level: INITIAL_LEVEL,
    reputation: INITIAL_REPUTATION,
  }),
  activeDishVariants: {},
  nutritionFamilies: [],
  nutritionPulse: {
    servedMeals: 0,
    profiledMeals: 0,
    intentRequests: 0,
    intentMatches: 0,
    intentMisses: 0,
    intentUnknowns: 0,
    averages: {},
    knownCounts: {
      energyKcal: 0,
      proteinG: 0,
      dietaryFibreG: 0,
      sodiumMg: 0,
    },
  },
  placedStalls: [],
  canUndo: false,
  objectiveProgress: 0,
  objectiveTarget: 5,
  objectives: [],
  objectiveRefreshLabel: "8h 0m",
  claimedMilestoneCount: 0,
  milestoneTracks: [],
  stallMastery: [],
  accessPoints: [
    { id: "entrance-1", kind: "entrance", position: { x: 0, y: 7 } },
    { id: "exit-1", kind: "exit", position: { x: 23, y: 7 } },
  ],
  expansionCount: 0,
  nextExpansionCost: 1_000,
  fps: 60,
  simulationMs: 0,
  autosaveState: "saved",
};

const subscribeToStaticValue = () => () => undefined;
// The leading constant lets Vite fold this to `false` in production. Turbopack (build:vercel)
// keeps the text, but it cannot run there: IS_PRODUCTION_BUILD is true and the flag reads false.
const getDebugSnapshot = () => !IS_PRODUCTION_BUILD && has_dev_query_flag("debug");
const getServerDebugSnapshot = () => false;

/**
 * Renders the whole game: the world canvas host plus the HUD, panels and dialogs.
 *
 * @returns The simulator UI.
 */
export function HawkerSimulator() {
  const gameHostRef = useRef<HTMLDivElement>(null);
  const audioWarningRef = useRef(false);
  const tutorialDialogRef = useRef<HTMLElement>(null);
  const nutritionTourDialogRef = useRef<HTMLElement>(null);
  const cataloguePanelRef = useRef<HTMLElement>(null);
  const settingsDialogRef = useRef<HTMLElement>(null);
  const helpDialogRef = useRef<HTMLElement>(null);
  const resetDialogRef = useRef<HTMLElement>(null);
  const managementReturnFocusRef = useRef<HTMLElement | null>(null);

  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [panel, setPanel] = useState<Panel>("build");
  const [buildCategory, setBuildCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [menuStallId, setMenuStallId] = useState(STALLS[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(0);
  const [nutritionTourStep, setNutritionTourStep] = useState<NutritionTourStep>(NUTRITION_TOUR_DONE_STEP);
  const [nutritionLens, setNutritionLens] = useState(true);
  const [variantLabDishId, setVariantLabDishId] = useState<string>();
  const [managementOpen, setManagementOpen] = useState(false);
  const [compactManagement, setCompactManagement] = useState(false);
  const [online, setOnline] = useState(true);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const debugEnabled = useSyncExternalStore(
    subscribeToStaticValue,
    getDebugSnapshot,
    getServerDebugSnapshot,
  );

  const {
    announce,
    reportStorageIssue,
    toasts,
    activityEntries,
    setActivityEntries,
    activityUnread,
    setActivityUnread,
  } = useAnnouncer(panel === "activity");
  const persist_preference = usePreferenceWriter(reportStorageIssue);

  const get_autosave = useAutosave({
    onStatus(status) {
      setSnapshot((current) => ({ ...current, autosaveState: status }));
    },
    onError() {
      announce({
        kind: "error",
        message: "Could not save locally. Storage may be unavailable or full.",
      });
    },
  });

  // This must come before the settings effect below: the runtime effect issues the stored
  // settings read as its first statement, so IndexedDB queues that read ahead of the
  // settings effect's write of the defaults on mount, and the stored settings survive.
  const {
    controllerRef,
    audioRef,
    isLoading: loading,
    loadingError,
  } = useHawkerRuntime({
    hostRef: gameHostRef,
    onPreferences(preferences) {
      setSettings(preferences.settings);
      setTutorialStep(preferences.isTutorialComplete ? TUTORIAL_DONE_STEP : 0);
      setNutritionTourStep(preferences.isNutritionTourComplete ? NUTRITION_TOUR_DONE_STEP : 0);
      setNutritionLens(preferences.isNutritionLensEnabled);
    },
    onStorageIssue: reportStorageIssue,
    onSnapshot(nextSnapshot) {
      setSnapshot((current) => ({
        ...nextSnapshot,
        autosaveState: current.autosaveState,
      }));
    },
    onEvent: announce,
    onPersistentChange(state) {
      get_autosave().schedule(state);
    },
    onFlush() {
      void get_autosave().flush();
    },
    pwa: {
      onOfflineReady() {
        setOfflineReady(true);
      },
      onUpdateReady() {
        setUpdateReady(true);
      },
      onConnectivityChange(isOnline) {
        setOnline(isOnline);
      },
      onOfflineError(message) {
        announce({ kind: "warning", message: `Offline cache: ${message}` });
      },
    },
  });

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--player-text-scale",
      String(settings.textScale),
    );
    controllerRef.current?.setQuality(settings.quality);
    controllerRef.current?.setReducedMotion(settings.reducedMotion);
    controllerRef.current?.setHighContrast(settings.highContrast);
    audioRef.current?.setVoiceLimit(get_voice_limit_for_quality(settings.quality));
    audioRef.current?.setVolumes(
      settings.musicVolume,
      settings.ambienceVolume,
      settings.sfxVolume,
      settings.masterMuted,
    );
    void persist_preference(
      PREFERENCE_KEYS.SETTINGS,
      settings,
      "Preferences could not be saved on this device.",
    );
  }, [audioRef, controllerRef, persist_preference, settings]);

  useEffect(() => {
    if (loading) return;
    void persist_preference(
      PREFERENCE_KEYS.NUTRITION_LENS_ENABLED,
      nutritionLens,
      "Nutrition Lens preference could not be saved.",
    );
  }, [loading, nutritionLens, persist_preference]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 899px)");
    const updateCompactManagement = () => setCompactManagement(mediaQuery.matches);
    updateCompactManagement();
    mediaQuery.addEventListener("change", updateCompactManagement);
    return () => mediaQuery.removeEventListener("change", updateCompactManagement);
  }, []);

  useEffect(() => {
    const active_modal = resolve_active_modal({
      resetOpen,
      settingsOpen,
      helpOpen,
      tutorialStep,
      nutritionTourStep,
    });
    const modal = active_modal
      ? {
          reset: resetDialogRef,
          settings: settingsDialogRef,
          help: helpDialogRef,
          tutorial: tutorialDialogRef,
          "nutrition-tour": nutritionTourDialogRef,
        }[active_modal].current
      : null;
    if (!modal) return;
    return install_focus_trap(modal, {
      selector: MODAL_FOCUSABLE_SELECTOR,
      shouldSkipHidden: true,
      initialFocus: (container, focusables) =>
        container.querySelector<HTMLElement>("[autofocus]") ?? focusables()[0] ?? container,
      initialFocusTiming: "open",
      onEscape() {
        if (active_modal === "reset") setResetOpen(false);
        else if (active_modal === "settings") setSettingsOpen(false);
        else if (active_modal === "help") setHelpOpen(false);
        else if (active_modal === "tutorial") {
          setTutorialStep(TUTORIAL_DONE_STEP);
          void persist_preference(
            PREFERENCE_KEYS.TUTORIAL_COMPLETE,
            true,
            "Tutorial progress could not be saved.",
          );
        } else {
          setNutritionTourStep(NUTRITION_TOUR_DONE_STEP);
          void persist_preference(
            PREFERENCE_KEYS.NUTRITION_TOUR_COMPLETE,
            true,
            "Nutrition tour progress could not be saved.",
          );
        }
      },
    });
  }, [helpOpen, nutritionTourStep, persist_preference, resetOpen, settingsOpen, tutorialStep]);

  const visiblePlaceables = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en-SG");
    return PLACEABLES.filter((item) => {
      const matchesCategory = buildCategory === "all" || item.category === buildCategory;
      const searchable = `${localize(item.nameKey)} ${localize(item.descriptionKey)}`.toLocaleLowerCase("en-SG");
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [buildCategory, query]);

  const selectedContent = useMemo(
    () =>
      PLACEABLES.find((item) => item.id === selectedId) ??
      STALLS.find((stall) => stall.id === selectedId),
    [selectedId],
  );

  function unlockAudio() {
    void audioRef.current
      ?.unlock()
      .then(() => audioRef.current?.startAmbience())
      .catch((error: unknown) => {
        // Every pointerdown retries the unlock, so only the first failure is logged and shown.
        if (audioWarningRef.current) return;
        audioWarningRef.current = true;
        report_failure("audio unlock failed", error);
        announce({
          kind: "warning",
          message: "Audio is unavailable; every important cue still has a visual equivalent.",
        });
      });
  }

  function selectBuildItem(item: PlaceableDefinition | StallDefinition) {
    unlockAudio();
    if (!snapshot.unlockedContentIds.includes(item.id)) {
      announce({
        kind: "warning",
        message: `${localize(item.nameKey)} unlocks with ${unlockLabel(item, snapshot.level, snapshot.reputation, snapshot.unlockedContentIds).toLocaleLowerCase("en-SG")}.`,
      });
      return;
    }
    if (getContentPrice(item) > snapshot.cash) {
      announce({ kind: "warning", message: "You need more cash for that item." });
      return;
    }
    setSelectedId(item.id);
    controllerRef.current?.selectBuildItem(item.id);
    controllerRef.current?.setBuildTool("place");
    audioRef.current?.play("ui");
  }

  function chooseTool(tool: BuildTool) {
    setSelectedId(tool === "place" ? selectedId : undefined);
    controllerRef.current?.setBuildTool(tool);
    if (tool !== "place") controllerRef.current?.selectBuildItem(undefined);
    audioRef.current?.play("ui");
  }

  function chooseRouteTool() {
    const nextTool: BuildTool = snapshot.buildTool === "route" ? "select" : "route";
    chooseTool(nextTool);
    if (nextTool === "route") {
      window.requestAnimationFrame(() => gameHostRef.current?.focus());
    }
  }

  function setGameSpeed(speed: GameSpeed) {
    unlockAudio();
    controllerRef.current?.setSpeed(speed);
    audioRef.current?.play("ui");
  }

  function toggleCentre() {
    unlockAudio();
    const changed = controllerRef.current?.toggleOpen() ?? false;
    if (changed) audioRef.current?.play(snapshot.isOpen ? "close" : "open");
  }

  async function finishTutorial(openCentre: boolean) {
    setTutorialStep(TUTORIAL_DONE_STEP);
    await persist_preference(
      PREFERENCE_KEYS.TUTORIAL_COMPLETE,
      true,
      "Tutorial progress could not be saved.",
    );
    if (openCentre && !snapshot.isOpen) toggleCentre();
  }

  async function finishNutritionTour() {
    setNutritionTourStep(NUTRITION_TOUR_DONE_STEP);
    await persist_preference(
      PREFERENCE_KEYS.NUTRITION_TOUR_COMPLETE,
      true,
      "Nutrition tour progress could not be saved.",
    );
  }

  function openPanel(nextPanel: Panel, returnFocus?: HTMLElement) {
    if (
      !managementOpen &&
      window.matchMedia("(max-width: 899px)").matches
    ) {
      managementReturnFocusRef.current =
        returnFocus ?? document.activeElement as HTMLElement | null;
    }
    setPanel(nextPanel);
    setManagementOpen(true);
    if (nextPanel === "activity") setActivityUnread(0);
  }

  function closeManagementSheet() {
    setManagementOpen(false);
    controllerRef.current?.selectCustomer(undefined);
  }

  async function saveNow(): Promise<boolean> {
    get_autosave().cancel();
    const state = controllerRef.current?.exportState();
    if (!state) return false;
    try {
      await get_autosave().save(state);
      announce({ kind: "success", message: "Centre saved on this device." });
      return true;
    } catch {
      return false;
    }
  }

  async function applyReadyUpdate() {
    if (!(await saveNow())) return;
    await activate_waiting_update();
  }

  function downloadSave() {
    const state = controllerRef.current?.exportState();
    if (!state) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([exportSave(state)], { type: "application/json" }),
    );
    link.download = build_save_file_name(snapshot.day);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function uploadSave(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      get_autosave().cancel();
      const payload = importSave(await file.text());
      const controller = controllerRef.current;
      if (!controller) throw new Error("The game is not ready to import a save.");
      controller.importState(payload);
      await get_autosave().save(controller.exportState());
      announce({ kind: "success", message: "Save imported and checked.", importance: "important" });
    } catch (error) {
      announce({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not import that save.",
      });
    }
  }

  async function confirmReset() {
    get_autosave().cancel();
    await get_autosave().settle();
    await clearGame().catch((error: unknown) => {
      report_failure("save clear failed", error);
      reportStorageIssue("The stored save could not be removed.");
    });
    controllerRef.current?.reset();
    setResetOpen(false);
    setTutorialStep(0);
    setNutritionTourStep(0);
    await persist_preference(
      PREFERENCE_KEYS.TUTORIAL_COMPLETE,
      false,
      "Tutorial progress could not be reset.",
    );
    await persist_preference(
      PREFERENCE_KEYS.NUTRITION_TOUR_COMPLETE,
      false,
      "Nutrition tour progress could not be reset.",
    );
    announce({ kind: "info", message: "A fresh centre is ready." });
  }

  function update_setting<K extends keyof RuntimeSettings>(key: K, value: RuntimeSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  const nutritionFamilies = snapshot.nutritionFamilies;
  const nutritionPulse = snapshot.nutritionPulse;
  const selectedCustomerNutrition = snapshot.selectedCustomerNutrition;
  const managementSheetOpen = compactManagement && (
    managementOpen || Boolean(selectedCustomerNutrition)
  );
  const variantLabFamily = variantLabDishId
    ? nutritionFamilies.find((family) => family.dishId === variantLabDishId)
    : undefined;
  const interfaceInert = is_interface_inert({
    resetOpen,
    settingsOpen,
    helpOpen,
    tutorialStep,
    nutritionTourStep,
    isVariantLabOpen: Boolean(variantLabFamily),
  });
  const previewRequests = useMemo(
    () =>
      collect_preview_requests({
        panel,
        visiblePlaceables,
        menuStallId,
        nutritionFamilies,
        variantLabFamily,
        selectedId,
      }),
    [menuStallId, nutritionFamilies, panel, selectedId, variantLabFamily, visiblePlaceables],
  );
  const previewUrls = usePaintedPreviews(
    controllerRef,
    !loading && loadingError === undefined,
    previewRequests,
    settings.highContrast ? "high-contrast" : "standard",
  );

  useEffect(() => {
    if (!managementSheetOpen) return;
    const sheet = cataloguePanelRef.current;
    if (!sheet) return;
    return install_focus_trap(sheet, {
      selector: SHEET_FOCUSABLE_SELECTOR,
      shouldSkipHidden: true,
      initialFocus: (container, focusables) =>
        container.querySelector<HTMLElement>(".customer-nutrition-inspector button") ??
        focusables()[0] ??
        container,
      initialFocusTiming: "cancellable-frame",
      onEscape() {
        setManagementOpen(false);
        controllerRef.current?.selectCustomer(undefined);
      },
      shouldTreatOutsideAsEdge: true,
      shouldIgnoreOtherModals: true,
      returnFocusRef: managementReturnFocusRef,
      shouldRestoreFocus: (container) => container.contains(document.activeElement),
    });
  }, [controllerRef, managementSheetOpen]);

  return (
    <main
      className="game-shell"
      data-contrast={settings.highContrast ? "high" : "normal"}
      data-motion={settings.reducedMotion ? "reduced" : "full"}
      data-management-open={managementOpen || Boolean(selectedCustomerNutrition)}
      onPointerDown={unlockAudio}
    >
      <TopBar
        snapshot={snapshot}
        isInert={interfaceInert}
        onSetSpeed={setGameSpeed}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
      />

      <section className="play-layout" inert={interfaceInert} aria-hidden={interfaceInert}>
        <aside className="left-rail" aria-label="Objectives and centre pulse">
          <ObjectiveCard snapshot={snapshot} />

          <NutritionPulseCard
            compact
            pulse={nutritionPulse}
            dishLabel={dishLabel}
            onReview={() => openPanel("dishes")}
          />

          <section className="tip-card">
            <span aria-hidden="true">✦</span>
            <div>
              <strong>Layout tip</strong>
              <p>Leave two tiles before popular stall queues to reduce crowd knots.</p>
            </div>
          </section>
        </aside>

        <section className="world-column" aria-label="Hawker centre map">
          <WorldToolbar
            snapshot={snapshot}
            selectedName={selectedContent ? localize(selectedContent.nameKey) : undefined}
            controllerRef={controllerRef}
            onChooseTool={chooseTool}
            onChooseRouteTool={chooseRouteTool}
          />

          <div className="world-frame">
            <div
              ref={gameHostRef}
              className="game-host"
              data-testid="game-world"
              role="application"
              aria-label={snapshot.buildTool === "route"
                ? "Guest route editor. Use arrow keys to move the route cursor, Enter to add or remove a preferred route guide, and Escape to finish."
                : "Interactive hawker centre. Use arrow keys to move the cursor. Enter selects a guest or places the current item, R rotates, and Escape clears the selection."}
              tabIndex={0}
            >
              {loading ? (
                <div className="loading-centre" role="status">
                  <span className="loading-stall" aria-hidden="true">
                    <i className="loading-canopy" />
                    <i className="loading-counter" />
                    <span className="loading-bowl" />
                  </span>
                  <strong>Setting the tables…</strong>
                  <small>Preparing the local simulation</small>
                  <span className="loading-bar" aria-hidden="true">
                    <i />
                  </span>
                </div>
              ) : null}
              {loadingError ? (
                <div className="loading-centre error-card" role="alert">
                  <strong>The shutters could not open</strong>
                  <small>{loadingError}</small>
                  <button type="button" onClick={() => location.reload()}>
                    Reload game
                  </button>
                </div>
              ) : null}
            </div>

            <div className="camera-controls" aria-label="Camera controls">
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => controllerRef.current?.zoomBy(0.15)}
              >
                +
              </button>
              <button
                type="button"
                aria-label="Centre camera"
                onClick={() => controllerRef.current?.centreCamera()}
              >
                ◎
              </button>
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => controllerRef.current?.zoomBy(-0.15)}
              >
                −
              </button>
            </div>

            <div className="map-legend" aria-label="Map legend">
              <span><i className="legend-preferred-route" /> Preferred route guide</span>
              <span><i className="legend-predicted-route" /> Predicted guest path</span>
              <span><i className="legend-queue" /> Queue</span>
              <span><i className="legend-seat" /> Reserved seat</span>
            </div>
          </div>

          <ActionStrip
            snapshot={snapshot}
            controllerRef={controllerRef}
            onChooseTool={chooseTool}
            onToggleCentre={toggleCentre}
          />
        </section>

        <aside
          ref={cataloguePanelRef}
          className="catalogue-panel"
          aria-label={`${PANEL_COPY[panel].title} panel`}
          aria-modal={managementSheetOpen || undefined}
          role={managementSheetOpen ? "dialog" : undefined}
          tabIndex={managementSheetOpen ? -1 : undefined}
        >
          <div className="catalogue-heading">
            <div>
              <span>{PANEL_COPY[panel].kicker}</span>
              <h2>{PANEL_COPY[panel].title}</h2>
            </div>
            <span className="count-badge">
              {panel === "stalls"
                ? STALLS.length
                : panel === "dishes"
                  ? DISHES.length
                  : panel === "focus"
                    ? snapshot.objectives.length
                  : panel === "insights"
                    ? snapshot.activeCustomers
                    : panel === "activity"
                      ? activityEntries.length
                      : PLACEABLES.length}
            </span>
            <button
              type="button"
              className="sheet-close-button"
              aria-label="Close management sheet"
              onClick={closeManagementSheet}
            >
              ×
            </button>
          </div>

          {panel === "focus" ? (
            <FocusPanel snapshot={snapshot} onReviewDishes={() => openPanel("dishes")} />
          ) : null}

          {panel === "build" ? (
            <BuildPanel
              query={query}
              onQueryChange={setQuery}
              buildCategory={buildCategory}
              onBuildCategoryChange={setBuildCategory}
              visiblePlaceables={visiblePlaceables}
              selectedId={selectedId}
              snapshot={snapshot}
              previewUrls={previewUrls}
              onSelectBuildItem={selectBuildItem}
            />
          ) : null}

          {panel === "stalls" ? (
            <StallsPanel
              snapshot={snapshot}
              selectedId={selectedId}
              controllerRef={controllerRef}
              previewUrls={previewUrls}
              onSelectBuildItem={selectBuildItem}
            />
          ) : null}

          {panel === "dishes" ? (
            <MenuPanel
              menuStallId={menuStallId}
              onMenuStallChange={setMenuStallId}
              nutritionLens={nutritionLens}
              onNutritionLensChange={setNutritionLens}
              snapshot={snapshot}
              controllerRef={controllerRef}
              previewUrls={previewUrls}
              onTuneRecipe={setVariantLabDishId}
            />
          ) : null}

          {panel === "insights" ? (
            <InsightsPanel
              snapshot={snapshot}
              onExpandMap={() => {
                if (controllerRef.current?.expandMap()) audioRef.current?.play("reward");
              }}
            />
          ) : null}

          {panel === "activity" ? (
            <ActivityPanel
              activityEntries={activityEntries}
              onClear={() => {
                setActivityEntries([]);
                setActivityUnread(0);
              }}
            />
          ) : null}

          {selectedCustomerNutrition ? (
            <CustomerNutritionInspector
              customer={selectedCustomerNutrition}
              dishLabel={dishLabel}
              starRating={dishStarRating}
              personaLabel={personaLabel}
              variantLabel={(dishId, variantId) =>
                customerVariantLabel(nutritionFamilies, dishId, variantId)}
              onClose={() => controllerRef.current?.selectCustomer(undefined)}
              onRestoreFocus={() => gameHostRef.current?.focus()}
            />
          ) : null}

          {selectedContent && panel !== "activity" ? (
            <SelectionCard
              selectedContent={selectedContent}
              previewUrl={previewUrls[preview_key({ kind: "definition", id: selectedContent.id })]}
              onClear={() => {
                setSelectedId(undefined);
                controllerRef.current?.selectBuildItem(undefined);
              }}
            />
          ) : null}
        </aside>
      </section>

      <BottomDock
        panel={panel}
        activityUnread={activityUnread}
        isInert={interfaceInert}
        onOpenPanel={openPanel}
        onSaveNow={() => void saveNow()}
      />

      <div className="connection-badge" data-online={online} inert={interfaceInert} aria-hidden={interfaceInert}>
        <span />
        {online ? (offlineReady ? "Online · offline-ready" : "Online") : "Playing offline"}
      </div>

      <ToastStack
        isUpdateReady={updateReady}
        toasts={toasts}
        isInert={interfaceInert}
        onApplyUpdate={() => void applyReadyUpdate()}
      />

      {tutorialStep < TUTORIAL_DONE_STEP ? (
        <TutorialDialog
          ref={tutorialDialogRef}
          step={tutorialStep}
          onFinish={(openCentre) => void finishTutorial(openCentre)}
          onStepChange={setTutorialStep}
        />
      ) : null}

      {tutorialStep === TUTORIAL_DONE_STEP && nutritionTourStep < NUTRITION_TOUR_DONE_STEP ? (
        <NutritionTourDialog
          ref={nutritionTourDialogRef}
          step={nutritionTourStep}
          onFinish={() => void finishNutritionTour()}
          onStepChange={setNutritionTourStep}
        />
      ) : null}

      {variantLabFamily ? (
        <VariantLabDialog
          dishName={dishLabel(variantLabFamily.dishId)}
          family={variantLabFamily}
          variantPreview={(variantId) =>
            previewUrls[preview_key({ kind: "dish", id: variantLabFamily.dishId, variantId })]}
          onChoose={(variantId) => {
            controllerRef.current?.setDishVariant(variantLabFamily.dishId, variantId);
          }}
          onClose={() => setVariantLabDishId(undefined)}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsDialog
          ref={settingsDialogRef}
          settings={settings}
          isResetOpen={resetOpen}
          onUpdateSetting={update_setting}
          onClose={() => setSettingsOpen(false)}
          onExportSave={downloadSave}
          onImportSave={uploadSave}
          onOpenReset={() => setResetOpen(true)}
        />
      ) : null}

      {helpOpen ? (
        <HelpDialog
          ref={helpDialogRef}
          onClose={() => setHelpOpen(false)}
          onReplayTutorial={() => { setHelpOpen(false); setTutorialStep(0); }}
          onReplayNutritionTour={() => { setHelpOpen(false); setNutritionTourStep(0); }}
        />
      ) : null}

      {resetOpen ? (
        <ResetDialog
          ref={resetDialogRef}
          onCancel={() => setResetOpen(false)}
          onConfirm={() => void confirmReset()}
        />
      ) : null}

      {debugEnabled ? (
        <DebugPanel
          isOpen={debugOpen}
          onToggle={() => setDebugOpen((value) => !value)}
          snapshot={snapshot}
          controllerRef={controllerRef}
          isInert={interfaceInert}
        />
      ) : null}

      <p className="sr-only" aria-live="polite">
        {snapshot.activeCustomers} guests active. {snapshot.freeSeats} seats free. Cash {money(snapshot.cash)}.
      </p>
    </main>
  );
}
