/**
 * The Phaser scene that hosts the hawker centre, and the game that runs it.
 *
 * Phaser is imported dynamically by the runtime root, so the scene class is built at run time
 * from the namespace it is handed (`create_scene_class`). The scene owns only presentation
 * state: the texture studio, the retained world and overlay views, the label pool, the
 * drag-to-pan gesture, the frame clock and the last tick it drew. Everything about the game
 * itself comes through {@link SceneBindings}: the root steps the simulation, handles tiles and
 * keys, and builds the render context. Phaser is imported as a type only.
 */
import type Phaser from "phaser";

import { has_dev_query_flag, IS_PRODUCTION_BUILD } from "@/src/config/env";
import { tileToWorld, worldToTile, type GridMap, type GridPoint } from "@/src/game/core";

import type { RuntimeSettings } from "../types";
import { TILE_SIZE } from "../world";
import type { LabelSink, OverlayContext } from "./context";
import { LABEL_STYLE, LabelPool } from "./labels";
import { OverlayView } from "./overlay";
import { LOWER_END_PIXEL_RATIO, STANDARD_PIXEL_RATIO, TextureStudio } from "./textures";
import { WorldView } from "./world";

/** Longest frame delta fed to the simulation, so a stalled tab does not jump ahead. */
const MAX_FRAME_DELTA_MS = 250;
/** Smallest camera zoom reachable with the wheel or the zoom controls. */
export const CAMERA_MIN_ZOOM = 0.48;
/** Largest camera zoom reachable with the wheel or the zoom controls. */
export const CAMERA_MAX_ZOOM = 1.55;
/** The camera zoom when the scene is created. */
const CAMERA_INITIAL_ZOOM = 0.78;
/** The zoom change for one wheel notch. */
const CAMERA_WHEEL_ZOOM_STEP = 0.08;
/** The frame rate Phaser aims for. */
const TARGET_FPS = 60;
/** The frame-rate cap on the standard quality mode. */
export const STANDARD_FPS_LIMIT = 60;
/** The frame-rate cap on the lower-end quality mode. */
export const LOWER_END_FPS_LIMIT = 30;
/** The canvas colour behind the painted floor, the concrete apron tone. */
const BACKDROP_COLOUR = "#b9b4a6";

/** What the root exposes of the scene once it exists. */
export interface HawkerSceneHandle extends Phaser.Scene {
  /**
   * Redraws the world and the overlay.
   *
   * @param force - Redraw even when the simulation tick has not changed since the last draw.
   */
  render(force?: boolean): void;
  /**
   * Fits the camera bounds to the current map size.
   *
   * @param centre - Also centre the camera on the map.
   */
  syncWorldBounds(centre?: boolean): void;
  /**
   * Paints a texture and returns it as a PNG data URL, for interface thumbnails.
   *
   * @param spec - The paint spec.
   * @returns The data URL, or undefined before the studio exists.
   */
  previewDataUrl(spec: Parameters<TextureStudio["data_url"]>[0]): string | undefined;
}

/** The root's side of the scene: the game state and actions the scene delegates to. */
export interface SceneBindings {
  /** The game's host element: focused on pointer down, and keys count only while focus is inside. */
  readonly parent: HTMLElement;
  /** The `performance.now()` reading taken when the runtime was created, the first frame origin. */
  readonly initialFrameAt: number;
  /** @returns The current map, for pointer and cursor tile conversion and the camera bounds. */
  getMap(): GridMap;
  /** @returns The tile under the pointer or keyboard cursor. */
  getHoverTile(): GridPoint;
  /**
   * Moves the pointer or keyboard cursor tile.
   *
   * @param point - The new hover tile.
   */
  setHoverTile(point: GridPoint): void;
  /**
   * Applies the current tool to a tile, as a click or Enter does.
   *
   * @param point - The tile that was chosen.
   */
  handleTile(point: GridPoint): void;
  /**
   * Handles a key press that reached the game area.
   *
   * @param key - The pressed key, lowercased.
   */
  handleKey(key: string): void;
  /**
   * Advances the simulation by one frame.
   *
   * @param frameDeltaMs - The capped real time since the previous frame.
   * @param now - The frame's `performance.now()` reading.
   * @returns The simulation tick after the frame.
   */
  advanceFrame(frameDeltaMs: number, now: number): number;
  /**
   * Builds the context for one render.
   *
   * @param addLabel - Places a world label through the scene.
   * @returns The render context, extended with the build interaction state for the overlay.
   */
  getRenderContext(addLabel: LabelSink): OverlayContext;
  /**
   * Pushes a HUD snapshot.
   *
   * @param force - Push even when the HUD interval has not elapsed.
   */
  emitHud(force?: boolean): void;
  /**
   * Called first in the scene's `create()`, so the root can reach the scene.
   *
   * @param scene - The scene being created.
   */
  onCreated(scene: HawkerSceneHandle): void;
}

/**
 * Builds the hawker centre scene class on the given Phaser namespace.
 *
 * @param phaser - The dynamically imported Phaser namespace.
 * @param bindings - The root's state and actions the scene delegates to.
 * @param settings - The player's settings; the quality mode picks the initial texture scale.
 * @returns The scene class (scene key `hawker-centre`), for the game config.
 */
export function create_scene_class(
  phaser: typeof Phaser,
  bindings: SceneBindings,
  settings: Pick<RuntimeSettings, "quality">,
): new () => HawkerSceneHandle {
  return class HawkerScene extends phaser.Scene {
    private studio?: TextureStudio;
    private world?: WorldView;
    private overlay?: OverlayView;
    private labels?: LabelPool;
    private dragged = false;
    private dragOrigin = { x: 0, y: 0 };
    private cameraOrigin = { x: 0, y: 0 };
    private lastFrameAt = bindings.initialFrameAt;
    private lastRenderTick = -1;

    constructor() {
      super({ key: "hawker-centre" });
    }

    create() {
      bindings.onCreated(this);
      this.studio = new TextureStudio(
        this.textures,
        settings.quality === "standard" ? STANDARD_PIXEL_RATIO : LOWER_END_PIXEL_RATIO,
      );
      this.labels = new LabelPool((x, y, text, colourValue) =>
        this.add.text(x, y, text, { ...LABEL_STYLE, color: colourValue }),
      );
      const surface = {
        add: {
          image: (x: number, y: number, key: string, frame?: string) => this.add.image(x, y, key, frame),
          graphics: () => this.add.graphics(),
        },
      };
      this.world = new WorldView(surface, this.studio, this.labels);
      this.overlay = new OverlayView(surface, this.studio);
      // The leading constant lets Vite drop this developer-only hook from production builds.
      if (!IS_PRODUCTION_BUILD && has_dev_query_flag("debug")) {
        (globalThis as { __hawkerScene?: unknown }).__hawkerScene = this;
      }
      this.syncWorldBounds(true);
      this.cameras.main.setZoom(CAMERA_INITIAL_ZOOM);
      this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        const camera = this.cameras.main;
        const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);
        bindings.setHoverTile(worldToTile(bindings.getMap(), worldPoint));
        if (pointer.isDown) {
          const distance = Math.hypot(pointer.x - this.dragOrigin.x, pointer.y - this.dragOrigin.y);
          if (distance > 6) this.dragged = true;
          if (this.dragged) {
            camera.scrollX = this.cameraOrigin.x - (pointer.x - this.dragOrigin.x) / camera.zoom;
            camera.scrollY = this.cameraOrigin.y - (pointer.y - this.dragOrigin.y) / camera.zoom;
          }
        }
        this.render(true);
      });
      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        bindings.parent.focus();
        this.dragged = false;
        this.dragOrigin = { x: pointer.x, y: pointer.y };
        this.cameraOrigin = { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY };
      });
      this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (this.dragged) return;
        const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        bindings.handleTile(worldToTile(bindings.getMap(), point));
      });
      this.input.on(
        "wheel",
        (
          _pointer: Phaser.Input.Pointer,
          _objects: unknown[],
          _deltaX: number,
          deltaY: number,
        ) => {
          const next = phaser.Math.Clamp(
            this.cameras.main.zoom - Math.sign(deltaY) * CAMERA_WHEEL_ZOOM_STEP,
            CAMERA_MIN_ZOOM,
            CAMERA_MAX_ZOOM,
          );
          this.cameras.main.setZoom(next);
        },
      );
      this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
        const target = event.target;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          !bindings.parent.contains(document.activeElement)
        ) {
          return;
        }
        const key = event.key.toLocaleLowerCase();
        if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
          event.preventDefault();
        }
        const movedCursor = key.startsWith("arrow");
        bindings.handleKey(key);
        if (movedCursor) this.followBuildCursor();
        this.render(true);
      });
      this.render(true);
      bindings.emitHud(true);
    }

    syncWorldBounds(centre = false) {
      const map = bindings.getMap();
      const worldWidth = map.width * TILE_SIZE;
      const worldHeight = map.height * TILE_SIZE;
      this.cameras.main.setBounds(-80, -80, worldWidth + 160, worldHeight + 160);
      if (centre) this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);
    }

    followBuildCursor() {
      const point = tileToWorld(bindings.getMap(), bindings.getHoverTile());
      const view = this.cameras.main.worldView;
      const margin = TILE_SIZE * 1.5;
      if (
        point.x < view.left + margin ||
        point.x > view.right - margin ||
        point.y < view.top + margin ||
        point.y > view.bottom - margin
      ) {
        this.cameras.main.centerOn(point.x, point.y);
      }
    }

    override update(_time: number, delta: number) {
      const now = performance.now();
      const frameDelta = Math.min(MAX_FRAME_DELTA_MS, delta || now - this.lastFrameAt);
      this.lastFrameAt = now;
      const tick = bindings.advanceFrame(frameDelta, now);
      if (tick !== this.lastRenderTick) this.render();
      bindings.emitHud();
    }

    render(force = false) {
      const labels = this.labels;
      const world = this.world;
      const overlay = this.overlay;
      if (!labels || !world || !overlay) return;
      const context = bindings.getRenderContext((x, y, text, colourValue) =>
        labels.place(x, y, text, colourValue),
      );
      if (!force && context.snapshot.tick === this.lastRenderTick) return;
      this.lastRenderTick = context.snapshot.tick;
      labels.begin();
      world.sync(context);
      overlay.draw(context);
      labels.end();
    }

    previewDataUrl(spec: Parameters<TextureStudio["data_url"]>[0]) {
      return this.studio?.data_url(spec);
    }
  };
}

/**
 * Constructs the Phaser game that runs the scene in the host element, with the renderer and frame
 * rate chosen by the quality setting.
 *
 * @param phaser - The dynamically imported Phaser namespace.
 * @param parent - The host element the canvas goes in, which also receives keyboard input.
 * @param settings - The player's settings; only the quality mode is read.
 * @param scene_class - The scene class from {@link create_scene_class}.
 * @returns The game, which boots the scene on its own schedule.
 */
export function create_game(
  phaser: typeof Phaser,
  parent: HTMLElement,
  settings: RuntimeSettings,
  scene_class: new () => HawkerSceneHandle,
): Phaser.Game {
  return new phaser.Game({
    type: phaser.AUTO,
    parent,
    backgroundColor: BACKDROP_COLOUR,
    transparent: false,
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
      powerPreference: settings.quality === "standard" ? "high-performance" : "low-power",
    },
    scale: {
      mode: phaser.Scale.RESIZE,
      width: parent.clientWidth,
      height: parent.clientHeight,
      autoCenter: phaser.Scale.CENTER_BOTH,
    },
    fps: {
      target: TARGET_FPS,
      limit: settings.quality === "standard" ? STANDARD_FPS_LIMIT : LOWER_END_FPS_LIMIT,
      forceSetTimeOut: false,
    },
    scene: scene_class,
    input: {
      keyboard: { target: parent },
      mouse: { preventDefaultWheel: true },
    },
    audio: { noAudio: true },
  });
}
