"use client";

/**
 * The nutrition education components: dish ratings, nutrition profiles, the nutrition
 * pulse, the Variant Lab dialog, the customer nutrition inspector and the disclosure note.
 *
 * The components render view models (the `*View` types here) that the runtime snapshot
 * provides, so they hold no game logic. `dialogFocusAction` is re-exported from `focus.ts`
 * for existing importers.
 */

import { useEffect, useRef } from "react";
import { HEALTH_CONDITION_LABELS as RUNTIME_HEALTH_CONDITION_LABELS } from "@/src/game/runtime/nutrition";
import { install_focus_trap, VARIANT_LAB_FOCUSABLE_SELECTOR } from "./focus";

export { dialogFocusAction, type DialogFocusAction } from "./focus";

/** One nutrient value of a profile: a known amount, a trace amount, or unavailable. */
export type NutritionValueView =
  | { readonly status: "known"; readonly value: number }
  | { readonly status: "trace" }
  | { readonly status: "unavailable"; readonly reason?: string };

/** The nutrition profile of one serving, with its health and per-condition ratings. */
export interface NutritionProfileView {
  readonly status: "released" | "unavailable" | "quarantined";
  readonly servingLabel?: string;
  readonly energyKcal?: NutritionValueView;
  readonly proteinG?: NutritionValueView;
  readonly totalFatG?: NutritionValueView;
  readonly saturatedFatG?: NutritionValueView;
  readonly transFatG?: NutritionValueView;
  readonly carbohydrateG?: NutritionValueView;
  readonly dietaryFibreG?: NutritionValueView;
  readonly sodiumMg?: NutritionValueView;
  readonly totalSugarG?: NutritionValueView;
  readonly calciumMg?: NutritionValueView;
  readonly ironMg?: NutritionValueView;
  readonly waterG?: NutritionValueView;
  readonly healthRating?: number;
  readonly conditionRatings?: Readonly<Record<string, number | undefined>>;
  readonly intentFits?: Readonly<Record<string, number | undefined>>;
}

/** One variant of a dish as the Variant Lab lists it. */
export interface NutritionVariantView {
  readonly id: string;
  readonly label: string;
  readonly unlockRank: number;
  readonly visualKey: string;
  readonly unlocked: boolean;
  readonly selected: boolean;
  readonly profile?: NutritionProfileView;
}

/** A dish's variant family, with the default and the currently served variant. */
export interface NutritionFamilyView {
  readonly dishId: string;
  readonly starRating?: number;
  readonly defaultVariantId: string;
  readonly activeVariantId: string;
  readonly variants: readonly NutritionVariantView[];
}

/** The day's nutrition totals: meals served, intent outcomes and average nutrients. */
export interface NutritionPulseView {
  readonly servedMeals: number;
  readonly profiledMeals: number;
  readonly intentRequests: number;
  readonly intentMatches: number;
  readonly intentMisses: number;
  readonly intentUnknowns: number;
  readonly averages: Readonly<{
    energyKcal?: number;
    proteinG?: number;
    dietaryFibreG?: number;
    sodiumMg?: number;
  }>;
  readonly knownCounts: Readonly<{
    energyKcal: number;
    proteinG: number;
    dietaryFibreG: number;
    sodiumMg: number;
  }>;
  readonly mostServedDishId?: string;
  readonly leadingUnmetIntent?: string;
}

/** The nutrition story of one customer: intent, order, result and health effects. */
export interface CustomerNutritionView {
  readonly customerId: string;
  readonly archetypeId: string;
  readonly status: string;
  readonly decisionReasons: readonly string[];
  readonly intentId?: string;
  readonly dishId?: string;
  readonly variantId?: string;
  readonly requestResult?: "matched" | "missed" | "unknown";
  readonly healthConditionIds?: readonly string[];
  readonly personalizedHealthRating?: number;
  readonly healthImpact?: number;
  readonly healthPreferenceResult?: "matched" | "missed" | "unknown";
  readonly healthDecisionReasons?: readonly string[];
  readonly profile?: NutritionProfileView;
}

const INTENT_LABELS: Readonly<Record<string, string>> = {
  "lighter-energy": "Lighter energy",
  "protein-forward": "Protein-forward",
  "fibre-forward": "Fibre-forward",
  "sodium-aware": "Sodium-aware",
  "lower-total-sugar-drink": "Lower total sugar drink",
};

const INTENT_MATCH_COPY: Readonly<Record<string, string>> = {
  "lighter-energy": "Lighter energy",
  "protein-forward": "More protein",
  "fibre-forward": "More fibre",
  "sodium-aware": "Less sodium",
  "lower-total-sugar-drink": "Less total sugar",
};

const INTENT_TRADE_OFF_COPY: Readonly<Record<string, string>> = {
  "lighter-energy": "More energy",
  "protein-forward": "Less protein",
  "fibre-forward": "Less fibre",
  "sodium-aware": "More sodium",
  "lower-total-sugar-drink": "More total sugar",
};

const METRIC_COPY = {
  energyKcal: { label: "Energy", unit: "kcal", digits: 0 },
  proteinG: { label: "Protein", unit: "g", digits: 1 },
  totalFatG: { label: "Total fat", unit: "g", digits: 1 },
  saturatedFatG: { label: "Saturated fat", unit: "g", digits: 1 },
  transFatG: { label: "Trans fat", unit: "g", digits: 2 },
  carbohydrateG: { label: "Carbohydrate", unit: "g", digits: 1 },
  dietaryFibreG: { label: "Fibre", unit: "g", digits: 1 },
  sodiumMg: { label: "Sodium", unit: "mg", digits: 0 },
  totalSugarG: { label: "Total sugar", unit: "g", digits: 1 },
  calciumMg: { label: "Calcium", unit: "mg", digits: 0 },
  ironMg: { label: "Iron", unit: "mg", digits: 1 },
  waterG: { label: "Water", unit: "g", digits: 1 },
} as const;

type ProfileMetric = keyof typeof METRIC_COPY;
const PRIMARY_PROFILE_METRICS = [
  "energyKcal",
  "proteinG",
  "totalFatG",
  "carbohydrateG",
  "totalSugarG",
  "dietaryFibreG",
  "sodiumMg",
] as const satisfies readonly ProfileMetric[];
const ADDITIONAL_PROFILE_METRICS = [
  "saturatedFatG",
  "transFatG",
  "calciumMg",
  "ironMg",
  "waterG",
] as const satisfies readonly ProfileMetric[];
const COMPARISON_METRICS = [
  "energyKcal",
  "totalFatG",
  "carbohydrateG",
  "totalSugarG",
  "dietaryFibreG",
  "sodiumMg",
] as const satisfies readonly ProfileMetric[];
const PULSE_METRICS = [
  "energyKcal",
  "proteinG",
  "dietaryFibreG",
  "sodiumMg",
] as const satisfies readonly ProfileMetric[];

/** The runtime's condition labels, indexable by any condition ID a profile or guest holds. */
const HEALTH_CONDITION_LABELS: Readonly<Record<string, string>> = RUNTIME_HEALTH_CONDITION_LABELS;

/**
 * Names the variant a customer was served.
 *
 * @param families - The variant families from the snapshot.
 * @param dishId - The dish served.
 * @param variantId - The variant served.
 * @returns The variant's label, "Listed serving" for a dish without a family served as
 *   itself, or undefined when the variant is unknown.
 */
export function customerVariantLabel(
  families: readonly NutritionFamilyView[],
  dishId: string,
  variantId: string,
): string | undefined {
  const family = families.find((candidate) => candidate.dishId === dishId);
  if (!family) return variantId === dishId ? "Listed serving" : undefined;
  return family.variants.find((variant) => variant.id === variantId)?.label;
}

function formatNumber(value: number, digits: number) {
  return value.toLocaleString("en-SG", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

/**
 * Formats a nutrient value with its unit for display.
 *
 * @param value - The value to format.
 * @param metric - The nutrient, which sets the unit and decimal places.
 * @returns The formatted amount, "Trace amount", or "Not available".
 */
export function nutritionValueText(
  value: NutritionValueView | undefined,
  metric: ProfileMetric,
) {
  if (!value || value.status === "unavailable") return "Not available";
  if (value.status === "trace") return "Trace amount";
  const copy = METRIC_COPY[metric];
  return `${formatNumber(value.value, copy.digits)} ${copy.unit}`;
}

/**
 * Names a nutrition intent for display.
 *
 * @param intentId - The intent's ID.
 * @returns The intent's label, the ID with dashes as spaces when it has none, or
 *   undefined when no ID is given.
 */
export function intentLabel(intentId: string | undefined) {
  if (!intentId) return undefined;
  return INTENT_LABELS[intentId] ?? intentId.replaceAll("-", " ");
}

function ratingText(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.max(0, Math.min(5, value)).toFixed(1)}/5`
    : "Not rated";
}

/**
 * Renders a dish's health and star rating badges.
 *
 * @param props - The ratings to show and the health badge's label.
 * @returns The rating badges.
 */
export function DishRatingSummary({
  healthRating,
  starRating,
  healthLabel = "Health rating",
}: {
  readonly healthRating?: number;
  readonly starRating?: number;
  readonly healthLabel?: string;
}) {
  return (
    <div className="dish-rating-summary" aria-label="Dish health and star ratings">
      <span
        className="dish-rating-badge is-health"
        aria-label={`${healthLabel}: ${ratingText(healthRating)}`}
      >
        <i aria-hidden="true">♥</i>
        <span><small>{healthLabel}</small><strong>{ratingText(healthRating)}</strong></span>
      </span>
      <span
        className="dish-rating-badge is-star"
        aria-label={`Star rating for taste and popularity: ${ratingText(starRating)}`}
      >
        <i aria-hidden="true">★</i>
        <span><small>Star rating</small><strong>{ratingText(starRating)}</strong></span>
      </span>
    </div>
  );
}

function ConditionRatingDetails({
  ratings,
}: {
  readonly ratings?: Readonly<Record<string, number | undefined>>;
}) {
  const entries = Object.entries(ratings ?? {}).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === "number" && Number.isFinite(entry[1]),
  );
  if (entries.length === 0) return null;
  return (
    <details className="condition-rating-details">
      <summary>Health rating by condition</summary>
      <dl aria-label="Condition-specific health ratings">
        {entries.map(([condition, rating]) => (
          <div key={condition}>
            <dt>{HEALTH_CONDITION_LABELS[condition] ?? condition.replaceAll("-", " ")}</dt>
            <dd>{ratingText(rating)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/**
 * Renders a serving's ratings and nutrients, with the less common nutrients and the
 * per-condition ratings behind disclosures.
 *
 * @param props - The profile, the ratings that override its own, and the labelling element.
 * @returns The nutrition summary.
 */
export function NutritionProfileSummary({
  profile,
  starRating,
  healthRating,
  healthLabel,
  labelledBy,
}: {
  readonly profile?: NutritionProfileView;
  readonly starRating?: number;
  readonly healthRating?: number;
  readonly healthLabel?: string;
  readonly labelledBy?: string;
}) {
  const dataState = !profile || profile.status === "unavailable"
    ? "Not available"
    : profile.status === "quarantined"
      ? "Data under review"
      : undefined;
  return (
    <div className="nutrition-summary" aria-labelledby={labelledBy}>
      <DishRatingSummary
        healthRating={healthRating ?? profile?.healthRating}
        starRating={starRating}
        healthLabel={healthLabel}
      />
      <p>Serving · {profile?.servingLabel ?? dataState ?? "Not available"}</p>
      {dataState ? <p className="nutrition-data-state">{dataState}</p> : null}
      <dl aria-label="Key nutrition per listed serving">
        {PRIMARY_PROFILE_METRICS.map((metric) => (
          <div key={metric}>
            <dt>{METRIC_COPY[metric].label}</dt>
            <dd>{dataState ?? nutritionValueText(profile?.[metric], metric)}</dd>
          </div>
        ))}
      </dl>
      <details className="nutrition-more-details">
        <summary>More nutrition details</summary>
        <dl aria-label="Additional nutrition per listed serving">
          {ADDITIONAL_PROFILE_METRICS.map((metric) => (
            <div key={metric}>
              <dt>{METRIC_COPY[metric].label}</dt>
              <dd>{dataState ?? nutritionValueText(profile?.[metric], metric)}</dd>
            </div>
          ))}
        </dl>
      </details>
      <ConditionRatingDetails ratings={profile?.conditionRatings} />
    </div>
  );
}

function averageText(value: number | undefined, metric: ProfileMetric) {
  if (value === undefined) return "Not available";
  const copy = METRIC_COPY[metric];
  return `${formatNumber(value, copy.digits)} ${copy.unit}`;
}

/**
 * Renders the day's nutrition pulse card.
 *
 * @param props - The pulse, a dish labeller, an optional review action and the compact flag.
 * @returns The pulse card.
 */
export function NutritionPulseCard({
  pulse,
  dishLabel,
  onReview,
  compact = false,
}: {
  readonly pulse: NutritionPulseView;
  dishLabel(dishId: string): string;
  readonly onReview?: () => void;
  readonly compact?: boolean;
}) {
  const leadingIntent = intentLabel(pulse.leadingUnmetIntent);
  return (
    <section className={compact ? "nutrition-pulse-card is-compact" : "nutrition-pulse-card"}>
      <div className="nutrition-pulse-heading">
        <div className="nutrition-pulse-heading-meta">
          <span className="nutrition-pulse-kicker">Today&apos;s menu read</span>
          <span className="nutrition-neutral-badge">Health ≠ popularity</span>
        </div>
        <h2>Nutrition pulse</h2>
      </div>
      {pulse.servedMeals === 0 ? (
        <div className="nutrition-empty-state">
          <strong>No servings yet today</strong>
          <p>Open the centre to build a picture from profiled dishes.</p>
        </div>
      ) : (
        <>
          <dl className="nutrition-pulse-totals">
            <div>
              <dt>Profiled servings</dt>
              <dd>{pulse.profiledMeals}/{pulse.servedMeals}</dd>
            </div>
            <div>
              <dt>Intent matches</dt>
              <dd>{pulse.intentMatches}/{pulse.intentRequests}</dd>
            </div>
            <div>
              <dt>Missed</dt>
              <dd>{pulse.intentMisses}</dd>
            </div>
            <div>
              <dt>Unknown data</dt>
              <dd>{pulse.intentUnknowns}</dd>
            </div>
          </dl>
          <dl className="nutrition-average-list" aria-label="Average nutrition per profiled serving">
            {PULSE_METRICS.map((metric) => (
              <div key={metric}>
                <dt>{METRIC_COPY[metric].label}</dt>
                <dd>
                  {averageText(pulse.averages[metric], metric)}
                  <small>{pulse.knownCounts[metric]} known</small>
                </dd>
              </div>
            ))}
          </dl>
          <div className="nutrition-pulse-note">
            <strong>Most served</strong>
            <p>
              {pulse.mostServedDishId
                ? `${dishLabel(pulse.mostServedDishId)} is today’s most-served profiled dish.`
                : "Keep serving reviewed dishes to reveal the day’s leading choice."}
            </p>
          </div>
          <div className="nutrition-pulse-note">
            <strong>Next menu action</strong>
            <p>
              {leadingIntent
                ? `${leadingIntent} is the leading unmet visit intent. Compare reviewed variants in Menu planning.`
                : "No leading unmet nutrition intent yet. Keep the menu varied and reviewed."}
            </p>
          </div>
        </>
      )}
      {onReview ? (
        <button type="button" className="nutrition-review-button" onClick={onReview}>
          Review menu trade-offs <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </section>
  );
}

function comparisonText(
  current: NutritionValueView | undefined,
  candidate: NutritionValueView | undefined,
) {
  if (!current || !candidate || current.status !== "known" || candidate.status !== "known") {
    return "Not available";
  }
  if (Math.abs(current.value - candidate.value) < 0.05) return "Same";
  return candidate.value > current.value ? "Higher" : "Lower";
}

/**
 * Renders the Variant Lab, the modal where the player picks which variant a dish serves.
 *
 * The dialog traps focus while open and closes on Escape.
 *
 * @param props - The dish name, its variant family and the choose and close callbacks.
 * @returns The modal dialog.
 */
export function VariantLabDialog({
  dishName,
  family,
  onChoose,
  onClose,
}: {
  readonly dishName: string;
  readonly family: NutritionFamilyView;
  onChoose(variantId: string): void;
  onClose(): void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const current = family.variants.find((variant) => variant.id === family.activeVariantId)
    ?? family.variants[0];

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    return install_focus_trap(dialog, {
      selector: VARIANT_LAB_FOCUSABLE_SELECTOR,
      shouldSkipHidden: false,
      initialFocus: (_container, focusables) => focusables()[0],
      initialFocusTiming: "frame",
      onEscape: () => onCloseRef.current(),
    });
  }, []);

  return (
    <div className="modal-backdrop nutrition-lab-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="nutrition-lab-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nutrition-lab-title"
        tabIndex={-1}
      >
        <header>
          <div>
            <span>Variant Lab</span>
            <h2 id="nutrition-lab-title">Tune {dishName}</h2>
          </div>
          <button type="button" aria-label="Close Variant Lab" onClick={onClose}>×</button>
        </header>
        <p className="nutrition-lab-intro">
          Choose the version this stall will serve. Every variant has its own nutrition and health
          ratings; the dish&apos;s taste-and-popularity star rating stays the same.
        </p>
        <div className="nutrition-variant-list" role="radiogroup" aria-label={`${dishName} version`}>
          {family.variants.map((variant) => {
            const profile = variant.profile;
            const inputId = `nutrition-variant-${variant.id}`;
            return (
              <article key={variant.id} data-locked={!variant.unlocked} data-selected={variant.selected}>
                <label htmlFor={inputId}>
                  <input
                    id={inputId}
                    type="radio"
                    name={`variant-${family.dishId}`}
                    checked={variant.selected}
                    disabled={!variant.unlocked}
                    onChange={() => onChoose(variant.id)}
                  />
                  <span>
                    <strong>{variant.label}</strong>
                    <small>{variant.unlocked ? (variant.selected ? "Currently served" : "Available now") : `Unlocks at mastery rank ${variant.unlockRank}`}</small>
                  </span>
                </label>
                <NutritionProfileSummary profile={profile} starRating={family.starRating} />
                {current && current.id !== variant.id ? (
                  <dl className="nutrition-delta-list" aria-label={`Compared with ${current.label}`}>
                    {COMPARISON_METRICS.map((metric) => (
                      <div key={metric}>
                        <dt>{METRIC_COPY[metric].label}</dt>
                        <dd>{comparisonText(current.profile?.[metric], profile?.[metric])}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </article>
            );
          })}
        </div>
        <footer>
          <p>Changes apply to future orders only and are freely reversible.</p>
          <button type="button" className="primary-button" onClick={onClose}>Done</button>
        </footer>
      </section>
    </div>
  );
}

/**
 * Renders the inspector for the selected customer's nutrition intent, order and result.
 *
 * When the inspector held focus as it unmounts, it calls `onRestoreFocus` on the next frame.
 *
 * @param props - The customer view, the labelling callbacks and the close and focus callbacks.
 * @returns The inspector panel.
 */
export function CustomerNutritionInspector({
  customer,
  dishLabel,
  starRating,
  variantLabel,
  personaLabel,
  onClose,
  onRestoreFocus,
}: {
  readonly customer: CustomerNutritionView;
  dishLabel(dishId: string): string;
  starRating?(dishId: string): number | undefined;
  variantLabel(dishId: string, variantId: string): string | undefined;
  personaLabel(archetypeId: string): string;
  onClose(): void;
  onRestoreFocus?(): void;
}) {
  const inspectorRef = useRef<HTMLElement>(null);
  const ownsFocusRef = useRef(false);
  const restoreFocusRef = useRef(onRestoreFocus);
  useEffect(() => {
    restoreFocusRef.current = onRestoreFocus;
  }, [onRestoreFocus]);
  useEffect(() => () => {
    if (ownsFocusRef.current) {
      requestAnimationFrame(() => restoreFocusRef.current?.());
    }
  }, []);
  const intent = intentLabel(customer.intentId);
  const selectedVariantLabel = customer.dishId && customer.variantId
    ? variantLabel(customer.dishId, customer.variantId)
    : undefined;
  const healthConditions = customer.healthConditionIds ?? [];
  const healthDecisionReasons = customer.healthDecisionReasons ?? [];
  const orderedStarRating = customer.dishId ? starRating?.(customer.dishId) : undefined;
  const resultCopy = customer.requestResult === "matched"
    ? `Matched · ${INTENT_MATCH_COPY[customer.intentId ?? ""] ?? "Visit intent"}`
    : customer.requestResult === "missed"
      ? `Trade-off · ${INTENT_TRADE_OFF_COPY[customer.intentId ?? ""] ?? "Another factor won the choice"}`
      : customer.requestResult === "unknown"
        ? "Data note · Comparison not available"
        : undefined;
  const healthResultCopy = customer.healthPreferenceResult === "matched"
    ? "Health preference matched"
    : customer.healthPreferenceResult === "missed"
      ? "Health trade-off"
      : customer.healthPreferenceResult === "unknown"
        ? "Health comparison unavailable"
        : undefined;
  const healthImpactCopy = typeof customer.healthImpact === "number"
    ? `${customer.healthImpact >= 0 ? "+" : ""}${customer.healthImpact.toFixed(2)} satisfaction`
    : undefined;
  return (
    <section
      ref={inspectorRef}
      className="customer-nutrition-inspector"
      aria-labelledby="customer-inspector-title"
      onFocusCapture={() => {
        ownsFocusRef.current = true;
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          ownsFocusRef.current = false;
        }
      }}
    >
      <header>
        <div>
          <span>Selected guest</span>
          <h3 id="customer-inspector-title">{personaLabel(customer.archetypeId)}</h3>
        </div>
        <button type="button" aria-label="Close customer inspector" onClick={onClose}>×</button>
      </header>
      <p className="customer-state">{customer.status.replaceAll("-", " ")}</p>
      <div className="customer-reason-chips">
        {intent ? <span>Intent · {intent}</span> : <span>No nutrition intent this visit</span>}
        {resultCopy ? <span data-result={customer.requestResult}>{resultCopy}</span> : null}
        {healthResultCopy ? (
          <span data-result={customer.healthPreferenceResult}>{healthResultCopy}</span>
        ) : null}
      </div>
      <div className="customer-health-context">
        <strong>Health needs affecting this visit</strong>
        {healthConditions.length > 0 ? (
          <ul aria-label="Customer simulated health conditions">
            {healthConditions.map((condition) => (
              <li key={condition}>
                {HEALTH_CONDITION_LABELS[condition] ?? condition.replaceAll("-", " ")}
              </li>
            ))}
          </ul>
        ) : (
          <p>No simulated chronic condition affects this visit.</p>
        )}
        {healthImpactCopy ? (
          <p className="customer-health-impact">
            <strong>Customer stat effect</strong> · {healthImpactCopy}
          </p>
        ) : null}
      </div>
      {healthDecisionReasons.length > 0 ? (
        <div className="customer-decision-reasons is-health">
          <strong>Why this personal health fit</strong>
          <ul>
            {healthDecisionReasons.slice(0, 4).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {customer.decisionReasons.length > 0 ? (
        <div className="customer-decision-reasons">
          <strong>Why this choice</strong>
          <ul>
            {customer.decisionReasons.slice(0, 2).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {customer.dishId ? (
        <div className="customer-order-summary">
          <strong>{dishLabel(customer.dishId)}</strong>
          {selectedVariantLabel ? <small>{selectedVariantLabel}</small> : null}
        </div>
      ) : null}
      <NutritionProfileSummary
        profile={customer.profile}
        starRating={orderedStarRating}
        healthRating={customer.personalizedHealthRating}
        healthLabel={healthConditions.length > 0 ? "Personal health fit" : "Health rating"}
      />
      <p className="nutrition-fiction-note">
        Health conditions and stat effects are simplified game traits, not a diagnosis or advice.
      </p>
    </section>
  );
}

/**
 * Renders the note that the nutrition data and ratings are educational, not advice.
 *
 * @returns The disclosure.
 */
export function NutritionDisclosure() {
  return (
    <details className="nutrition-disclosure">
      <summary>Nutrition data &amp; education note</summary>
      <p>
        Hawker Balance is an educational game, not medical or dietary advice. Nutrition values
        describe the listed serving in the supplied CSV data; recipes and portions vary. The Health
        rating is a comparative in-game balance score derived from that serving and can change by
        variant. The Star rating separately represents taste and popularity. A customer&apos;s personal
        health fit also reflects their fictional condition and can slightly affect satisfaction.
        These scores are game mechanics—not a diagnosis, health certification, or personal medical
        advice. Total sugar is not the same as added sugar.
      </p>
    </details>
  );
}
