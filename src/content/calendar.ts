/**
 * The neighbourhood calendar: fictional local happenings that shape an operating day.
 *
 * Each card changes how many guests come, which personas are out, how the lunch and dinner
 * crowds peak, how long guests linger and which dish categories appeal more. Cards describe
 * activities (an office move-in, a sports day, a football final, the weather), never who people
 * are, so demand is never tied to ethnicity, age or other protected characteristics. Every card
 * leaves at least two good responses open: change the menu or variants, or reshape queues,
 * seating and tray returns.
 *
 * The English copy is kept with the cards rather than in the launch localization table. The
 * cards are parsed with `calendarCardSchema` at import, so a malformed card fails fast.
 */
import { z } from "zod";

import { calendarCardSchema } from "./schemas";
import type { CalendarCardContent } from "./types";

const AUTHORED_CALENDAR_CARDS: readonly z.input<typeof calendarCardSchema>[] = [
  {
    id: "calendar.opening-day",
    isOpeningDay: true,
    intensity: 0.2,
    arrivalFactor: 0.85,
    lunchPeakFactor: 0.8,
    dinnerPeakFactor: 0.85,
    eatingTimeFactor: 1,
    archetypeFactors: [],
    categoryAppeal: [],
    copy: {
      name: "Opening day",
      summary: "A gentler crowd while you find your feet.",
      forecast:
        "The neighbourhood is curious about the new hall. Expect a gentler crowd while you find your feet.",
    },
  },
  {
    id: "calendar.quiet-weekday",
    isOpeningDay: false,
    intensity: 0.1,
    arrivalFactor: 0.9,
    lunchPeakFactor: 0.85,
    dinnerPeakFactor: 0.85,
    eatingTimeFactor: 1,
    archetypeFactors: [{ archetypeId: "customer.quiet-break-regular", factor: 1.4 }],
    categoryAppeal: [],
    copy: {
      name: "Quiet weekday",
      summary: "Gentle crowds. A good day to rearrange or try a recipe.",
      forecast:
        "A gentle weekday is coming: smaller crowds and a good chance to rearrange or try a new recipe.",
    },
  },
  {
    id: "calendar.late-morning-kopi-crowd",
    isOpeningDay: false,
    intensity: 0.3,
    arrivalFactor: 1,
    lunchPeakFactor: 0.9,
    dinnerPeakFactor: 1,
    eatingTimeFactor: 1,
    archetypeFactors: [
      { archetypeId: "customer.early-shift-regular", factor: 2 },
      { archetypeId: "customer.quiet-break-regular", factor: 1.5 },
    ],
    categoryAppeal: [
      { category: "drink", bonus: 1.2 },
      { category: "bread", bonus: 0.8 },
    ],
    copy: {
      name: "Late-morning kopi crowd",
      summary: "An early wave wanting kopi and toast.",
      forecast: "Expect an early wave of kopi and toast orders before the lunch crowd arrives.",
    },
  },
  {
    id: "calendar.office-move-in-week",
    isOpeningDay: false,
    intensity: 0.8,
    arrivalFactor: 1.05,
    lunchPeakFactor: 1.35,
    dinnerPeakFactor: 0.9,
    eatingTimeFactor: 0.9,
    archetypeFactors: [{ archetypeId: "customer.office-lunch-sprinter", factor: 2.2 }],
    categoryAppeal: [
      { category: "rice", bonus: 0.8 },
      { category: "noodles", bonus: 0.6 },
    ],
    copy: {
      name: "Office move-in week",
      summary: "A sharp, hurried lunch rush. Quick rice and noodles sell.",
      forecast:
        "A new office block has opened nearby. Tomorrow's lunch rush will be sharp and in a hurry.",
    },
  },
  {
    id: "calendar.school-sports-day",
    isOpeningDay: false,
    intensity: 0.7,
    arrivalFactor: 1.05,
    lunchPeakFactor: 1.1,
    dinnerPeakFactor: 1,
    eatingTimeFactor: 1.1,
    archetypeFactors: [
      { archetypeId: "customer.student-saver", factor: 1.8 },
      { archetypeId: "customer.family-table", factor: 1.8 },
    ],
    categoryAppeal: [
      { category: "dessert", bonus: 1 },
      { category: "drink", bonus: 0.8 },
    ],
    copy: {
      name: "School sports day",
      summary: "Students and families after the meet. Drinks and desserts sell.",
      forecast:
        "Families and students will drop by after the sports meet. Expect groups, drinks and desserts.",
    },
  },
  {
    id: "calendar.community-football-final",
    isOpeningDay: false,
    intensity: 0.85,
    arrivalFactor: 1.05,
    lunchPeakFactor: 0.9,
    dinnerPeakFactor: 1.6,
    eatingTimeFactor: 1.25,
    archetypeFactors: [{ archetypeId: "customer.evening-social-diner", factor: 2.2 }],
    categoryAppeal: [
      { category: "drink", bonus: 1.2 },
      { category: "small-plate", bonus: 0.8 },
    ],
    copy: {
      name: "Community football final",
      summary: "A lively dinner crowd that lingers over drinks and small plates.",
      forecast:
        "The neighbourhood is watching the final together tomorrow evening. Expect a lively dinner crowd that lingers.",
    },
  },
  {
    id: "calendar.heatwave-afternoon",
    isOpeningDay: false,
    intensity: 0.5,
    arrivalFactor: 0.95,
    lunchPeakFactor: 0.9,
    dinnerPeakFactor: 1,
    eatingTimeFactor: 1,
    archetypeFactors: [{ archetypeId: "customer.afternoon-treat-stopper", factor: 1.8 }],
    categoryAppeal: [
      { category: "drink", bonus: 1.5 },
      { category: "dessert", bonus: 1.2 },
      { category: "soup", bonus: -0.6 },
    ],
    copy: {
      name: "Heatwave afternoon",
      summary: "Cold drinks and desserts are in demand; hot soups less so.",
      forecast:
        "Tomorrow will be hot and still. Cold drinks and desserts will be in demand, hot soups less so.",
    },
  },
  {
    id: "calendar.monsoon-shower",
    isOpeningDay: false,
    intensity: 0.6,
    arrivalFactor: 0.9,
    lunchPeakFactor: 1,
    dinnerPeakFactor: 1,
    eatingTimeFactor: 1.35,
    archetypeFactors: [],
    categoryAppeal: [
      { category: "soup", bonus: 1.2 },
      { category: "noodles", bonus: 0.8 },
    ],
    copy: {
      name: "Monsoon shower",
      summary: "Guests shelter and linger over hot bowls, so seats run short.",
      forecast:
        "Rain is expected tomorrow. Guests will shelter and linger over hot bowls, so seats will be scarce.",
    },
  },
  {
    id: "calendar.heritage-food-walk",
    isOpeningDay: false,
    intensity: 0.65,
    arrivalFactor: 1,
    lunchPeakFactor: 1.05,
    dinnerPeakFactor: 1,
    eatingTimeFactor: 1,
    archetypeFactors: [
      { archetypeId: "customer.curious-food-explorer", factor: 2.2 },
      { archetypeId: "customer.quality-treat-seeker", factor: 1.6 },
    ],
    categoryAppeal: [
      { category: "small-plate", bonus: 0.8 },
      { category: "seafood", bonus: 0.8 },
    ],
    copy: {
      name: "Heritage food walk",
      summary: "Curious visitors want to try something new.",
      forecast:
        "A heritage food walk passes through tomorrow. Curious visitors will want to try something new.",
    },
  },
  {
    id: "calendar.public-holiday-families",
    isOpeningDay: false,
    intensity: 0.6,
    arrivalFactor: 1.05,
    lunchPeakFactor: 1.2,
    dinnerPeakFactor: 1,
    eatingTimeFactor: 1.15,
    archetypeFactors: [
      { archetypeId: "customer.family-table", factor: 2 },
      { archetypeId: "customer.comfort-seeking-regular", factor: 1.4 },
      { archetypeId: "customer.office-lunch-sprinter", factor: 0.4 },
    ],
    categoryAppeal: [{ category: "rice", bonus: 0.6 }],
    copy: {
      name: "Public holiday: families out",
      summary: "Families are out together; the office crowd stays home.",
      forecast:
        "Tomorrow is a public holiday. Families will be out together, and the office crowd will stay home.",
    },
  },
];

/** Every calendar card, parsed and frozen, in authored order. */
export const CALENDAR_CARDS: readonly CalendarCardContent[] = Object.freeze(
  z.array(calendarCardSchema).parse(AUTHORED_CALENDAR_CARDS),
);

/** Calendar cards keyed by ID, built once in authored order. */
export const CALENDAR_CARD_BY_ID: ReadonlyMap<string, CalendarCardContent> = new Map(
  CALENDAR_CARDS.map((card) => [card.id, card]),
);
