/**
 * Retained sprite bookkeeping: a slot wraps one Phaser image and remembers what it was last
 * told, so a render only issues the setter calls whose values changed; a slot map keys slots by
 * a stable ID, hands them out during a render and destroys the ones nothing claimed.
 *
 * Phaser is imported as a type only; the images come from the scene's factory.
 */
import type Phaser from "phaser";

/** The image surface a slot drives. */
export interface SlotImage {
  setTexture(key: string, frame?: string): unknown;
  setFrame(frame: string): unknown;
  setPosition(x: number, y: number): unknown;
  setOrigin(x: number, y: number): unknown;
  setScale(x: number, y?: number): unknown;
  setAngle(degrees: number): unknown;
  setDepth(depth: number): unknown;
  setAlpha(alpha: number): unknown;
  setTint(colour: number): unknown;
  clearTint(): unknown;
  setBlendMode(mode: string | number | Phaser.BlendModes): unknown;
  setVisible(visible: boolean): unknown;
  setFlipX(flipped: boolean): unknown;
  destroy(): void;
}

/** Creates an image showing a texture at a point. */
export type ImageFactory = (x: number, y: number, key: string, frame?: string) => SlotImage;

/** Everything a slot can be told in one render. */
export interface SlotState {
  readonly key: string;
  readonly frame?: string;
  readonly x: number;
  readonly y: number;
  readonly originX?: number;
  readonly originY?: number;
  readonly scale?: number;
  readonly angle?: number;
  readonly depth: number;
  readonly alpha?: number;
  readonly tint?: number;
  readonly blend?: "NORMAL" | "ADD" | "MULTIPLY" | "SCREEN";
  /** True to mirror the image horizontally (a west-facing person drawn from the east frame). */
  readonly isFlipped?: boolean;
}

/**
 * One retained image and the state it was last given.
 */
export class SpriteSlot {
  private key = "";
  private frame: string | undefined;
  private x = Number.NaN;
  private y = Number.NaN;
  private originX = 0.5;
  private originY = 0.5;
  private scale = 1;
  private angle = 0;
  private depth = Number.NaN;
  private alpha = 1;
  private tint: number | undefined;
  private blend: SlotState["blend"] = "NORMAL";
  private isFlipped = false;
  private isVisible = true;

  /**
   * @param image - The image to drive; created showing the first state's texture.
   */
  constructor(readonly image: SlotImage) {}

  /**
   * Applies a state, calling only the setters whose values changed.
   *
   * @param next - The state for this render.
   */
  apply(next: SlotState): void {
    if (next.key !== this.key) {
      this.image.setTexture(next.key, next.frame);
      this.key = next.key;
      this.frame = next.frame;
    } else if (next.frame !== this.frame && next.frame !== undefined) {
      this.image.setFrame(next.frame);
      this.frame = next.frame;
    }
    if (next.x !== this.x || next.y !== this.y) {
      this.image.setPosition(next.x, next.y);
      this.x = next.x;
      this.y = next.y;
    }
    const originX = next.originX ?? 0.5;
    const originY = next.originY ?? 0.5;
    if (originX !== this.originX || originY !== this.originY) {
      this.image.setOrigin(originX, originY);
      this.originX = originX;
      this.originY = originY;
    }
    const scale = next.scale ?? 1;
    if (scale !== this.scale) {
      this.image.setScale(scale, scale);
      this.scale = scale;
    }
    const angle = next.angle ?? 0;
    if (angle !== this.angle) {
      this.image.setAngle(angle);
      this.angle = angle;
    }
    if (next.depth !== this.depth) {
      this.image.setDepth(next.depth);
      this.depth = next.depth;
    }
    const alpha = next.alpha ?? 1;
    if (alpha !== this.alpha) {
      this.image.setAlpha(alpha);
      this.alpha = alpha;
    }
    if (next.tint !== this.tint) {
      if (next.tint === undefined) this.image.clearTint();
      else this.image.setTint(next.tint);
      this.tint = next.tint;
    }
    const blend = next.blend ?? "NORMAL";
    if (blend !== this.blend) {
      this.image.setBlendMode(blend);
      this.blend = blend;
    }
    const isFlipped = next.isFlipped ?? false;
    if (isFlipped !== this.isFlipped) {
      this.image.setFlipX(isFlipped);
      this.isFlipped = isFlipped;
    }
    if (!this.isVisible) {
      this.image.setVisible(true);
      this.isVisible = true;
    }
  }

  /** Hides the image without destroying it. */
  hide(): void {
    if (this.isVisible) {
      this.image.setVisible(false);
      this.isVisible = false;
    }
  }

  /** Destroys the image. */
  destroy(): void {
    this.image.destroy();
  }
}

/**
 * Slots keyed by a stable ID; unclaimed slots are destroyed at the end of each render.
 */
export class SlotMap {
  private readonly slots = new Map<string, SpriteSlot>();
  private readonly claimed = new Set<string>();

  /**
   * @param createImage - The scene's image factory.
   */
  constructor(private readonly createImage: ImageFactory) {}

  /**
   * Claims the slot for an ID and applies a state, creating the image on first claim.
   *
   * @param id - The stable ID, such as an object ID or `customer-7:tray`.
   * @param state - The state for this render.
   * @returns The slot.
   */
  draw(id: string, state: SlotState): SpriteSlot {
    let slot = this.slots.get(id);
    if (!slot) {
      slot = new SpriteSlot(this.createImage(state.x, state.y, state.key, state.frame));
      this.slots.set(id, slot);
    }
    slot.apply(state);
    this.claimed.add(id);
    return slot;
  }

  /** Destroys every slot that was not drawn since the previous sweep. */
  sweep(): void {
    for (const [id, slot] of this.slots) {
      if (this.claimed.has(id)) continue;
      slot.destroy();
      this.slots.delete(id);
    }
    this.claimed.clear();
  }

  /** Destroys every slot. */
  destroy(): void {
    for (const slot of this.slots.values()) slot.destroy();
    this.slots.clear();
    this.claimed.clear();
  }
}
