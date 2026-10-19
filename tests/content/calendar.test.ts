import { describe, expect, it } from "vitest";

import {
  CALENDAR_CARDS,
  CALENDAR_CARD_BY_ID,
  CUSTOMER_ARCHETYPES,
  dishCategorySchema,
} from "@/src/content";

/** Fewest cards the shuffle bag needs so no card can repeat on consecutive days. */
const MIN_BAG_CARDS = 3;
/** Words the card copy must not use: it describes activities, never people or food as good or bad. */
const DISALLOWED_COPY =
  /\b(healthy|unhealthy|good food|bad food|junk|elderly|seniors?|aunties?|uncles?|malay|chinese|indian|eurasian)\b/i;

describe("calendar cards", () => {
  it("have unique IDs and exactly one opening day", () => {
    expect(new Set(CALENDAR_CARDS.map((card) => card.id)).size).toBe(CALENDAR_CARDS.length);
    expect(CALENDAR_CARDS.filter((card) => card.isOpeningDay)).toHaveLength(1);
    expect(CALENDAR_CARD_BY_ID.size).toBe(CALENDAR_CARDS.length);
  });

  it("leave enough cards in the bag to avoid repeats", () => {
    expect(CALENDAR_CARDS.filter((card) => !card.isOpeningDay).length).toBeGreaterThanOrEqual(
      MIN_BAG_CARDS,
    );
  });

  it("name only launch archetypes and dish categories", () => {
    const archetype_ids = new Set(CUSTOMER_ARCHETYPES.map((archetype) => archetype.id));
    const categories = new Set(dishCategorySchema.options);
    for (const card of CALENDAR_CARDS) {
      for (const entry of card.archetypeFactors) expect(archetype_ids).toContain(entry.archetypeId);
      for (const entry of card.categoryAppeal) expect(categories).toContain(entry.category);
    }
  });

  it("include calm and busy days for the director to choose between", () => {
    const bag = CALENDAR_CARDS.filter((card) => !card.isOpeningDay);
    expect(bag.some((card) => card.intensity <= 0.3)).toBe(true);
    expect(bag.some((card) => card.intensity >= 0.7)).toBe(true);
  });

  it("keep the opening day ordinary", () => {
    const opening = CALENDAR_CARDS.find((card) => card.isOpeningDay)!;
    expect([
      opening.arrivalFactor,
      opening.lunchPeakFactor,
      opening.dinnerPeakFactor,
      opening.eatingTimeFactor,
    ]).toEqual([1, 1, 1, 1]);
    expect(opening.archetypeFactors).toEqual([]);
    expect(opening.categoryAppeal).toEqual([]);
  });

  it("describe activities in warm copy without labelling food or people", () => {
    for (const card of CALENDAR_CARDS) {
      for (const text of [card.copy.name, card.copy.summary, card.copy.forecast]) {
        expect(text).not.toMatch(DISALLOWED_COPY);
      }
    }
  });
});
