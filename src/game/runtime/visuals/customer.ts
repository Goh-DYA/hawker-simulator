/**
 * Code-native visual recipes for customers: archetype recipes, stable per-customer appearance,
 * status-driven animation poses and the customer indicator legend shown in the HUD.
 *
 * The module is pure and free of Phaser, so the HUD can import the legend eagerly.
 */
import type { CustomerArchetypeDefinition } from "@/src/content";
import type { CustomerStatus } from "@/src/game/core";
import { ACCENTS, CLOTHING, SKIN_TONES, stableVisualHash } from "./palette";

export interface CustomerVisualRecipe {
  readonly id: string;
  readonly outfitSilhouette: CustomerArchetypeDefinition["visualRules"]["outfitSilhouette"];
  readonly garmentPattern: CustomerArchetypeDefinition["visualRules"]["garmentPattern"];
  readonly accessory: CustomerArchetypeDefinition["visualRules"]["carryProp"];
  readonly accessoryChance: number;
  /** Visual treatment excluding the already-unique content ID. */
  readonly renderSignature: string;
  readonly contractKey: string;
}

export interface CustomerAppearance {
  readonly skin: number;
  readonly clothing: number;
  readonly accent: number;
}

/**
 * Derives the deterministic visual recipe of a customer archetype from its visual rules.
 *
 * @param archetype - The customer archetype content definition.
 * @returns The recipe, with a render signature that is unique per launch archetype.
 */
export function visualRecipeForCustomer(
  archetype: CustomerArchetypeDefinition,
): CustomerVisualRecipe {
  const renderSignature = [
    archetype.visualRules.outfitSilhouette,
    archetype.visualRules.garmentPattern,
    archetype.visualRules.carryProp,
  ].join(":");
  return {
    id: archetype.id,
    outfitSilhouette: archetype.visualRules.outfitSilhouette,
    garmentPattern: archetype.visualRules.garmentPattern,
    accessory: archetype.visualRules.carryProp,
    accessoryChance: archetype.visualRules.accessoryChance,
    renderSignature,
    contractKey: `${archetype.id}:${renderSignature}`,
  };
}

/**
 * Keeps skin tone and clothing colours independent from behavioural personas.
 * Appearance is stable per customer so rerenders do not make people flicker.
 */
export function customerAppearanceForId(customerId: string): CustomerAppearance {
  const seed = stableVisualHash(customerId);
  const skin = SKIN_TONES[(seed >>> 3) % SKIN_TONES.length] as number;
  const clothing = CLOTHING[(seed >>> 9) % CLOTHING.length] as number;
  const accent = ACCENTS[(seed >>> 15) % ACCENTS.length] as number;
  return { skin, clothing, accent };
}

/** Hair colours a guest's figure picks from, in a fixed order. */
export const HAIR_COLOURS = [0x211915, 0x3a281f, 0x553927, 0x1c1b1f, 0x6b4a2b, 0x8a8f94] as const;
/** Number of hair shapes a guest's figure picks from. */
export const HAIR_STYLE_COUNT = 6;
/** The lower garments a guest's figure picks from, in a fixed order. */
export const LEGWEAR_KINDS = ["trousers", "shorts", "skirt", "long-skirt", "jeans"] as const;
/** Colours of trousers, shorts and skirts, in a fixed order. */
export const LEGWEAR_COLOURS = [
  0x2f3a4a, 0x4a4f57, 0x6b5a45, 0x2f4a6b, 0x7a6a55, 0x3b5a4a, 0x1f2a36, 0x8a7560,
] as const;
/** Shoe colours, in a fixed order. */
export const SHOE_COLOURS = [0x2b2b2b, 0xf1efe8, 0x6b4a2b, 0x3d4f6b, 0x8a3a2e] as const;

/** A guest's body and the clothes below the waist, independent of persona and appearance. */
export interface CustomerFigure {
  readonly hair: number;
  readonly hairStyle: number;
  /** Height class: 0 short, 1 average, 2 tall. */
  readonly stature: 0 | 1 | 2;
  /** Build class: 0 slim, 1 average, 2 broad. */
  readonly build: 0 | 1 | 2;
  readonly legwear: (typeof LEGWEAR_KINDS)[number];
  readonly legwearColour: number;
  readonly shoeColour: number;
}

/**
 * Derives a guest's figure (hair, height, build and lower garments) from their ID alone, so body
 * variety never follows the guest's persona, spending or health condition, and stays stable
 * across rerenders.
 *
 * @param customerId - The customer's ID.
 * @returns The figure.
 */
export function customer_figure_for_id(customerId: string): CustomerFigure {
  const seed = stableVisualHash(`figure:${customerId}`);
  return {
    hair: HAIR_COLOURS[seed % HAIR_COLOURS.length] as number,
    hairStyle: (seed >>> 4) % HAIR_STYLE_COUNT,
    stature: ((seed >>> 8) % 3) as 0 | 1 | 2,
    build: ((seed >>> 11) % 3) as 0 | 1 | 2,
    legwear: LEGWEAR_KINDS[(seed >>> 14) % LEGWEAR_KINDS.length] as (typeof LEGWEAR_KINDS)[number],
    legwearColour: LEGWEAR_COLOURS[(seed >>> 18) % LEGWEAR_COLOURS.length] as number,
    shoeColour: SHOE_COLOURS[(seed >>> 22) % SHOE_COLOURS.length] as number,
  };
}

export interface CustomerAnimationPose {
  readonly state: CustomerStatus;
  readonly pose: "consider" | "walk" | "queue" | "order" | "wait" | "seek" | "sit" | "eat" | "return" | "leave";
  readonly bob: number;
  readonly stride: number;
  readonly armSwing: number;
  readonly carriesFood: boolean;
  readonly showsMeal: boolean;
  readonly showsTray: boolean;
  readonly indicator: CustomerIndicator;
  readonly signature: string;
}

export type CustomerIndicator =
  | "question"
  | "footsteps"
  | "queue"
  | "order"
  | "clock"
  | "seat"
  | "meal"
  | "return"
  | "exit";

export interface CustomerIndicatorLegendEntry {
  readonly indicator: CustomerIndicator;
  readonly label: string;
  readonly description: string;
}

/** The HUD legend entry for every customer status indicator, in display order. */
export const CUSTOMER_INDICATOR_LEGEND = [
  {
    indicator: "question",
    label: "Choosing a stall",
    description: "Comparing open stalls and their available dishes.",
  },
  {
    indicator: "footsteps",
    label: "On the move",
    description: "Moving towards a queue or a reserved seat.",
  },
  {
    indicator: "queue",
    label: "In the queue",
    description: "Waiting in line to place an order.",
  },
  {
    indicator: "order",
    label: "Ordering",
    description: "Placing an order at the stall counter.",
  },
  {
    indicator: "clock",
    label: "Waiting for food",
    description: "Waiting for the stall to finish preparing the dish.",
  },
  {
    indicator: "seat",
    label: "Finding a seat",
    description: "Looking for an available, reachable seat.",
  },
  {
    indicator: "meal",
    label: "Eating",
    description: "Dining at the reserved seat.",
  },
  {
    indicator: "return",
    label: "Returning a tray",
    description: "Finding or walking to a tray-return point.",
  },
  {
    indicator: "exit",
    label: "Leaving",
    description: "Walking to an exit after finishing or leaving early.",
  },
] as const satisfies readonly CustomerIndicatorLegendEntry[];

const POSE_BY_STATUS: Readonly<Record<CustomerStatus, Omit<CustomerAnimationPose, "state" | "bob" | "stride" | "armSwing" | "signature">>> = {
  "choosing-stall": { pose: "consider", carriesFood: false, showsMeal: false, showsTray: false, indicator: "question" },
  "walking-to-queue": { pose: "walk", carriesFood: false, showsMeal: false, showsTray: false, indicator: "footsteps" },
  queued: { pose: "queue", carriesFood: false, showsMeal: false, showsTray: false, indicator: "queue" },
  ordering: { pose: "order", carriesFood: false, showsMeal: false, showsTray: false, indicator: "order" },
  "waiting-for-food": { pose: "wait", carriesFood: false, showsMeal: false, showsTray: false, indicator: "clock" },
  "seeking-seat": { pose: "seek", carriesFood: true, showsMeal: false, showsTray: true, indicator: "seat" },
  "walking-to-seat": { pose: "walk", carriesFood: true, showsMeal: false, showsTray: true, indicator: "footsteps" },
  eating: { pose: "eat", carriesFood: false, showsMeal: true, showsTray: true, indicator: "meal" },
  "seeking-tray-return": { pose: "return", carriesFood: false, showsMeal: false, showsTray: true, indicator: "return" },
  "walking-to-tray-return": { pose: "walk", carriesFood: false, showsMeal: false, showsTray: true, indicator: "return" },
  "walking-to-exit": { pose: "leave", carriesFood: false, showsMeal: false, showsTray: false, indicator: "exit" },
};

/**
 * Computes a customer's animation pose for a status at a simulation tick.
 *
 * @param status - The customer's current status, which picks the pose and indicator.
 * @param tick - The animation tick that drives bob, stride and arm swing.
 * @param seed - A per-customer seed that offsets the animation phase.
 * @param reducedMotion - Whether reduced motion is on, which freezes every offset at zero.
 * @returns The pose, with a signature that is unique per status.
 */
export function animationPoseForCustomer(
  status: CustomerStatus,
  tick: number,
  seed: number,
  reducedMotion: boolean,
): CustomerAnimationPose {
  const base = POSE_BY_STATUS[status];
  const moving = base.pose === "walk" || base.pose === "leave";
  const phase = reducedMotion ? 0 : (tick * 0.58 + (seed % 17) * 0.31);
  const bob = reducedMotion ? 0 : moving ? Math.sin(phase * 2) * 1.4 : base.pose === "eat" ? Math.sin(phase) * 0.7 : 0;
  const stride = reducedMotion || !moving ? 0 : Math.sin(phase) * 4;
  const armSwing = reducedMotion ? 0 : base.pose === "eat" ? Math.sin(phase * 1.4) * 3 : moving ? -stride * 0.65 : 0;
  return {
    state: status,
    ...base,
    bob,
    stride,
    armSwing,
    signature: `${status}:${base.pose}:${base.indicator}:${base.carriesFood ? 1 : 0}:${base.showsMeal ? 1 : 0}:${base.showsTray ? 1 : 0}`,
  };
}
