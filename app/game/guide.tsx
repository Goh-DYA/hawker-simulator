/**
 * The building blocks of the tutorial and practice-day copy: a list of short points, each with
 * a small icon, and a row of chips with arrows for a sequence, such as a guest's visit.
 *
 * Young players read a few short lines with a picture each more easily than a paragraph, so the
 * tutorial cards and the practice coach build their copy from these. The icons are decoration:
 * they are hidden from assistive technology, and each point's text stands on its own.
 */

/** One short line of guide copy and its icon. */
export interface GuidePoint {
  /** A small emoji or glyph shown before the text. */
  readonly icon: string;
  /** The line itself, one short sentence. */
  readonly text: string;
}

/** The props of {@link GuidePoints}. */
export interface GuidePointsProps {
  /** The points, in reading order. */
  readonly points: readonly GuidePoint[];
}

/**
 * Render guide points as a list, one icon and line per item.
 *
 * @param props - See {@link GuidePointsProps}.
 * @returns The list.
 */
export function GuidePoints({ points }: GuidePointsProps) {
  return (
    <ul className="guide-points">
      {points.map((point) => (
        <li key={point.text}>
          <span className="guide-icon" aria-hidden="true">
            {point.icon}
          </span>
          <span>{point.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** The props of {@link GuideFlow}. */
export interface GuideFlowProps {
  /** The stages, in order. */
  readonly stages: readonly string[];
  /** The list's accessible name, such as "A guest's visit". */
  readonly label: string;
}

/**
 * Render a sequence as chips joined by arrows; assistive technology reads an ordered list.
 *
 * @param props - See {@link GuideFlowProps}.
 * @returns The ordered list.
 */
export function GuideFlow({ stages, label }: GuideFlowProps) {
  return (
    <ol className="guide-flow" aria-label={label}>
      {stages.map((stage) => (
        <li key={stage}>{stage}</li>
      ))}
    </ol>
  );
}
