/**
 * The catalogue panels of the game screen's management panel.
 *
 * The Build catalogue, the Stalls list with its operating queue plans and upgrades, and the
 * card describing the selected build item. They are presentational: they read the snapshot
 * fields and UI state their markup needs and report choices through callbacks, while the
 * `HawkerSimulator` shell keeps the state, the audio and the runtime calls behind those
 * callbacks. Their classes, IDs, ARIA attributes and copy are the shell's former inline markup.
 */
import type { RefObject } from "react";
import { STALLS, type PlaceableDefinition, type StallDefinition } from "@/src/content";
import type { RuntimeController, RuntimeSnapshot } from "@/src/game/runtime/types";
import {
  BUILD_CATEGORIES,
  catalogueIcon,
  getContentPrice,
  humanize_id,
  localize,
  money,
  placeablePreview,
  primaryUtility,
  unlockLabel,
  utilityEffects,
} from "../display";

/** The snapshot fields that decide whether a catalogue item is locked and what unlocks it. */
type UnlockProgress = Pick<RuntimeSnapshot, "level" | "reputation" | "unlockedContentIds">;

/** The props of {@link BuildPanel}. */
export interface BuildPanelProps {
  /** The catalogue search text. */
  readonly query: string;
  /** Called with the new search text as the player types. */
  onQueryChange(query: string): void;
  /** The chosen category filter, or `all`. */
  readonly buildCategory: string;
  /** Called with the category filter the player chooses. */
  onBuildCategoryChange(category: string): void;
  /** The placeables that pass the search and the category filter, in catalogue order. */
  readonly visiblePlaceables: readonly PlaceableDefinition[];
  /** The selected build item's ID, if any. */
  readonly selectedId: string | undefined;
  /** The centre's unlock progress. */
  readonly snapshot: UnlockProgress;
  /** Called when the player chooses a placeable, locked or not. */
  onSelectBuildItem(item: PlaceableDefinition): void;
}

/**
 * Render the Build catalogue: the search field, the category filters and the placeable cards.
 *
 * @param props - See {@link BuildPanelProps}.
 * @returns The panel's search field, category filters and catalogue grid.
 */
export function BuildPanel({
  query,
  onQueryChange,
  buildCategory,
  onBuildCategoryChange,
  visiblePlaceables,
  selectedId,
  snapshot,
  onSelectBuildItem,
}: BuildPanelProps) {
  return (
    <>
      <label className="search-field">
        <span className="sr-only">Search catalogue</span>
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search tables, fans, plants…"
        />
      </label>
      <div className="category-scroller" aria-label="Catalogue categories">
        {BUILD_CATEGORIES.map((category) => (
          <button
            type="button"
            key={category}
            className={buildCategory === category ? "is-active" : ""}
            aria-pressed={buildCategory === category}
            onClick={() => onBuildCategoryChange(category)}
          >
            {category === "all" ? "All" : humanize_id(category, { shouldReplaceAll: false })}
          </button>
        ))}
      </div>
      <div className="catalogue-grid" data-testid="build-catalogue">
        {visiblePlaceables.map((item) => {
          const locked = !snapshot.unlockedContentIds.includes(item.id);
          const selected = selectedId === item.id;
          const preview = placeablePreview(item);
          return (
            <button
              type="button"
              key={item.id}
              className={`catalogue-item ${selected ? "is-selected" : ""}`}
              aria-pressed={selected}
              aria-label={`${localize(item.nameKey)}, ${money(item.price)}${locked ? `, locked: ${unlockLabel(item, snapshot.level, snapshot.reputation, snapshot.unlockedContentIds)}` : ""}`}
              onClick={() => onSelectBuildItem(item)}
            >
              <span
                className={`item-art item-${item.category}`}
                data-motif={preview.recipe.motif}
                data-form={preview.recipe.form}
                data-material={preview.recipe.material}
                style={preview.style}
                aria-hidden="true"
              >
                <span>{catalogueIcon(item.category)}</span>
              </span>
              <strong>{localize(item.nameKey)}</strong>
              <small>
                {locked
                  ? unlockLabel(item, snapshot.level, snapshot.reputation, snapshot.unlockedContentIds)
                  : `${money(item.price)} · ${primaryUtility(item)}`}
              </small>
              {locked ? <i aria-hidden="true">●</i> : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** The props of {@link StallsPanel}. */
export interface StallsPanelProps {
  /** The centre's placed stalls, stall mastery, cash and unlock progress. */
  readonly snapshot: UnlockProgress &
    Pick<RuntimeSnapshot, "placedStalls" | "stallMastery" | "cash">;
  /** The selected build item's ID, if any. */
  readonly selectedId: string | undefined;
  /** The runtime controller, for queue direction, queue edit and upgrade commands. */
  readonly controllerRef: RefObject<RuntimeController | undefined>;
  /** Called when the player chooses a stall to build, locked or not. */
  onSelectBuildItem(item: StallDefinition): void;
}

/**
 * Render the Stalls panel: the operating stalls' queue plans and upgrades, then every stall.
 *
 * @param props - See {@link StallsPanelProps}.
 * @returns The stall list.
 */
export function StallsPanel({
  snapshot,
  selectedId,
  controllerRef,
  onSelectBuildItem,
}: StallsPanelProps) {
  return (
    <div className="stall-list" data-testid="stall-catalogue">
      {snapshot.placedStalls.length > 0 ? (
        <section className="operating-stalls" aria-labelledby="operating-stalls-title">
          <h3 id="operating-stalls-title">Operating queue plans</h3>
          {snapshot.placedStalls.map((placed) => (
            <article key={placed.objectId} className="queue-manager-row">
              <div>
                <strong>{placed.name}</strong>
                <small>
                  {placed.queueCount} queueing · {placed.customQueue ? "custom path" : `${placed.queueDirection} auto-line`}
                </small>
                {snapshot.stallMastery.filter((mastery) => mastery.definitionId === placed.definitionId).map((mastery) => (
                  <small key={mastery.definitionId}>Mastery rank {mastery.rank} · Upgrade {mastery.upgradeLevel}/4</small>
                ))}
              </div>
              <div className="queue-direction-group" aria-label={`${placed.name} queue direction`}>
                {(["north", "east", "south", "west"] as const).map((direction) => (
                  <button
                    type="button"
                    key={direction}
                    className={!placed.customQueue && placed.queueDirection === direction ? "is-active" : ""}
                    aria-pressed={!placed.customQueue && placed.queueDirection === direction}
                    aria-label={`Route ${placed.name} queue ${direction}`}
                    onClick={() => controllerRef.current?.setQueueDirection(placed.objectId, direction)}
                  >
                    {{ north: "↑", east: "→", south: "↓", west: "←" }[direction]}
                  </button>
                ))}
                <button
                  type="button"
                  className={placed.customQueue ? "is-active edit-queue-button" : "edit-queue-button"}
                  onClick={() => controllerRef.current?.beginQueueEdit(placed.objectId)}
                >
                  Bend line
                </button>
              </div>
              {snapshot.stallMastery.filter((mastery) => mastery.definitionId === placed.definitionId && mastery.nextUpgradeCost !== undefined).map((mastery) => (
                <button
                  type="button"
                  key={`upgrade-${mastery.definitionId}`}
                  className="stall-upgrade-button"
                  disabled={mastery.rank < (mastery.requiredRank ?? 1) || snapshot.cash < (mastery.nextUpgradeCost ?? 0)}
                  onClick={() => controllerRef.current?.upgradeStall(mastery.definitionId)}
                >
                  <span className="stall-upgrade-copy">
                    Upgrade to level {mastery.upgradeLevel + 1}
                    <small>Requires mastery rank {mastery.requiredRank}</small>
                  </span>
                  <strong>{money(mastery.nextUpgradeCost ?? 0)}</strong>
                </button>
              ))}
            </article>
          ))}
        </section>
      ) : null}
      <h3 className="catalogue-subheading">Add another stall</h3>
      {STALLS.map((stall) => {
        const locked = !snapshot.unlockedContentIds.includes(stall.id);
        return (
          <button
            type="button"
            key={stall.id}
            className={selectedId === stall.id ? "stall-card is-selected" : "stall-card"}
            onClick={() => onSelectBuildItem(stall)}
          >
            <span
              className="stall-swatch"
              data-stall={stall.id.slice("stall.".length)}
              style={{
                background: `linear-gradient(145deg, ${stall.visual.palette[0]}, ${stall.visual.palette[1]})`,
              }}
              aria-hidden="true"
            >
              {catalogueIcon("stall")}
            </span>
            <span>
              <strong>{localize(stall.nameKey)}</strong>
              <small>{stall.dishIds.length} dishes · {Math.round(stall.quality * 100)} quality</small>
            </span>
            <em>{locked ? unlockLabel(stall, snapshot.level, snapshot.reputation, snapshot.unlockedContentIds) : money(stall.purchaseCost)}</em>
          </button>
        );
      })}
    </div>
  );
}

/** The props of {@link SelectionCard}. */
export interface SelectionCardProps {
  /** The selected placeable or stall. */
  readonly selectedContent: PlaceableDefinition | StallDefinition;
  /** Called when the player clears the selection. */
  onClear(): void;
}

/**
 * Render the card describing the selected build item.
 *
 * @param props - See {@link SelectionCardProps}.
 * @returns The item's kind, name, description, footprint and price, plus a placeable's
 *   in-game utility.
 */
export function SelectionCard({ selectedContent, onClear }: SelectionCardProps) {
  return (
    <div className="selection-card">
      <button
        type="button"
        aria-label="Clear selection"
        onClick={onClear}
      >
        ×
      </button>
      <span>{"category" in selectedContent ? selectedContent.category : "food stall"}</span>
      <strong>{localize(selectedContent.nameKey)}</strong>
      <p>{localize(selectedContent.descriptionKey)}</p>
      <dl>
        <div><dt>Footprint</dt><dd>{selectedContent.footprint.width} × {selectedContent.footprint.height}</dd></div>
        <div><dt>Price</dt><dd>{money(getContentPrice(selectedContent))}</dd></div>
      </dl>
      {"category" in selectedContent ? (
        <div className="utility-card">
          <strong>In-game utility</strong>
          <ul>
            {utilityEffects(selectedContent).map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
            {utilityEffects(selectedContent).length === 0 ? (
              <li>
                {selectedContent.walkability === "blocked"
                  ? "Shapes guest routes and collision-safe queue lines"
                  : "Adds a walk-through visual landmark"}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
