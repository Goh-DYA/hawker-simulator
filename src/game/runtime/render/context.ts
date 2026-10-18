/**
 * Shared types for the runtime's renderers.
 *
 * The leaf renderers draw into Phaser graphics handed to them and never reach into the scene,
 * so anything they need from the scene, such as placing a text label, is passed in through the
 * types defined here. The root builds one {@link RenderContext} per render from the same
 * sources its closures read, so renderers can take their inputs explicitly.
 */
import type {
  GameSnapshot,
  GameState,
  GridPoint,
  PlacedObject,
  QualityMode,
  SimulationCatalog,
} from "@/src/game/core";

import type { VisualDefinition } from "../catalog";
import type { BuildTool } from "../types";

/**
 * Places a text label in the world at a point, in the scene's label style.
 *
 * @param x - World x of the label's centre.
 * @param y - World y of the label's centre.
 * @param text - The label text.
 * @param colourValue - CSS colour of the text; the scene's default label colour when omitted.
 */
export type LabelSink = (x: number, y: number, text: string, colourValue?: string) => void;

/** The world-space pixel bounds of a placed object's footprint. */
export interface ObjectVisualBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
  readonly centreX: number;
  readonly centreY: number;
}

/** The per-render presentation settings every renderer may read. */
export interface RenderFrame {
  /** The simulation tick being drawn, from the render snapshot. */
  readonly tick: number;
  /** The runtime's current quality setting (not the snapshot's copy). */
  readonly qualityMode: QualityMode;
  readonly isReducedMotion: boolean;
  readonly isHighContrast: boolean;
}

/** Everything a world renderer reads, built once per render by the root. */
export interface RenderContext {
  readonly frame: RenderFrame;
  /** The snapshot being drawn. */
  readonly snapshot: GameSnapshot;
  /** The live game state, for core queries over its objects. */
  readonly state: GameState;
  /** The layered catalog (menus and variants applied). */
  readonly catalog: SimulationCatalog;
  /** The visual definition per placeable definition ID. */
  readonly visuals: Readonly<Record<string, VisualDefinition>>;
  /** The selected dish IDs per stall ID. */
  readonly stallMenus: Readonly<Record<string, readonly string[]>>;
  /** The selected variant ID per dish ID. */
  readonly activeDishVariants: Readonly<Record<string, string>>;
  readonly selectedObjectId: string | undefined;
  readonly selectedCustomerId: string | undefined;
  readonly isDebugOverlay: boolean;
  /** Places a world label through the scene. */
  readonly addLabel: LabelSink;
}

/** The overlay renderer's inputs: the world context plus the build interaction state. */
export interface OverlayContext extends RenderContext {
  /** The catalog with stall upgrades applied, as placement validation sees it. */
  readonly effectiveCatalog: SimulationCatalog;
  readonly buildTool: BuildTool;
  /** The placeable definition ID chosen for placement, if any. */
  readonly selectedBuildId: string | undefined;
  /** The tile under the pointer or keyboard cursor. */
  readonly hoverTile: GridPoint;
  /**
   * Builds the preview of the selected build definition at a tile, in the selected rotation.
   *
   * @param point - The tile to place the preview at.
   * @returns The preview object, or undefined when no build definition is selected.
   */
  readonly placementCandidate: (point: GridPoint) => PlacedObject | undefined;
}
