/**
 * The texture studio: paints a spec into a Phaser canvas texture once, at the device pixel
 * ratio, caches it by its key and adds the sheet frames the painter declares.
 *
 * The studio is the only place the renderer meets the painters: it asks `art/` for a paint
 * plan, creates a canvas texture of the plan's size scaled by the pixel ratio, scales the
 * context so the painter works in world pixels, runs the painter and refreshes the texture.
 * Textures live as long as the scene; the studio releases them all when the scene is
 * destroyed. Phaser is imported as a type only.
 */
import type Phaser from "phaser";

import type { PaintContext } from "../art/canvas";
import { plan_texture } from "../art/index";
import { texture_key, type PaintSpec } from "../art/specs";

/** Largest texture side the studio will create, within every WebGL implementation's limit. */
const MAX_TEXTURE_SIDE = 4096;

/** The pixel ratio textures are painted at on the standard quality mode. */
export const STANDARD_PIXEL_RATIO = 2;
/** The pixel ratio textures are painted at on the lower-end quality mode. */
export const LOWER_END_PIXEL_RATIO = 1;

/** The texture-manager surface the studio uses, so tests can stub it narrowly. */
export interface StudioTextureManager {
  exists(key: string): boolean;
  createCanvas(key: string, width: number, height: number): StudioCanvasTexture | null;
  remove(key: string | Phaser.Textures.Texture): unknown;
}

/** The canvas-texture surface the studio uses. */
export interface StudioCanvasTexture {
  readonly context: CanvasRenderingContext2D;
  readonly canvas: HTMLCanvasElement;
  refresh(): unknown;
  add(
    name: string,
    sourceIndex: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): unknown;
}

/** A painted texture: its key and the scale that maps texture pixels back to world pixels. */
export interface PaintedTexture {
  readonly key: string;
  /** World pixels per texture pixel: `1 / pixelRatio`. */
  readonly scale: number;
  /** World width of the texture. */
  readonly width: number;
  /** World height of the texture. */
  readonly height: number;
}

/**
 * Paints and caches textures for one scene.
 */
export class TextureStudio {
  private readonly painted = new Map<string, PaintedTexture>();

  /**
   * @param textures - The scene's texture manager.
   * @param pixelRatio - Texture pixels per world pixel.
   */
  constructor(
    private readonly textures: StudioTextureManager,
    private pixelRatio: number,
  ) {}

  /**
   * Changes the pixel ratio for textures painted from now on; existing textures are kept.
   *
   * @param pixelRatio - Texture pixels per world pixel.
   */
  set_pixel_ratio(pixelRatio: number): void {
    this.pixelRatio = pixelRatio;
  }

  /**
   * Returns the painted texture for a spec, painting it on first use.
   *
   * @param spec - The paint spec.
   * @returns The texture key and its world scale.
   */
  ensure(spec: PaintSpec): PaintedTexture {
    const key = texture_key(spec);
    const cached = this.painted.get(key);
    if (cached) return cached;
    const plan = plan_texture(spec);
    const ratio = Math.min(this.pixelRatio, MAX_TEXTURE_SIDE / Math.max(plan.width, plan.height));
    const texture = this.create_texture(key, plan.width, plan.height, ratio);
    if (texture) {
      const context = texture.context as unknown as PaintContext;
      context.save();
      context.scale(ratio, ratio);
      plan.paint(context);
      context.restore();
      for (const frame of plan.frames ?? []) {
        texture.add(
          frame.name,
          0,
          frame.x * ratio,
          frame.y * ratio,
          frame.width * ratio,
          frame.height * ratio,
        );
      }
      texture.refresh();
    }
    const painted: PaintedTexture = {
      key,
      scale: 1 / ratio,
      width: plan.width,
      height: plan.height,
    };
    this.painted.set(key, painted);
    return painted;
  }

  /**
   * Paints a spec into a texture and returns its canvas as a PNG data URL, for HUD thumbnails.
   *
   * @param spec - The paint spec.
   * @returns The data URL, or undefined when the texture could not be created.
   */
  data_url(spec: PaintSpec): string | undefined {
    this.ensure(spec);
    const key = texture_key(spec);
    const texture = this.sources.get(key);
    return texture?.canvas.toDataURL();
  }

  /**
   * Removes one texture from the cache and the texture manager.
   *
   * @param key - The texture key.
   */
  release(key: string): void {
    if (!this.painted.delete(key)) return;
    this.sources.delete(key);
    if (this.textures.exists(key)) this.textures.remove(key);
  }

  /** Removes every texture the studio painted. */
  release_all(): void {
    for (const key of [...this.painted.keys()]) this.release(key);
  }

  private readonly sources = new Map<string, StudioCanvasTexture>();

  private create_texture(
    key: string,
    width: number,
    height: number,
    ratio: number,
  ): StudioCanvasTexture | undefined {
    if (this.textures.exists(key)) this.textures.remove(key);
    const texture = this.textures.createCanvas(
      key,
      Math.max(1, Math.ceil(width * ratio)),
      Math.max(1, Math.ceil(height * ratio)),
    );
    if (!texture) return undefined;
    this.sources.set(key, texture);
    return texture;
  }
}
