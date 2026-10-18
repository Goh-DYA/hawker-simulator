/**
 * Code-native visual recipes for stall vendors: a stable worker identity per stall (palette,
 * hair, apron, headwear, tool, work action and stall emblem) and the vendor animation poses.
 *
 * The module is pure and free of Phaser. Only the lazily loaded runtime uses it, so app/ must
 * not import it (enforced by lint) and the eager HUD chunk stays free of vendor code.
 */
import type { StallDefinition } from "@/src/content";
import { ACCENTS, CLOTHING, colour, SKIN_TONES, stableVisualHash } from "./palette";

export type StallVendorActivity = "idle" | "order" | "prepare";

export type StallVendorHairStyle =
  | "cropped"
  | "side-part"
  | "wavy"
  | "coiled"
  | "tied-back"
  | "close-cut";

export type StallVendorApronStyle = "bib" | "cross-back" | "waist" | "utility";

export type StallVendorHeadwear =
  | "service-cap"
  | "visor"
  | "headband"
  | "hair-wrap"
  | "chef-cap"
  | "hairnet";

export type StallVendorTool =
  | "cleaver"
  | "ladle"
  | "long-spout-kettle"
  | "wok-spatula"
  | "noodle-basket"
  | "griddle-spatula"
  | "measuring-cup"
  | "grill-tongs"
  | "batter-cup"
  | "steamer-cloth"
  | "braising-ladle"
  | "fish-turner"
  | "ingredient-tongs"
  | "claypot-ladle";

export type StallVendorWorkAction =
  | "chop"
  | "ladle"
  | "pour"
  | "wok-toss"
  | "blanch"
  | "griddle-turn"
  | "layer-dessert"
  | "turn-skewers"
  | "spread-batter"
  | "lift-steamer"
  | "stir-braise"
  | "chargrill"
  | "pick-pieces"
  | "tend-claypot";

export type StallVendorEmblem =
  | "sunburst"
  | "lime-leaf"
  | "coffee-cup"
  | "flame"
  | "noodle-ribbon"
  | "lantern"
  | "raindrop"
  | "compass"
  | "tamarind-leaf"
  | "bamboo-knot"
  | "hearth-tile"
  | "harbour-wave"
  | "ingredient-grid"
  | "claypot-steam";

/** A stable, renderer-ready identity for the worker assigned to a stall. */
export interface StallVendorRecipe {
  readonly stallId: string;
  readonly seed: number;
  readonly skin: number;
  readonly hair: number;
  readonly shirt: number;
  readonly apron: number;
  readonly apronTrim: number;
  readonly hairStyle: StallVendorHairStyle;
  readonly apronStyle: StallVendorApronStyle;
  readonly headwear: StallVendorHeadwear;
  readonly tool: StallVendorTool;
  readonly workAction: StallVendorWorkAction;
  readonly emblem: StallVendorEmblem;
  /** Visual treatment excluding the already-unique stall ID. */
  readonly renderSignature: string;
  readonly contractKey: string;
}

export interface StallVendorAnimationPose {
  readonly activity: StallVendorActivity;
  /** Vertical body offset in pixels. */
  readonly bob: number;
  /** Horizontal torso offset in pixels. */
  readonly lean: number;
  /** Horizontal head offset in pixels. */
  readonly headTurn: number;
  /** Normalized working-arm pose in the range -1 to 1. */
  readonly workingArm: number;
  /** Normalized support-arm pose in the range -1 to 1. */
  readonly supportArm: number;
  /** Tool rotation in radians. */
  readonly toolAngle: number;
  /** Vertical tool offset in pixels, where positive values lift the tool. */
  readonly toolLift: number;
  /** Horizontal reach towards the counter or customer in pixels. */
  readonly reach: number;
  readonly signature: string;
}

interface StallVendorProfileSeed {
  readonly skinIndex: number;
  readonly hairIndex: number;
  readonly shirtIndex: number;
  readonly apronIndex: number;
  readonly hairStyle: StallVendorHairStyle;
  readonly apronStyle: StallVendorApronStyle;
  readonly headwear: StallVendorHeadwear;
  readonly tool: StallVendorTool;
  readonly workAction: StallVendorWorkAction;
  readonly emblem: StallVendorEmblem;
}

const VENDOR_HAIR = [0x211915, 0x3a281f, 0x553927, 0x2d2524] as const;
const VENDOR_APRONS = [
  0xe8dfcf,
  0x315f54,
  0x6d5140,
  0x313b45,
  0xc76f55,
  0x5d6177,
  0xd6c6a1,
  0x394f67,
  0x647044,
  0xb54f43,
  0x30766d,
  0x35556e,
] as const;

const STALL_VENDOR_PROFILES: Readonly<Record<string, StallVendorProfileSeed>> = {
  "stall.sunrise-roost": {
    skinIndex: 2,
    hairIndex: 0,
    shirtIndex: 4,
    apronIndex: 0,
    hairStyle: "cropped",
    apronStyle: "bib",
    headwear: "service-cap",
    tool: "cleaver",
    workAction: "chop",
    emblem: "sunburst",
  },
  "stall.coconut-lime": {
    skinIndex: 4,
    hairIndex: 2,
    shirtIndex: 6,
    apronIndex: 1,
    hairStyle: "tied-back",
    apronStyle: "cross-back",
    headwear: "hair-wrap",
    tool: "ladle",
    workAction: "ladle",
    emblem: "lime-leaf",
  },
  "stall.kopi-canopy": {
    skinIndex: 0,
    hairIndex: 1,
    shirtIndex: 2,
    apronIndex: 2,
    hairStyle: "side-part",
    apronStyle: "waist",
    headwear: "visor",
    tool: "long-spout-kettle",
    workAction: "pour",
    emblem: "coffee-cup",
  },
  "stall.cinder-wok": {
    skinIndex: 3,
    hairIndex: 3,
    shirtIndex: 0,
    apronIndex: 3,
    hairStyle: "close-cut",
    apronStyle: "utility",
    headwear: "headband",
    tool: "wok-spatula",
    workAction: "wok-toss",
    emblem: "flame",
  },
  "stall.mee-pok-junction": {
    skinIndex: 1,
    hairIndex: 0,
    shirtIndex: 5,
    apronIndex: 4,
    hairStyle: "wavy",
    apronStyle: "bib",
    headwear: "chef-cap",
    tool: "noodle-basket",
    workAction: "blanch",
    emblem: "noodle-ribbon",
  },
  "stall.tiffin-lantern": {
    skinIndex: 2,
    hairIndex: 1,
    shirtIndex: 7,
    apronIndex: 5,
    hairStyle: "coiled",
    apronStyle: "cross-back",
    headwear: "hairnet",
    tool: "griddle-spatula",
    workAction: "griddle-turn",
    emblem: "lantern",
  },
  "stall.sweet-monsoon": {
    skinIndex: 4,
    hairIndex: 2,
    shirtIndex: 3,
    apronIndex: 6,
    hairStyle: "cropped",
    apronStyle: "waist",
    headwear: "service-cap",
    tool: "measuring-cup",
    workAction: "layer-dessert",
    emblem: "raindrop",
  },
  "stall.satay-meridian": {
    skinIndex: 1,
    hairIndex: 3,
    shirtIndex: 1,
    apronIndex: 7,
    hairStyle: "tied-back",
    apronStyle: "utility",
    headwear: "hair-wrap",
    tool: "grill-tongs",
    workAction: "turn-skewers",
    emblem: "compass",
  },
  "stall.tamarind-leaf": {
    skinIndex: 3,
    hairIndex: 1,
    shirtIndex: 6,
    apronIndex: 8,
    hairStyle: "side-part",
    apronStyle: "bib",
    headwear: "visor",
    tool: "batter-cup",
    workAction: "spread-batter",
    emblem: "tamarind-leaf",
  },
  "stall.bamboo-basket": {
    skinIndex: 0,
    hairIndex: 0,
    shirtIndex: 4,
    apronIndex: 9,
    hairStyle: "close-cut",
    apronStyle: "cross-back",
    headwear: "headband",
    tool: "steamer-cloth",
    workAction: "lift-steamer",
    emblem: "bamboo-knot",
  },
  "stall.straits-hearth": {
    skinIndex: 2,
    hairIndex: 3,
    shirtIndex: 2,
    apronIndex: 10,
    hairStyle: "wavy",
    apronStyle: "waist",
    headwear: "chef-cap",
    tool: "braising-ladle",
    workAction: "stir-braise",
    emblem: "hearth-tile",
  },
  "stall.harbour-ember": {
    skinIndex: 4,
    hairIndex: 2,
    shirtIndex: 5,
    apronIndex: 11,
    hairStyle: "coiled",
    apronStyle: "utility",
    headwear: "hairnet",
    tool: "fish-turner",
    workAction: "chargrill",
    emblem: "harbour-wave",
  },
  "stall.pick-and-mix": {
    skinIndex: 1,
    hairIndex: 2,
    shirtIndex: 7,
    apronIndex: 12,
    hairStyle: "tied-back",
    apronStyle: "utility",
    headwear: "visor",
    tool: "ingredient-tongs",
    workAction: "pick-pieces",
    emblem: "ingredient-grid",
  },
  "stall.herbal-cauldron": {
    skinIndex: 3,
    hairIndex: 0,
    shirtIndex: 3,
    apronIndex: 13,
    hairStyle: "cropped",
    apronStyle: "bib",
    headwear: "chef-cap",
    tool: "claypot-ladle",
    workAction: "tend-claypot",
    emblem: "claypot-steam",
  },
};

const VENDOR_HAIR_STYLES = [
  "cropped",
  "side-part",
  "wavy",
  "coiled",
  "tied-back",
  "close-cut",
] as const satisfies readonly StallVendorHairStyle[];
const VENDOR_APRON_STYLES = ["bib", "cross-back", "waist", "utility"] as const satisfies readonly StallVendorApronStyle[];
const VENDOR_HEADWEAR = [
  "service-cap",
  "visor",
  "headband",
  "hair-wrap",
  "chef-cap",
  "hairnet",
] as const satisfies readonly StallVendorHeadwear[];
const VENDOR_EMBLEMS = [
  "sunburst",
  "lime-leaf",
  "coffee-cup",
  "flame",
  "noodle-ribbon",
  "lantern",
  "raindrop",
  "compass",
  "tamarind-leaf",
  "bamboo-knot",
  "hearth-tile",
  "harbour-wave",
  "ingredient-grid",
  "claypot-steam",
] as const satisfies readonly StallVendorEmblem[];

const VENDOR_ACTION_RULES: readonly (readonly [RegExp, StallVendorTool, StallVendorWorkAction])[] = [
  [/chop/, "cleaver", "chop"],
  [/wok/, "wok-spatula", "wok-toss"],
  [/noodle|blanch/, "noodle-basket", "blanch"],
  [/skewer/, "grill-tongs", "turn-skewers"],
  [/spread/, "batter-cup", "spread-batter"],
  [/steamer/, "steamer-cloth", "lift-steamer"],
  [/braise/, "braising-ladle", "stir-braise"],
  [/chargrill|grill/, "fish-turner", "chargrill"],
  [/griddle/, "griddle-spatula", "griddle-turn"],
  [/coconut-pour|glass-pull/, "measuring-cup", "layer-dessert"],
  [/pour/, "long-spout-kettle", "pour"],
  [/ladle/, "ladle", "ladle"],
];

function fallbackVendorProfile(stall: StallDefinition, seed: number): StallVendorProfileSeed {
  const animationKey = stall.animationReferences.join(":");
  const action = VENDOR_ACTION_RULES.find(([pattern]) => pattern.test(animationKey));
  return {
    skinIndex: seed >>> 3,
    hairIndex: seed >>> 7,
    shirtIndex: seed >>> 11,
    apronIndex: seed >>> 15,
    hairStyle: VENDOR_HAIR_STYLES[(seed >>> 5) % VENDOR_HAIR_STYLES.length] as StallVendorHairStyle,
    apronStyle: VENDOR_APRON_STYLES[(seed >>> 9) % VENDOR_APRON_STYLES.length] as StallVendorApronStyle,
    headwear: VENDOR_HEADWEAR[(seed >>> 13) % VENDOR_HEADWEAR.length] as StallVendorHeadwear,
    tool: action?.[1] ?? "ladle",
    workAction: action?.[2] ?? "ladle",
    emblem: VENDOR_EMBLEMS[(seed >>> 17) % VENDOR_EMBLEMS.length] as StallVendorEmblem,
  };
}

/**
 * Derives the deterministic visual recipe of the vendor who works a stall.
 *
 * Launch stalls use an authored profile; other stalls get a profile picked by a stable hash,
 * with the tool and work action inferred from the stall's animation references.
 *
 * @param stall - The stall content definition.
 * @returns The recipe, with a contract key that is unique per launch stall.
 */
export function visualRecipeForStallVendor(stall: StallDefinition): StallVendorRecipe {
  const seed = stableVisualHash(`vendor:${stall.id}`);
  const profile = STALL_VENDOR_PROFILES[stall.id] ?? fallbackVendorProfile(stall, seed);
  const skin = SKIN_TONES[profile.skinIndex % SKIN_TONES.length] as number;
  const hair = VENDOR_HAIR[profile.hairIndex % VENDOR_HAIR.length] as number;
  const shirt = CLOTHING[profile.shirtIndex % CLOTHING.length] as number;
  const apron = VENDOR_APRONS[profile.apronIndex % VENDOR_APRONS.length] as number;
  const apronTrim = colour(stall.visual.palette[2], ACCENTS[seed % ACCENTS.length] as number);
  const renderSignature = [
    skin.toString(16),
    hair.toString(16),
    shirt.toString(16),
    apron.toString(16),
    apronTrim.toString(16),
    profile.hairStyle,
    profile.apronStyle,
    profile.headwear,
    profile.tool,
    profile.workAction,
    profile.emblem,
  ].join(":");
  return {
    stallId: stall.id,
    seed,
    skin,
    hair,
    shirt,
    apron,
    apronTrim,
    hairStyle: profile.hairStyle,
    apronStyle: profile.apronStyle,
    headwear: profile.headwear,
    tool: profile.tool,
    workAction: profile.workAction,
    emblem: profile.emblem,
    renderSignature,
    contractKey: `${stall.id}:${renderSignature}`,
  };
}

/**
 * Computes a stall vendor's animation pose for an activity at a simulation tick.
 *
 * @param recipe - The vendor's visual recipe, whose seed offsets the phase and whose work
 *   action shapes the preparation pose.
 * @param tick - The animation tick.
 * @param reducedMotion - Whether reduced motion is on, which freezes every offset at zero.
 * @param activity - What the vendor is doing: idling, taking an order or preparing food.
 * @returns The pose, with a signature of activity, work action and motion mode.
 */
export function vendorAnimationPoseForStall(
  recipe: StallVendorRecipe,
  tick: number,
  reducedMotion: boolean,
  activity: StallVendorActivity,
): StallVendorAnimationPose {
  const signature = `${activity}:${recipe.workAction}:${reducedMotion ? "still" : "motion"}`;
  if (reducedMotion) {
    return {
      activity,
      bob: 0,
      lean: 0,
      headTurn: 0,
      workingArm: 0,
      supportArm: 0,
      toolAngle: 0,
      toolLift: 0,
      reach: 0,
      signature,
    };
  }

  const seedPhase = (recipe.seed % 29) * 0.17;
  const phase = tick * (activity === "prepare" ? 0.62 : activity === "order" ? 0.39 : 0.21) + seedPhase;
  const wave = Math.sin(phase);
  const crossWave = Math.cos(phase * 0.73 + seedPhase * 0.5);
  if (activity === "idle") {
    return {
      activity,
      bob: wave * 0.55,
      lean: crossWave * 0.3,
      headTurn: Math.sin(phase * 0.47) * 0.8,
      workingArm: wave * 0.08,
      supportArm: -wave * 0.06,
      toolAngle: crossWave * 0.025,
      toolLift: Math.max(0, wave) * 0.25,
      reach: 0,
      signature,
    };
  }
  if (activity === "order") {
    return {
      activity,
      bob: wave * 0.3,
      lean: 0.8 + crossWave * 0.25,
      headTurn: 0.9 + wave * 0.45,
      workingArm: 0.35 + wave * 0.14,
      supportArm: -0.18 + crossWave * 0.1,
      toolAngle: wave * 0.04,
      toolLift: Math.max(0, crossWave) * 0.4,
      reach: 2.8 + wave * 0.7,
      signature,
    };
  }

  const liftingAction = recipe.workAction === "pour" || recipe.workAction === "lift-steamer";
  const sweepingAction =
    recipe.workAction === "spread-batter" ||
    recipe.workAction === "stir-braise" ||
    recipe.workAction === "pick-pieces" ||
    recipe.workAction === "tend-claypot";
  return {
    activity,
    bob: crossWave * 0.45,
    lean: 0.55 + Math.abs(wave) * 0.8,
    headTurn: wave * 0.45,
    workingArm: wave * (liftingAction ? 0.72 : 0.9),
    supportArm: crossWave * (sweepingAction ? 0.52 : 0.34),
    toolAngle: wave * (liftingAction ? 0.58 : sweepingAction ? 0.42 : 0.32),
    toolLift: liftingAction ? (wave + 1) * 1.8 : Math.abs(wave) * 1.15,
    reach: sweepingAction ? crossWave * 2.2 : 1.1 + Math.abs(crossWave) * 1.2,
    signature,
  };
}
