/**
 * The left rail's "Today" strip and the next-unlock signpost.
 *
 * `TodayStrip` shows the neighbourhood's day card, a 10:30–18:30 timeline of the day's lunch
 * and dinner crowds with the last-orders mark, the clock and the food writer's visit, the rush
 * notice (in a polite live region, so it is announced once as it changes), the writer's review
 * status and tomorrow's forecast. A centre without a neighbourhood keeps the static layout tip
 * the strip replaced, byte for byte, so the server render is unchanged. `NextUnlockSignpost`
 * names the nearest locked item, how far along it is and one thing that moves it closer.
 *
 * Both are presentational and read only the snapshot fields they are given. Every marker on
 * the timeline pairs a glyph or word with its colour, and the timeline itself is one image
 * with a text description, so nothing relies on colour, motion or sight alone.
 */
import type {
  RuntimeNeighbourhood,
  RuntimeNextUnlock,
  RuntimeWriterVisit,
} from "@/src/game/runtime/types";
import {
  describe_writer_verdict,
  format_minute_of_day,
  format_minute_range,
  format_progress_percent,
} from "../display";

/**
 * Place a minute of the day along the timeline.
 *
 * @param minute - The minute to place.
 * @param opening_minute - The timeline's first minute.
 * @param closing_minute - The timeline's last minute.
 * @returns The share of the timeline before the minute, from 0 to 1.
 */
export function get_timeline_share(
  minute: number,
  opening_minute: number,
  closing_minute: number,
): number {
  const span = Math.max(1, closing_minute - opening_minute);
  return Math.min(1, Math.max(0, (minute - opening_minute) / span));
}

/**
 * Format a share of the timeline as a CSS length.
 *
 * @param share - The share, from 0 to 1.
 * @returns The percentage, such as `"25%"`.
 */
function format_share(share: number): string {
  return `${share * 100}%`;
}

/**
 * Describe the timeline in words, for the image's accessible name.
 *
 * @param neighbourhood - The day's hours, crowds, clock and writer visit.
 * @returns One sentence per part of the timeline.
 */
export function describe_timeline(neighbourhood: RuntimeNeighbourhood): string {
  const parts = [
    `Opening hours ${format_minute_of_day(neighbourhood.openingMinute)} to ${format_minute_of_day(neighbourhood.closingMinute)}.`,
    ...neighbourhood.rushWindows.map(
      (window) =>
        `${window.label} crowd ${format_minute_range(window.startMinute, window.endMinute)}.`,
    ),
    `Last orders ${format_minute_of_day(neighbourhood.lastOrdersMinute)}.`,
  ];
  if (neighbourhood.writer) {
    parts.push(
      `Food writer reviewing ${format_minute_range(neighbourhood.writer.windowStartMinute, neighbourhood.writer.windowEndMinute)}.`,
    );
  }
  parts.push(`Now ${format_minute_of_day(neighbourhood.minuteOfDay)}.`);
  return parts.join(" ");
}

/**
 * Describe how far the food writer's review has got.
 *
 * @param writer - Today's writer visit.
 * @returns A short status line.
 */
export function describe_writer_status(writer: RuntimeWriterVisit): string {
  if (writer.status === "upcoming") {
    return `Arrives at ${format_minute_of_day(writer.windowStartMinute)}.`;
  }
  if (writer.status === "reviewing" || writer.outcome === "pending") {
    if (writer.visitCount === 0) return "Reviewing now · no meals counted yet.";
    const meals = writer.visitCount === 1 ? "1 meal" : `${writer.visitCount} meals`;
    return `Reviewing now · ${meals} so far, averaging ${Math.round(writer.averageScore)}.`;
  }
  return describe_writer_verdict(writer.stallName, writer.outcome).text;
}

/** The props of {@link TodayStrip}. */
export interface TodayStripProps {
  /** The neighbourhood view; without it the strip shows the layout tip. */
  readonly neighbourhood?: RuntimeNeighbourhood;
}

/**
 * Render the "Today" strip, or the layout tip for a centre without a neighbourhood.
 *
 * @param props - See {@link TodayStripProps}.
 * @returns The strip or the tip card.
 */
export function TodayStrip({ neighbourhood }: TodayStripProps) {
  if (!neighbourhood) {
    return (
      <section className="tip-card">
        <span aria-hidden="true">✦</span>
        <div>
          <strong>Layout tip</strong>
          <p>Leave two tiles before popular stall queues to reduce crowd knots.</p>
        </div>
      </section>
    );
  }

  const { openingMinute, closingMinute, writer } = neighbourhood;
  const share = (minute: number) => get_timeline_share(minute, openingMinute, closingMinute);
  const offset = (minute: number) => format_share(share(minute));

  return (
    <section className="today-strip" aria-labelledby="today-strip-title">
      <div className="card-kicker">
        <span>Today</span>
        {neighbourhood.activeRush ? (
          <span>{neighbourhood.activeRush === "lunch" ? "Lunch rush" : "Dinner rush"}</span>
        ) : null}
      </div>
      <h2 id="today-strip-title">{neighbourhood.today.name}</h2>
      <p>{neighbourhood.today.summary}</p>
      <div className="today-timeline" role="img" aria-label={describe_timeline(neighbourhood)}>
        <div className="today-timeline-track">
          {neighbourhood.rushWindows.map((window) => (
            <span
              key={window.kind}
              className="today-band"
              data-kind={window.kind}
              data-active={neighbourhood.activeRush === window.kind}
              style={{
                left: offset(window.startMinute),
                width: format_share(share(window.endMinute) - share(window.startMinute)),
              }}
            >
              {window.label}
            </span>
          ))}
          <span
            className="today-last-orders"
            style={{ left: offset(neighbourhood.lastOrdersMinute) }}
          />
          {writer ? (
            <span className="today-writer-mark" style={{ left: offset(writer.windowStartMinute) }}>
              ✎
            </span>
          ) : null}
          <span className="today-now" style={{ left: offset(neighbourhood.minuteOfDay) }} />
        </div>
        <div className="today-timeline-axis">
          <span>{format_minute_of_day(openingMinute)}</span>
          <span>Last orders {format_minute_of_day(neighbourhood.lastOrdersMinute)}</span>
        </div>
      </div>
      <p className="today-notice" aria-live="polite">
        {neighbourhood.rushNotice ?? ""}
      </p>
      {writer ? (
        <p className="today-writer" data-status={writer.status}>
          <span aria-hidden="true">✎</span> Food writer reviewing {writer.stallName}{" "}
          {format_minute_range(writer.windowStartMinute, writer.windowEndMinute)} · needs an average
          of {writer.threshold}
          <small>{describe_writer_status(writer)}</small>
        </p>
      ) : null}
      <p className="today-tomorrow">
        <strong>Tomorrow:</strong> {neighbourhood.tomorrow.name} — {neighbourhood.tomorrow.forecast}
      </p>
      {neighbourhood.isWriterTomorrow ? (
        <p className="today-tomorrow">
          <span aria-hidden="true">✎</span> A food writer plans to visit tomorrow.
        </p>
      ) : null}
    </section>
  );
}

/** The props of {@link NextUnlockSignpost}. */
export interface NextUnlockSignpostProps {
  /** The nearest locked item, or `undefined` once everything is unlocked. */
  readonly nextUnlock?: RuntimeNextUnlock;
}

/**
 * Render the next-unlock signpost: the item's name, a progress bar and its hint.
 *
 * @param props - See {@link NextUnlockSignpostProps}.
 * @returns The signpost, or nothing once everything is unlocked.
 */
export function NextUnlockSignpost({ nextUnlock }: NextUnlockSignpostProps) {
  if (!nextUnlock) return null;
  const percent = Math.round(Math.min(1, Math.max(0, nextUnlock.progress)) * 100);
  return (
    <section className="next-unlock-card" aria-labelledby="next-unlock-title">
      <div className="card-kicker">
        <span>Next up</span>
        <span>{percent}%</span>
      </div>
      <strong id="next-unlock-title">{nextUnlock.name}</strong>
      <div className="objective-progress" aria-hidden="true">
        <span style={{ width: format_progress_percent(percent, 100) }} />
      </div>
      <p>{nextUnlock.hint}</p>
    </section>
  );
}
