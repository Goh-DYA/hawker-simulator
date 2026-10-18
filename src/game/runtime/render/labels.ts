/**
 * The label pool: the few live text labels the world still needs (queue counts and any label
 * a renderer places through the context) are retained Phaser `Text` objects that are moved and
 * retyped in place between renders instead of being destroyed and recreated.
 *
 * Phaser is imported as a type only; the pool receives a text factory from the scene.
 */
import type Phaser from "phaser";

import { DEPTH_LABELS } from "./geometry";

/** The default label colour, the interface ink. */
export const LABEL_INK = "#17352e";

/** The subset of a Phaser text object the pool drives. */
export interface PoolText {
  setPosition(x: number, y: number): unknown;
  setText(text: string): unknown;
  setColor(colour: string): unknown;
  setVisible(visible: boolean): unknown;
  setOrigin(x: number, y: number): unknown;
  setDepth(depth: number): unknown;
  destroy(): void;
}

/** Creates a text object in the scene's label style. */
export type TextFactory = (x: number, y: number, text: string, colour: string) => PoolText;

/** The Phaser text style of every world label. */
export const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  color: LABEL_INK,
  fontFamily: '"Avenir Next", "Segoe UI", "Trebuchet MS", system-ui, sans-serif',
  fontSize: "11px",
  fontStyle: "bold",
  align: "center",
  backgroundColor: "#fffaf0e6",
  padding: { x: 5, y: 2 },
};

interface PooledLabel {
  readonly text: PoolText;
  x: number;
  y: number;
  content: string;
  colour: string;
  isVisible: boolean;
}

/**
 * Reuses text objects across renders.
 */
export class LabelPool {
  private readonly labels: PooledLabel[] = [];
  private used = 0;

  /**
   * @param create - Creates a new text object when the pool runs out.
   */
  constructor(private readonly create: TextFactory) {}

  /** Starts a render: every label becomes available again. */
  begin(): void {
    this.used = 0;
  }

  /**
   * Places a label, reusing the next pooled text object.
   *
   * @param x - World x of the label's centre.
   * @param y - World y of the label's centre.
   * @param content - The label text.
   * @param colour - CSS colour of the text.
   */
  place(x: number, y: number, content: string, colour = LABEL_INK): void {
    let label = this.labels[this.used];
    if (!label) {
      const text = this.create(x, y, content, colour);
      text.setOrigin(0.5, 0.5);
      text.setDepth(DEPTH_LABELS);
      label = { text, x, y, content, colour, isVisible: true };
      this.labels.push(label);
    } else {
      if (label.x !== x || label.y !== y) {
        label.text.setPosition(x, y);
        label.x = x;
        label.y = y;
      }
      if (label.content !== content) {
        label.text.setText(content);
        label.content = content;
      }
      if (label.colour !== colour) {
        label.text.setColor(colour);
        label.colour = colour;
      }
      if (!label.isVisible) {
        label.text.setVisible(true);
        label.isVisible = true;
      }
    }
    this.used += 1;
  }

  /** Ends a render: labels not placed this time are hidden. */
  end(): void {
    for (let index = this.used; index < this.labels.length; index += 1) {
      const label = this.labels[index] as PooledLabel;
      if (label.isVisible) {
        label.text.setVisible(false);
        label.isVisible = false;
      }
    }
  }

  /** Destroys every pooled text object. */
  destroy(): void {
    for (const label of this.labels) label.text.destroy();
    this.labels.length = 0;
    this.used = 0;
  }
}
