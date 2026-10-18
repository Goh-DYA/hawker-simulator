/**
 * The Dishes panel of the game screen's management panel: menu planning for one stall.
 *
 * `build_menu_rows` is the pure per-dish view model (offer state, gating, the unavailable
 * reason, the generated IDs, the active nutrition variant, its profile and the Star rating),
 * and `MenuPanel` renders the stall picker, the Nutrition Lens toggle and one row per dish
 * from it. The `HawkerSimulator` shell keeps the chosen stall, the lens and the Variant Lab
 * state behind the callbacks. The markup, its IDs (`dish-menu-title-…`, `dish-menu-reason-…`),
 * ARIA attributes and copy are the shell's former inline markup. Each row shows the serving the
 * runtime painted in its active variant once it is in `previewUrls`, and keeps its CSS preview
 * until then.
 */
import type { RefObject } from "react";
import { DISHES, STALLS, type DishDefinition, type StallDefinition } from "@/src/content";
import { compute_menu_slots } from "@/src/game/runtime/stallMenus";
import type {
  RuntimeController,
  RuntimeNutritionFamilySummary,
  RuntimeNutritionVariantSummary,
  RuntimeSnapshot,
} from "@/src/game/runtime/types";
import {
  DishRatingSummary,
  NutritionDisclosure,
  NutritionProfileSummary,
} from "../NutritionEducation";
import {
  dishPreview,
  dishStarRating,
  humanize_id,
  is_requirement_met,
  localize,
  money,
  nutritionProfileView,
  unlockLabel,
} from "../display";
import { NO_PREVIEWS, PaintedPreview, preview_key, type PreviewUrls } from "../previews";

/** The snapshot fields the menu rows read. */
type MenuProgress = Pick<
  RuntimeSnapshot,
  "level" | "reputation" | "unlockedContentIds" | "stallMenus" | "stallMastery"
>;

/** One dish row of a stall's menu, as the Dishes panel renders it. */
export interface MenuRow {
  /** The dish. */
  readonly dish: DishDefinition;
  /** Whether the dish is on the stall's active menu. */
  readonly isChecked: boolean;
  /** The dish preview recipe and style. */
  readonly preview: ReturnType<typeof dishPreview>;
  /** Why the dish cannot be offered (locked, or every slot active), if it cannot. */
  readonly unavailableReason: string | undefined;
  /** The ID of the element holding the unavailable reason. */
  readonly reasonId: string;
  /** The ID of the dish title, which labels the row. */
  readonly titleId: string;
  /** The dish's nutrition variant family, if it has one. */
  readonly nutritionFamily: RuntimeNutritionFamilySummary | undefined;
  /** The family's active variant, if any. */
  readonly activeVariant: RuntimeNutritionVariantSummary | undefined;
  /** The nutrition profile of the serving shown: the active variant's, else the dish's. */
  readonly profile:
    RuntimeNutritionVariantSummary["profile"] | ReturnType<typeof nutritionProfileView>;
  /** The dish's Star rating. */
  readonly starRating: number | undefined;
}

/** A stall's menu rows with the slot counts the capacity line shows. */
export interface MenuRows {
  /** How many dishes are on the stall's active menu. */
  readonly activeCount: number;
  /** How many menu slots the stall has at its upgrade level. */
  readonly menuSlots: number;
  /** One row per dish the stall can serve, in catalogue order. */
  readonly rows: readonly MenuRow[];
}

/**
 * Build the view model of a stall's menu: its slot counts and one row per dish it can serve.
 *
 * @param stall - The stall whose menu is shown.
 * @param snapshot - The centre's progress, menus and stall mastery.
 * @param nutritionFamilies - The dish variant families of the HUD snapshot.
 * @returns The active and available slot counts and the dish rows in catalogue order.
 */
export function build_menu_rows(
  stall: StallDefinition,
  snapshot: MenuProgress,
  nutritionFamilies: readonly RuntimeNutritionFamilySummary[],
): MenuRows {
  const activeMenu = snapshot.stallMenus[stall.id] ?? [];
  const mastery = snapshot.stallMastery.find((candidate) => candidate.definitionId === stall.id);
  const menuSlots = compute_menu_slots(stall, mastery?.upgradeLevel);
  const rows = DISHES.filter((dish) => dish.stallIds.includes(stall.id)).map((dish) => {
    const checked = activeMenu.includes(dish.id);
    const preview = dishPreview(dish);
    const gated = !is_requirement_met(dish.unlockRequirement, snapshot);
    const atCapacity = !checked && activeMenu.length >= menuSlots;
    const unavailableReason = gated
      ? unlockLabel(dish, snapshot.level, snapshot.reputation, snapshot.unlockedContentIds)
      : atCapacity
        ? `All ${menuSlots} menu slots are active`
        : undefined;
    const reasonId = `dish-menu-reason-${dish.id.slice("dish.".length)}`;
    const dishTitleId = `dish-menu-title-${dish.id.slice("dish.".length)}`;
    const nutritionFamily = nutritionFamilies.find((family) => family.dishId === dish.id);
    const activeVariant = nutritionFamily?.variants.find(
      (variant) => variant.id === nutritionFamily.activeVariantId,
    );
    const profile = activeVariant?.profile ?? nutritionProfileView(dish.id, activeVariant?.id);
    const starRating = nutritionFamily?.starRating ?? dishStarRating(dish.id);
    return {
      dish,
      isChecked: checked,
      preview,
      unavailableReason,
      reasonId,
      titleId: dishTitleId,
      nutritionFamily,
      activeVariant,
      profile,
      starRating,
    };
  });
  return { activeCount: activeMenu.length, menuSlots, rows };
}

/** The props of {@link MenuPanel}. */
export interface MenuPanelProps {
  /** The ID of the stall whose menu is shown. */
  readonly menuStallId: string;
  /** Called with the stall ID the player picks. */
  onMenuStallChange(stallId: string): void;
  /** Whether the Nutrition Lens shows each dish's full profile. */
  readonly nutritionLens: boolean;
  /** Called when the player turns the Nutrition Lens on or off. */
  onNutritionLensChange(isEnabled: boolean): void;
  /** The centre's progress, menus, stall mastery and nutrition families. */
  readonly snapshot: MenuProgress & Pick<RuntimeSnapshot, "nutritionFamilies">;
  /** The runtime controller that offers or withdraws dishes. */
  readonly controllerRef: RefObject<RuntimeController | undefined>;
  /** The painted servings, by preview key; a row keeps its CSS preview while its own is missing. */
  readonly previewUrls?: PreviewUrls;
  /** Called with a dish ID when the player opens its Variant Lab. */
  onTuneRecipe(dishId: string): void;
}

/**
 * Render the Dishes panel: the stall picker, the Nutrition Lens toggle and the stall's menu.
 *
 * @param props - See {@link MenuPanelProps}.
 * @returns The panel's menu manager.
 */
export function MenuPanel({
  menuStallId,
  onMenuStallChange,
  nutritionLens,
  onNutritionLensChange,
  snapshot,
  controllerRef,
  previewUrls = NO_PREVIEWS,
  onTuneRecipe,
}: MenuPanelProps) {
  return (
    <div className="menu-manager">
      <label className="menu-stall-picker">
        Operating stall
        <select value={menuStallId} onChange={(event) => onMenuStallChange(event.target.value)}>
          {STALLS.map((stall) => (
            <option
              key={stall.id}
              value={stall.id}
              disabled={!snapshot.unlockedContentIds.includes(stall.id)}
            >
              {localize(stall.nameKey)}
            </option>
          ))}
        </select>
      </label>
      <div className="nutrition-lens-toolbar">
        <label>
          <span>Nutrition Lens</span>
          <input
            type="checkbox"
            checked={nutritionLens}
            onChange={(event) => onNutritionLensChange(event.target.checked)}
          />
        </label>
        <p>Compare health, popularity, and every nutrient per listed serving.</p>
      </div>
      {STALLS.filter((stall) => stall.id === menuStallId).map((stall) => {
        const { activeCount, menuSlots, rows } = build_menu_rows(
          stall,
          snapshot,
          snapshot.nutritionFamilies,
        );
        return (
          <div className="dish-list" key={stall.id}>
            <p className="menu-capacity">
              {activeCount} of {menuSlots} menu slots active
            </p>
            {rows.map((row) => {
              const { dish, preview, activeVariant, profile, starRating } = row;
              const paintedUrl =
                previewUrls[preview_key({ kind: "dish", id: dish.id, variantId: activeVariant?.id })];
              return (
                <article
                  key={dish.id}
                  className="dish-row menu-dish-row"
                  aria-labelledby={row.titleId}
                >
                  <span
                    className={paintedUrl ? "dish-preview has-painting" : "dish-preview"}
                    data-dish={dish.id.slice("dish.".length)}
                    data-variant={activeVariant?.visualKey}
                    data-form={preview.recipe.foodForm}
                    data-motif={preview.recipe.presentation.motif}
                    data-presentation={preview.presentation}
                    data-semantic={preview.recipe.presentation.semanticKey}
                    data-vessel={preview.recipe.presentation.vessel}
                    style={preview.style}
                    aria-hidden="true"
                  >
                    {paintedUrl ? (
                      <PaintedPreview src={paintedUrl} />
                    ) : (
                      <>
                        <i className="dish-preview-portion" />
                        <i className="dish-preview-garnish" />
                        <i className="dish-preview-side" />
                      </>
                    )}
                  </span>
                  <div className="dish-menu-main">
                    <h3 id={row.titleId}>{localize(dish.nameKey)}</h3>
                    <small>
                      {humanize_id(dish.category, { shouldReplaceAll: false })}
                      {" · "}
                      {money(dish.price)} · demand {Math.round(dish.baseDemand * 100)}%
                    </small>
                    {activeVariant ? <small>Serving: {activeVariant.label}</small> : null}
                  </div>
                  {nutritionLens ? (
                    <NutritionProfileSummary profile={profile} starRating={starRating} />
                  ) : (
                    <DishRatingSummary
                      healthRating={profile?.healthRating}
                      starRating={starRating}
                    />
                  )}
                  <div className="dish-menu-actions">
                    <button
                      type="button"
                      aria-label={`View nutrition for ${localize(dish.nameKey)}`}
                      onClick={() => onNutritionLensChange(true)}
                    >
                      View nutrition
                    </button>
                    {row.nutritionFamily ? (
                      <button
                        type="button"
                        aria-label={`Tune recipe for ${localize(dish.nameKey)}`}
                        onClick={() => onTuneRecipe(dish.id)}
                      >
                        Tune recipe
                      </button>
                    ) : null}
                    <label className="dish-offer-control">
                      <span>Offer</span>
                      <input
                        type="checkbox"
                        checked={row.isChecked}
                        disabled={Boolean(row.unavailableReason)}
                        aria-label={`Offer ${localize(dish.nameKey)}${row.unavailableReason ? `, unavailable: ${row.unavailableReason}` : ""}`}
                        aria-describedby={row.unavailableReason ? row.reasonId : undefined}
                        onChange={(event) =>
                          controllerRef.current?.setDishEnabled(
                            stall.id,
                            dish.id,
                            event.target.checked,
                          )
                        }
                      />
                    </label>
                  </div>
                  {row.unavailableReason ? (
                    <em id={row.reasonId}>{row.unavailableReason}</em>
                  ) : null}
                </article>
              );
            })}
            <p className="nutrition-lens-note">
              Nutrition values are estimates for the listed serving. Actual recipes and portions
              vary.
            </p>
            <NutritionDisclosure />
          </div>
        );
      })}
    </div>
  );
}
