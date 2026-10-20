/**
 * Unit tests for the pure display helpers of the `HawkerSimulator` game screen.
 *
 * The helpers moved out of the component unchanged, so these tests pin the text they
 * produce today for representative content: money, catalogue glyphs and prices, content
 * labels with their fallbacks, unlock requirements, placeable utility effects, previews,
 * the nutrition view of a dish, the panel copy, and the shared progress, colour, ID, unlock
 * and event-glyph helpers, plus the starting economy the initial HUD snapshot reads. The
 * rendered panels stay covered by the component goldens; these tests fail closer to the
 * helper that drifted.
 */
import { describe, expect, it } from "vitest";

import {
  ACTIVITY_KIND_GLYPHS,
  BUILD_CATEGORIES,
  catalogueIcon,
  CUSTOMER_PERSONAS_BY_UNLOCK,
  dishLabel,
  dishPreview,
  describe_writer_verdict,
  dishStarRating,
  format_hex_colour,
  format_minute_of_day,
  format_minute_range,
  format_progress_percent,
  get_unlock_reputation,
  getContentPrice,
  humanize_id,
  is_requirement_met,
  localize,
  money,
  nutritionProfileView,
  PANEL_COPY,
  personaLabel,
  placeablePreview,
  primaryUtility,
  TOAST_KIND_GLYPHS,
  unlockLabel,
  utilityEffects,
} from "@/app/game/display";
import {
  CUSTOMER_ARCHETYPES,
  DISHES,
  ECONOMY,
  getNutritionProfile,
  PLACEABLES,
  STALLS,
  type PlaceableDefinition,
} from "@/src/content";
import { coreNutritionProfile, runtimeNutritionProfile } from "@/src/game/runtime/nutrition";

/** A dish with an authored nutrition profile. */
const PROFILED_DISH_ID = "dish.poached-chicken-rice";

/** A stall whose only prerequisite is another stall. */
const STALL_WITH_PREREQUISITE = STALLS.find(
  (stall) => stall.unlockRequirement.prerequisiteIds.length > 0,
)!;

describe("money", () => {
  it("formats whole Singapore dollars in the en-SG style", () => {
    expect([money(4_200), money(0), money(1_234.6), money(-50)]).toEqual([
      "$4,200",
      "$0",
      "$1,235",
      "-$50",
    ]);
  });
});

describe("catalogue cards", () => {
  it("gives stalls and unknown categories their own glyphs", () => {
    expect([
      catalogueIcon("stall"),
      catalogueIcon("table"),
      catalogueIcon("unknown" as PlaceableDefinition["category"]),
    ]).toEqual(["▰", "▦", "◇"]);
  });

  it("reads a placeable's price and a stall's purchase cost", () => {
    const placeable = PLACEABLES[0]!;
    const stall = STALLS[0]!;

    expect([getContentPrice(placeable), getContentPrice(stall)]).toEqual([
      placeable.price,
      stall.purchaseCost,
    ]);
  });

  it("lists all, then every placeable category once, in catalogue order", () => {
    expect(BUILD_CATEGORIES).toEqual([
      "all",
      ...PLACEABLES.map((item) => item.category).filter(
        (category, index, categories) => categories.indexOf(category) === index,
      ),
    ]);
  });

  it("writes the preview accent as a six-digit hex colour", () => {
    expect(placeablePreview(PLACEABLES[0]!).style["--preview-accent"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("gives every dish preview a presentation and two hex colours", () => {
    for (const dish of DISHES) {
      const preview = dishPreview(dish);
      expect([
        typeof preview.presentation,
        preview.style["--dish-portion"],
        preview.style["--dish-garnish"],
      ]).toEqual([
        "string",
        expect.stringMatching(/^#[0-9a-f]{6}$/),
        expect.stringMatching(/^#[0-9a-f]{6}$/),
      ]);
    }
  });
});

describe("content labels", () => {
  it("returns a localisation key that has no text unchanged", () => {
    expect(localize("missing.key")).toBe("missing.key");
  });

  it("names a known dish by its localised name and an unknown one by its ID", () => {
    const dish = DISHES[0]!;

    expect([dishLabel(dish.id), dishLabel("dish.mystery-noodle-soup")]).toEqual([
      localize(dish.nameKey),
      "mystery noodle soup",
    ]);
  });

  it("reads a known dish's Star rating and none for an unknown dish", () => {
    const dish = DISHES[0]!;

    expect([dishStarRating(dish.id), dishStarRating("dish.unknown")]).toEqual([
      dish.starRating,
      undefined,
    ]);
  });

  it("names a known persona by its localised name and an unknown one by its ID", () => {
    const archetype = CUSTOMER_ARCHETYPES[0]!;

    expect([personaLabel(archetype.id), personaLabel("customer.night-owl-student")]).toEqual([
      localize(archetype.nameKey),
      "night owl student",
    ]);
  });

  it("orders the personas by level, then reputation, then ID", () => {
    const keys = CUSTOMER_PERSONAS_BY_UNLOCK.map((customer) => [
      customer.unlockRequirement.level,
      customer.unlockRequirement.reputation,
    ]);

    expect(keys).toEqual(
      [...keys].sort((left, right) => left[0]! - right[0]! || left[1]! - right[1]!),
    );
  });
});

describe("unlockLabel", () => {
  const item = {
    nameKey: "unused",
    unlockRequirement: {
      level: 3,
      reputation: 20,
      prerequisiteIds: [STALL_WITH_PREREQUISITE.unlockRequirement.prerequisiteIds[0]!],
    },
  };
  const prerequisite = STALLS.find(
    (stall) => stall.id === STALL_WITH_PREREQUISITE.unlockRequirement.prerequisiteIds[0],
  )!;

  it("names the level first, then the reputation, then the missing prerequisite", () => {
    expect([
      unlockLabel(item, 2, 50, []),
      unlockLabel(item, 3, 19, []),
      unlockLabel(item, 3, 20, []),
    ]).toEqual(["Level 3", "Rep 20", `After ${localize(prerequisite.nameKey)}`]);
  });

  it("falls back to Locked once every requirement is met or names unknown content", () => {
    expect([
      unlockLabel(item, 3, 20, [prerequisite.id]),
      unlockLabel(
        { ...item, unlockRequirement: { ...item.unlockRequirement, prerequisiteIds: ["x"] } },
        3,
        20,
        [],
      ),
    ]).toEqual(["Locked", "Locked"]);
  });

  it("names the stall tender day once every other requirement is met", () => {
    expect([
      unlockLabel(item, 3, 20, [prerequisite.id], 6),
      unlockLabel(item, 2, 20, [prerequisite.id], 6),
    ]).toEqual(["Tender on day 6", "Level 3"]);
  });
});

describe("utility effects", () => {
  it("lists each effect once", () => {
    for (const placeable of PLACEABLES) {
      const effects = utilityEffects(placeable);
      expect(new Set(effects).size).toBe(effects.length);
    }
  });

  it("uses the first effect as the primary utility", () => {
    const placeable = PLACEABLES.find((candidate) => utilityEffects(candidate).length > 0)!;

    expect(primaryUtility(placeable)).toBe(utilityEffects(placeable)[0]);
  });

  it("describes route shaping when a placeable has no effect", () => {
    const decor = PLACEABLES.find((candidate) => candidate.category === "decor")!;
    const inert: PlaceableDefinition = {
      ...decor,
      ambienceValue: 0,
      cleanlinessModifier: 0,
      serviceModifiers: {
        queuePatience: 0,
        eatingSpeed: 0,
        cleaningEfficiency: 0,
        movementSpeed: 0,
      },
      lightRadius: 0,
      interactionPoints: [],
      queuePoints: [],
    };

    expect([
      primaryUtility({ ...inert, walkability: "blocked" }),
      primaryUtility({ ...inert, walkability: "pass-through" }),
    ]).toEqual(["Shapes guest routes", "Walk-through decor"]);
  });
});

describe("nutritionProfileView", () => {
  it("is the runtime summary of the dish's content profile", () => {
    expect(nutritionProfileView(PROFILED_DISH_ID)).toEqual(
      runtimeNutritionProfile(coreNutritionProfile(getNutritionProfile(PROFILED_DISH_ID))),
    );
  });

  it("is undefined for a dish without a profile", () => {
    expect(nutritionProfileView("dish.unknown")).toBeUndefined();
  });
});

describe("PANEL_COPY", () => {
  it("pins the kicker and title of every panel section", () => {
    expect(PANEL_COPY).toEqual({
      focus: { kicker: "Today at a glance", title: "Focus" },
      build: { kicker: "Build catalogue", title: "Make it yours" },
      stalls: { kicker: "Food & drink", title: "Stalls" },
      dishes: { kicker: "Dishes & nutrition", title: "Menu planning" },
      insights: { kicker: "Service review", title: "Centre insights" },
      activity: { kicker: "Recent events", title: "Activity" },
    });
  });
});

describe("format_progress_percent", () => {
  it("writes the filled share as a CSS percentage", () => {
    expect(format_progress_percent(48, 120)).toBe("40%");
  });

  it("caps the share at 100 and counts a target below 1 as 1", () => {
    expect([format_progress_percent(9, 3), format_progress_percent(0.5, 0)]).toEqual([
      "100%",
      "50%",
    ]);
  });
});

describe("format_hex_colour", () => {
  it("pads a packed RGB colour to six lowercase hex digits", () => {
    expect([format_hex_colour(0xc75542), format_hex_colour(0x00ff)]).toEqual([
      "#c75542",
      "#0000ff",
    ]);
  });
});

describe("humanize_id", () => {
  it("strips the prefix and replaces every hyphen by default", () => {
    expect(humanize_id("dish.mystery-noodle-soup", { prefix: "dish." })).toBe(
      "mystery noodle soup",
    );
  });

  it("keeps an ID that does not start with the prefix", () => {
    expect(humanize_id("stall.kopi-bar", { prefix: "dish." })).toBe("stall.kopi bar");
  });

  it("replaces only the first hyphen when asked", () => {
    expect(humanize_id("a-b-c", { shouldReplaceAll: false })).toBe("a b-c");
  });
});

describe("is_requirement_met", () => {
  const requirement = { level: 3, reputation: 20, prerequisiteIds: ["stall.a", "stall.b"] };
  const centre = { level: 3, reputation: 20, unlockedContentIds: ["stall.a", "stall.b"] };

  it("is met when the level, reputation and every prerequisite are", () => {
    expect(is_requirement_met(requirement, centre)).toBe(true);
  });

  it("is unmet when any one part is short", () => {
    expect([
      is_requirement_met(requirement, { ...centre, level: 2 }),
      is_requirement_met(requirement, { ...centre, reputation: 19 }),
      is_requirement_met(requirement, { ...centre, unlockedContentIds: ["stall.a"] }),
    ]).toEqual([false, false, false]);
  });
});

describe("is_requirement_met for an owned stall's dishes", () => {
  const stall = {
    id: "stall.a",
    unlockRequirement: { level: 5, reputation: 25, prerequisiteIds: [] },
  };
  const owned = { level: 1, reputation: 8, unlockedContentIds: ["stall.a"] };

  it("meets a dish gated no later than its unlocked stall below the dish's own gates", () => {
    expect(
      is_requirement_met({ level: 5, reputation: 25, prerequisiteIds: ["stall.a"] }, owned, stall),
    ).toBe(true);
  });

  it("keeps a dish gated above its stall, or of a locked stall, unmet", () => {
    const opening = { level: 5, reputation: 25, prerequisiteIds: ["stall.a"] };
    expect([
      is_requirement_met({ ...opening, level: 6 }, owned, stall),
      is_requirement_met({ ...opening, reputation: 26 }, owned, stall),
      is_requirement_met(opening, { ...owned, unlockedContentIds: [] }, stall),
      is_requirement_met(opening, owned),
    ]).toEqual([false, false, false, false]);
  });
});

describe("get_unlock_reputation", () => {
  it("reads the best reputation reached, falling back to the live one", () => {
    expect([
      get_unlock_reputation({ reputation: 6, peakReputation: 12 }),
      get_unlock_reputation({ reputation: 14, peakReputation: 12 }),
      get_unlock_reputation({ reputation: 6 }),
    ]).toEqual([12, 14, 6]);
  });

  it("lets a requirement stay met after the live reputation falls below it", () => {
    const requirement = { level: 1, reputation: 10, prerequisiteIds: [] };
    expect(
      is_requirement_met(requirement, {
        level: 1,
        reputation: 7,
        peakReputation: 10,
        unlockedContentIds: [],
      }),
    ).toBe(true);
  });
});

describe("in-game clock formatting", () => {
  it.each<[number, string]>([
    [630, "10:30 AM"],
    [720, "12:00 PM"],
    [714.4, "11:54 AM"],
    [1110, "6:30 PM"],
  ])("formats minute %s as %s", (minute, expected) => {
    expect(format_minute_of_day(minute)).toBe(expected);
  });

  it("names AM or PM once when both ends of a span share it", () => {
    expect([format_minute_range(720, 840), format_minute_range(714, 786)]).toEqual([
      "12:00–2:00 PM",
      "11:54 AM–1:06 PM",
    ]);
  });
});

describe("describe_writer_verdict", () => {
  it("celebrates a plaque with a star and words", () => {
    expect(describe_writer_verdict("Kopi Canopy", "plaque")).toEqual({
      glyph: "★",
      text: "Kopi Canopy earned a Writer's Pick plaque!",
    });
  });

  it("describes the other outcomes gently, never as a failure", () => {
    const lines = (["no-plaque", "too-few-visits"] as const).map(
      (outcome) => describe_writer_verdict("Kopi Canopy", outcome).text,
    );
    expect([lines, lines.some((line) => /fail|poor|bad/i.test(line))]).toEqual([
      [
        "The food writer enjoyed their visit to Kopi Canopy and will be back another day.",
        "The food writer saw too few meals at Kopi Canopy to write a review. They will be back another day.",
      ],
      false,
    ]);
  });
});

describe("event kind glyphs", () => {
  it("pins the toast glyph of each kind", () => {
    expect(TOAST_KIND_GLYPHS).toEqual({ success: "✓", error: "!", warning: "i", info: "i" });
  });

  it("pins the activity feed glyph of each kind", () => {
    expect(ACTIVITY_KIND_GLYPHS).toEqual({ success: "✓", warning: "!", error: "×", info: "i" });
  });
});

describe("starting economy", () => {
  it("matches the cash and reputation the initial HUD snapshot used to hard-code", () => {
    expect([ECONOMY.startingCash, ECONOMY.startingReputation]).toEqual([4_200, 8]);
  });
});
