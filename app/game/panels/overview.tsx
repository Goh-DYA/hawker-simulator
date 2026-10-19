/**
 * The overview panels of the game screen: the objective card, Focus, Insights and Activity.
 *
 * `ObjectiveCard` is the "Today's focus" card that both the left rail and the Focus panel show;
 * the two copies rendered the same markup, so one component serves both. `FocusPanel` adds the
 * latest Service Review (`ServiceReviewSummary`, so a review can be re-read at any time), the
 * nutrition and service pulses, `InsightsPanel` explains queues, seating (with the trays still
 * waiting for the table-cleaning crew), reputation, milestones, happiness, tray return and the
 * persona roster and offers the hall expansion, and `ActivityPanel` lists the activity feed. They are presentational: the `HawkerSimulator` shell keeps the state, the
 * audio and the runtime calls behind their callbacks. Their classes, ARIA attributes and copy
 * are the shell's former inline markup.
 */
import { CUSTOMER_ARCHETYPES } from "@/src/content";
import { activityEntryMessage, type ActivityEntry } from "@/src/game/runtime/activityFeed";
import { MAP_EXPANSION } from "@/src/game/runtime/rules";
import type { RuntimeDayReport, RuntimeSnapshot } from "@/src/game/runtime/types";
import { NutritionDisclosure, NutritionPulseCard } from "../NutritionEducation";
import {
  ACTIVITY_KIND_GLYPHS,
  CUSTOMER_PERSONAS_BY_UNLOCK,
  dishLabel,
  describe_writer_verdict,
  format_progress_percent,
  get_unlock_reputation,
  is_requirement_met,
  localize,
  money,
  unlockLabel,
} from "../display";

/** The snapshot fields the objective card reads. */
type ObjectiveBoard = Pick<RuntimeSnapshot, "objectives" | "objectiveRefreshLabel">;

/** The props of {@link ObjectiveCard}. */
export interface ObjectiveCardProps {
  /** Today's objectives and the time until they refresh. */
  readonly snapshot: ObjectiveBoard;
}

/**
 * Render the "Today's focus" card: each objective with its progress and reward.
 *
 * @param props - See {@link ObjectiveCardProps}.
 * @returns The objective card.
 */
export function ObjectiveCard({ snapshot }: ObjectiveCardProps) {
  return (
    <section className="objective-card">
      <div className="card-kicker">
        <span>Today&apos;s focus</span>
        <span>Refresh {snapshot.objectiveRefreshLabel}</span>
      </div>
      <h2>Three ways to grow</h2>
      <div className="objective-list">
        {snapshot.objectives.map((objective) => (
          <article key={objective.id} data-complete={objective.completed}>
            <strong>
              {objective.completed ? "✓ " : ""}
              {objective.title}
            </strong>
            <p>{objective.description}</p>
            <div className="objective-progress">
              <span
                style={{ width: format_progress_percent(objective.progress, objective.target) }}
              />
            </div>
            <small>
              {Math.round(objective.progress)} / {objective.target} · ${objective.rewardCash}
              {" + "}
              {objective.rewardXp} XP
            </small>
          </article>
        ))}
        {snapshot.objectives.length === 0 ? (
          <small>Opening today&apos;s objective board…</small>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Describe the seats the table-cleaning crew has still to clear.
 *
 * @param uncleared_trays - Seats holding a tray that has not been cleared yet.
 * @param cleaning_crew - Trays the crew can clear at once.
 * @returns The sentence, or `undefined` when every seat is clear.
 */
export function describe_uncleared_trays(uncleared_trays: number, cleaning_crew: number) {
  if (uncleared_trays <= 0) return undefined;
  return `${uncleared_trays} ${uncleared_trays === 1 ? "seat" : "seats"} waiting for the table-cleaning crew (crew of ${cleaning_crew}).`;
}

/** The props of {@link ServiceReviewSummary}. */
export interface ServiceReviewSummaryProps {
  /** The latest finished day's review. */
  readonly report: RuntimeDayReport;
  /** Whether the player has not read this review yet. */
  readonly isUnread?: boolean;
  /** Opens the full review; the button is left out without it. */
  onOpenReview?(): void;
}

/**
 * Render the latest Service Review in brief: the grade, the three day figures, one thing to
 * try and the food writer's verdict.
 *
 * @param props - See {@link ServiceReviewSummaryProps}.
 * @returns The review card.
 */
export function ServiceReviewSummary({ report, isUnread = false, onOpenReview }: ServiceReviewSummaryProps) {
  const verdict = report.writer
    ? describe_writer_verdict(report.writer.stallName, report.writer.outcome)
    : undefined;
  return (
    <section
      className="service-review-summary"
      aria-labelledby="service-review-summary-title"
      data-unread={isUnread}
    >
      <div className="card-kicker">
        <span>Service review</span>
        {isUnread ? <span className="service-review-new">New</span> : null}
      </div>
      <h3 id="service-review-summary-title">
        Day {report.day} · {report.cardName}
      </h3>
      <p className="service-review-grade">
        <span aria-hidden="true">{report.gradeGlyph}</span> <strong>{report.grade}</strong>
      </p>
      <dl>
        <div>
          <dt>Served</dt>
          <dd>{report.served}</dd>
        </div>
        <div>
          <dt>Left early</dt>
          <dd>{report.leftEarly}</dd>
        </div>
        <div>
          <dt>Takings</dt>
          <dd>{money(report.revenue)}</dd>
        </div>
      </dl>
      {report.focusTip ? (
        <p>
          <strong>One thing to try:</strong> {report.focusTip.label} — {report.focusTip.action}
        </p>
      ) : null}
      {verdict ? (
        <p data-outcome={report.writer?.outcome}>
          <span aria-hidden="true">{verdict.glyph}</span> {verdict.text}
        </p>
      ) : null}
      {onOpenReview ? (
        <button type="button" onClick={onOpenReview}>
          Read the full review
        </button>
      ) : null}
    </section>
  );
}

/** The props of {@link FocusPanel}. */
export interface FocusPanelProps {
  /** The objectives, the nutrition pulse, the service figures and the latest review. */
  readonly snapshot: ObjectiveBoard &
    Pick<
      RuntimeSnapshot,
      | "nutritionPulse"
      | "activeCustomers"
      | "freeSeats"
      | "totalSeats"
      | "hasSatisfactionRatings"
      | "averageSatisfaction"
      | "cleanliness"
    > &
    Partial<Pick<RuntimeSnapshot, "unclearedTrays" | "cleaningCrew" | "neighbourhood">>;
  /** Whether the latest review has not been read yet. */
  readonly isReviewUnread?: boolean;
  /** Called when the player asks to review the dishes from the nutrition pulse. */
  onReviewDishes(): void;
  /** Called when the player opens the full latest review. */
  onOpenReview?(): void;
}

/**
 * Render the Focus panel: the objective card, the latest Service Review when there is one, the
 * nutrition pulse and the service pulse.
 *
 * @param props - See {@link FocusPanelProps}.
 * @returns The Focus panel.
 */
export function FocusPanel({
  snapshot,
  isReviewUnread = false,
  onReviewDishes,
  onOpenReview,
}: FocusPanelProps) {
  const last_report = snapshot.neighbourhood?.lastReport;
  const uncleared_line = describe_uncleared_trays(
    snapshot.unclearedTrays ?? 0,
    snapshot.cleaningCrew ?? 1,
  );
  return (
    <div className="focus-panel">
      <ObjectiveCard snapshot={snapshot} />
      {last_report ? (
        <ServiceReviewSummary
          report={last_report}
          isUnread={isReviewUnread}
          onOpenReview={onOpenReview}
        />
      ) : null}
      <NutritionPulseCard
        pulse={snapshot.nutritionPulse}
        dishLabel={dishLabel}
        onReview={onReviewDishes}
      />
      <section className="service-pulse-card" aria-label="Service pulse">
        <h3>Service pulse</h3>
        <dl>
          <div>
            <dt>Guests inside</dt>
            <dd>{snapshot.activeCustomers}</dd>
          </div>
          <div>
            <dt>Free seats</dt>
            <dd>
              {snapshot.freeSeats}/{snapshot.totalSeats}
            </dd>
          </div>
          <div>
            <dt>Happiness</dt>
            <dd>
              {snapshot.hasSatisfactionRatings
                ? `${Math.round(snapshot.averageSatisfaction)}%`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Cleanliness</dt>
            <dd>{Math.round(snapshot.cleanliness)}%</dd>
          </div>
        </dl>
        {uncleared_line ? <p className="service-pulse-note">{uncleared_line}</p> : null}
      </section>
      <NutritionDisclosure />
    </div>
  );
}

/** The props of {@link InsightsPanel}. */
export interface InsightsPanelProps {
  /** The centre's queue, seating, milestone, happiness, tray, progress and expansion figures. */
  readonly snapshot: Pick<
    RuntimeSnapshot,
    | "queueFlowState"
    | "queueFlowMessage"
    | "queuePressure"
    | "freeSeats"
    | "totalSeats"
    | "claimedMilestoneCount"
    | "milestoneTracks"
    | "hasSatisfactionRatings"
    | "averageSatisfaction"
    | "satisfactionBreakdown"
    | "satisfactionTips"
    | "trayReturnStations"
    | "cleanliness"
    | "level"
    | "reputation"
    | "unlockedContentIds"
    | "cash"
    | "nextExpansionCost"
    | "expansionCount"
  > &
    Partial<Pick<RuntimeSnapshot, "unclearedTrays" | "cleaningCrew" | "peakReputation">>;
  /** Called when the player buys the next hall expansion. */
  onExpandMap(): void;
}

/**
 * Render the Insights panel: one card per centre concern, the persona roster and the expansion.
 *
 * @param props - See {@link InsightsPanelProps}.
 * @returns The Insights panel.
 */
export function InsightsPanel({ snapshot, onExpandMap }: InsightsPanelProps) {
  const unlockedCustomerCount = CUSTOMER_ARCHETYPES.filter((customer) =>
    is_requirement_met(customer.unlockRequirement, snapshot),
  ).length;
  const uncleared_line = describe_uncleared_trays(
    snapshot.unclearedTrays ?? 0,
    snapshot.cleaningCrew ?? 1,
  );

  return (
    <div className="insights-list">
      <article data-state={snapshot.queueFlowState}>
        <span aria-hidden="true">↝</span>
        <div>
          <strong>Queue flow</strong>
          <p>{snapshot.queueFlowMessage}</p>
        </div>
        <em>{Math.round(snapshot.queuePressure)}% used</em>
      </article>
      <article data-state={snapshot.freeSeats < 2 ? "warning" : "good"}>
        <span aria-hidden="true">◒</span>
        <div>
          <strong>Communal seating</strong>
          <p>
            {snapshot.freeSeats < 2
              ? "Very few seats are free. Add a table family or improve turnover."
              : `${snapshot.freeSeats} seats are ready for arriving diners.`}
          </p>
          {uncleared_line ? <p className="seating-clearing-note">{uncleared_line}</p> : null}
        </div>
        <em>
          {snapshot.freeSeats}/{snapshot.totalSeats}
        </em>
      </article>
      {snapshot.peakReputation !== undefined ? (
        <article data-state="neutral">
          <span aria-hidden="true">♥</span>
          <div>
            <strong>Reputation</strong>
            <p>
              Reputation now {Math.round(snapshot.reputation)}. Best reputation reached:{" "}
              {Math.round(get_unlock_reputation(snapshot))} — unlocks use this, so nothing locks
              again after a quieter day.
            </p>
          </div>
          <em>{Math.round(get_unlock_reputation(snapshot))}</em>
        </article>
      ) : null}
      <article data-state="good">
        <span aria-hidden="true">★</span>
        <div>
          <strong>Centre journey</strong>
          <p>{snapshot.claimedMilestoneCount} permanent milestones completed.</p>
          <dl className="milestone-progress-list">
            {snapshot.milestoneTracks.map((track) => (
              <div key={track.id}>
                <dt>
                  {track.title} tier {track.tier}
                </dt>
                <dd>
                  {Math.round(track.progress).toLocaleString()} / {track.target.toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <em>{snapshot.claimedMilestoneCount}/16</em>
      </article>
      <article
        data-state={
          snapshot.hasSatisfactionRatings && snapshot.averageSatisfaction < 70 ? "warning" : "good"
        }
      >
        <span aria-hidden="true">♥</span>
        <div>
          <strong>Guest happiness</strong>
          <p>
            {snapshot.hasSatisfactionRatings
              ? `Recent guest visits average ${Math.round(snapshot.averageSatisfaction)}%.`
              : "Complete a visit to receive the first rating."}
          </p>
          {snapshot.satisfactionBreakdown ? (
            <dl className="happiness-breakdown" aria-label="Guest happiness factors">
              {[
                ["Food", snapshot.satisfactionBreakdown.foodQuality],
                ["Wait", snapshot.satisfactionBreakdown.wait],
                ["Value", snapshot.satisfactionBreakdown.value],
                ["Route efficiency", snapshot.satisfactionBreakdown.walking],
                ["Comfort", snapshot.satisfactionBreakdown.comfort],
                ["Cleanliness", snapshot.satisfactionBreakdown.cleanliness],
                ["Ambience", snapshot.satisfactionBreakdown.ambience],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd aria-label={`${label} ${Math.round(Number(value))} out of 100`}>
                    {Math.round(Number(value))}/100
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {snapshot.satisfactionTips.length ? (
            <div className="happiness-advice">
              <b>Ways to improve</b>
              <ul>
                {snapshot.satisfactionTips.map((tip) => (
                  <li key={tip.factor}>
                    <strong>
                      {tip.label} · {Math.round(tip.score)}
                    </strong>
                    <span>{tip.action}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <em>
          {snapshot.hasSatisfactionRatings ? `${Math.round(snapshot.averageSatisfaction)}%` : "—"}
        </em>
      </article>
      <article
        data-state={
          snapshot.trayReturnStations === 0 || snapshot.cleanliness < 70 ? "warning" : "good"
        }
      >
        <span aria-hidden="true">↺</span>
        <div>
          <strong>Tray return</strong>
          <p>
            {snapshot.trayReturnStations === 0
              ? "There is no usable tray-return station. Add a return rack on a clear exit route."
              : snapshot.cleanliness < 70
                ? "Tray-return capacity is strained. Add a visible rack near an exit route."
                : `${snapshot.trayReturnStations} return point${snapshot.trayReturnStations === 1 ? " is" : "s are"} visible and tables are turning over cleanly.`}
          </p>
        </div>
        <em>{Math.round(snapshot.cleanliness)}%</em>
      </article>
      <article data-state="neutral">
        <span aria-hidden="true">◎</span>
        <div>
          <strong>Customer personas</strong>
          <p>
            {unlockedCustomerCount} of {CUSTOMER_ARCHETYPES.length} distinct behaviour profiles can
            currently visit.
          </p>
          <details className="persona-roster">
            <summary>Browse the persona roster</summary>
            <ul>
              {CUSTOMER_PERSONAS_BY_UNLOCK.map((customer) => {
                const unlocked = is_requirement_met(customer.unlockRequirement, snapshot);
                return (
                  <li key={customer.id} data-locked={!unlocked}>
                    <strong>{localize(customer.nameKey)}</strong>
                    <span>{localize(customer.descriptionKey)}</span>
                    <small>
                      {unlocked
                        ? "Can visit now"
                        : unlockLabel(
                            customer,
                            snapshot.level,
                            get_unlock_reputation(snapshot),
                            snapshot.unlockedContentIds,
                          )}
                    </small>
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
        <em>
          {unlockedCustomerCount}/{CUSTOMER_ARCHETYPES.length}
        </em>
      </article>
      <button
        type="button"
        className="expansion-button"
        disabled={
          snapshot.level < MAP_EXPANSION.minimumLevel || snapshot.cash < snapshot.nextExpansionCost
        }
        onClick={onExpandMap}
      >
        <span>Expand hall · plot {snapshot.expansionCount + 1}</span>
        <strong>
          {snapshot.level < MAP_EXPANSION.minimumLevel
            ? `Unlocks at level ${MAP_EXPANSION.minimumLevel}`
            : money(snapshot.nextExpansionCost)}
        </strong>
        <small>{`Add ${MAP_EXPANSION.addColumns} × ${MAP_EXPANSION.addRows} buildable tiles`}</small>
      </button>
    </div>
  );
}

/** The props of {@link ActivityPanel}. */
export interface ActivityPanelProps {
  /** The activity feed, latest first. */
  readonly activityEntries: readonly ActivityEntry[];
  /** Called when the player clears the feed. */
  onClear(): void;
}

/**
 * Render the Activity panel: the feed with its Clear button, or the empty state.
 *
 * @param props - See {@link ActivityPanelProps}.
 * @returns The Activity panel.
 */
export function ActivityPanel({ activityEntries, onClear }: ActivityPanelProps) {
  return (
    <div className="activity-panel">
      <div className="activity-toolbar">
        <span>Latest first · routine events stay here</span>
        <button type="button" disabled={activityEntries.length === 0} onClick={onClear}>
          Clear
        </button>
      </div>
      {activityEntries.length === 0 ? (
        <div className="activity-empty">
          <span aria-hidden="true">◎</span>
          <strong>No activity yet</strong>
          <p>Sales, build actions and centre updates will appear here.</p>
        </div>
      ) : (
        <div className="activity-list">
          {activityEntries.map((entry) => (
            <article
              key={entry.id}
              data-kind={entry.kind}
              data-importance={entry.importance ?? "routine"}
            >
              <span aria-hidden="true">{ACTIVITY_KIND_GLYPHS[entry.kind]}</span>
              <div>
                <strong>
                  {entry.kind === "success"
                    ? "Completed"
                    : entry.kind === "warning"
                      ? "Attention"
                      : entry.kind === "error"
                        ? "Problem"
                        : "Update"}
                </strong>
                <p>{activityEntryMessage(entry)}</p>
              </div>
              {entry.count > 1 ? <em>×{entry.count}</em> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
