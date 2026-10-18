/**
 * Tests for the texture studio in `runtime/render/textures.ts`: one painted texture per key,
 * device-pixel-ratio scaling, sheet frames, the texture-side cap, release and data URLs.
 */
import { describe, expect, it } from "vitest";

import {
  CUSTOMER_POSES,
  OVERHANG,
  SHEET_FACINGS,
  type PaintSpec,
} from "@/src/game/runtime/art/specs";
import {
  STANDARD_PIXEL_RATIO,
  TextureStudio,
  type StudioCanvasTexture,
  type StudioTextureManager,
} from "@/src/game/runtime/render/textures";
import { visualRecipeForPlaceable } from "@/src/game/runtime/visuals/placeable";
import { createGridMap } from "@/src/game/core";

/** A canvas texture stand-in that records the context scale, the frames and the refreshes. */
interface FakeTexture extends StudioCanvasTexture {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  readonly scales: number[][];
  readonly frames: string[];
  refreshes: number;
}

/** A texture manager stand-in that records every create and remove. */
class FakeTextureManager implements StudioTextureManager {
  readonly created: FakeTexture[] = [];
  readonly removed: string[] = [];
  private readonly live = new Map<string, FakeTexture>();

  exists(key: string): boolean {
    return this.live.has(key);
  }

  createCanvas(key: string, width: number, height: number): FakeTexture {
    const scales: number[][] = [];
    const frames: string[] = [];
    const context = new Proxy({} as CanvasRenderingContext2D, {
      get(_target, property) {
        if (property === "scale") return (x: number, y: number) => scales.push([x, y]);
        return () => context;
      },
      set() {
        return true;
      },
    });
    const texture: FakeTexture = {
      key,
      width,
      height,
      scales,
      frames,
      refreshes: 0,
      context,
      canvas: { toDataURL: () => `data:${key}` } as unknown as HTMLCanvasElement,
      refresh() {
        texture.refreshes += 1;
      },
      add(name: string) {
        frames.push(name);
      },
    };
    this.created.push(texture);
    this.live.set(key, texture);
    return texture;
  }

  remove(key: string | { key: string }): void {
    const name = typeof key === "string" ? key : key.key;
    this.removed.push(name);
    this.live.delete(name);
  }
}

/** A 1 x 1 stool spec. */
const STOOL_SPEC: PaintSpec = {
  kind: "placeable",
  definitionId: "item.stacking-stool",
  category: "seat",
  recipe: visualRecipeForPlaceable("item.stacking-stool", "seat", []),
  tags: [],
  rotation: 0,
  width: 48,
  height: 48,
  motion: 0,
  frame: { isHighContrast: false, isLowDetail: false },
};

describe("TextureStudio", () => {
  it("paints a spec once per key at the pixel ratio and returns the world scale", () => {
    const manager = new FakeTextureManager();
    const studio = new TextureStudio(manager, STANDARD_PIXEL_RATIO);

    const first = studio.ensure(STOOL_SPEC);
    const second = studio.ensure(STOOL_SPEC);

    expect(second).toBe(first);
    expect(manager.created).toHaveLength(1);
    const texture = manager.created[0] as FakeTexture;
    expect([texture.width, texture.height]).toEqual([48 * 2, (48 + OVERHANG) * 2]);
    expect(texture.scales).toEqual([[2, 2]]);
    expect(texture.refreshes).toBe(1);
    expect(first).toEqual({ key: texture.key, scale: 0.5, width: 48, height: 48 + OVERHANG });
  });

  it("adds every sheet frame of a customer sheet, scaled by the pixel ratio", () => {
    const manager = new FakeTextureManager();
    const studio = new TextureStudio(manager, STANDARD_PIXEL_RATIO);

    studio.ensure({
      kind: "customer",
      silhouette: "compact",
      pattern: "banded",
      accessory: "tote",
      skin: 0xe2b08a,
      clothing: 0x355e78,
      accent: 0x287f75,
      hair: 0x211915,
      hairStyle: 0,
      stature: 1,
      build: 1,
      legwear: "trousers",
      legwearColour: 0x2f3a4a,
      shoeColour: 0x2b2b2b,
      frame: { isHighContrast: false, isLowDetail: false },
    });

    const texture = manager.created[0] as FakeTexture;
    expect(texture.frames).toHaveLength(SHEET_FACINGS.length * CUSTOMER_POSES.length);
    expect(texture.frames[0]).toBe("south/stand");
  });

  it("caps the pixel ratio so no texture side exceeds the WebGL limit", () => {
    const manager = new FakeTextureManager();
    const studio = new TextureStudio(manager, STANDARD_PIXEL_RATIO);
    const map = createGridMap(80, 40, { tileSize: 48 });

    const painted = studio.ensure({
      kind: "floor",
      map,
      accessPoints: [],
      routeGuidePoints: [],
      baseWidth: 24,
      baseHeight: 16,
      frame: { isHighContrast: false, isLowDetail: true },
    });

    const texture = manager.created[0] as FakeTexture;
    expect(Math.max(texture.width, texture.height)).toBeLessThanOrEqual(4096);
    expect(painted.scale).toBeGreaterThan(0.5);
  });

  it("releases textures by key and all at once", () => {
    const manager = new FakeTextureManager();
    const studio = new TextureStudio(manager, 1);
    const stool = studio.ensure(STOOL_SPEC);
    const steam = studio.ensure({ kind: "effect", effect: "steam", frame: STOOL_SPEC.frame });

    studio.release(stool.key);
    expect(manager.removed).toEqual([stool.key]);
    expect(manager.exists(steam.key)).toBe(true);

    studio.release_all();
    expect(manager.removed).toEqual([stool.key, steam.key]);
    expect(studio.ensure(STOOL_SPEC).key).toBe(stool.key);
    expect(manager.created).toHaveLength(3);
  });

  it("paints later textures at a new pixel ratio and returns a data URL for previews", () => {
    const manager = new FakeTextureManager();
    const studio = new TextureStudio(manager, 2);
    studio.ensure(STOOL_SPEC);
    studio.set_pixel_ratio(1);

    const url = studio.data_url({ kind: "effect", effect: "tray", frame: STOOL_SPEC.frame });

    const tray = manager.created[1] as FakeTexture;
    expect(tray.scales).toEqual([[1, 1]]);
    expect(url).toBe(`data:${tray.key}`);
  });
});
