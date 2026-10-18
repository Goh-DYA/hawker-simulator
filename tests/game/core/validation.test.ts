/**
 * Characterisation of `validateCatalog`'s issue list, one malformed record per record type.
 *
 * Each case corrupts many fields of a single placeable, dish or archetype in the synthetic
 * `TEST_CATALOG` and pins every issue the validator reports, in order, with its exact path
 * and message. The issue order follows the order of the checks inside the validator, so a
 * refactor that reorders, merges or rewords a check fails here.
 */
import { describe, expect, it } from "vitest";

import {
  validateCatalog,
  type CustomerArchetype,
  type DishDefinition,
  type PlaceableDefinition,
  type SimulationCatalog,
} from "@/src/game/core";
import { TEST_CATALOG, TEST_STALL_CONFIG } from "./fixtures";

/**
 * Build a copy of the test catalog with extra or replaced records.
 *
 * @param records - Records to add to, or replace in, each record type, keyed by record key.
 * @returns The catalog to validate.
 */
function build_catalog(records: {
  readonly placeables?: Record<string, unknown>;
  readonly dishes?: Record<string, unknown>;
  readonly archetypes?: Record<string, unknown>;
}): SimulationCatalog {
  return {
    placeables: {
      ...TEST_CATALOG.placeables,
      ...(records.placeables as Record<string, PlaceableDefinition>),
    },
    dishes: { ...TEST_CATALOG.dishes, ...(records.dishes as Record<string, DishDefinition>) },
    archetypes: {
      ...TEST_CATALOG.archetypes,
      ...(records.archetypes as Record<string, CustomerArchetype>),
    },
  };
}

describe("validateCatalog", () => {
  it("accepts the test catalog", () => {
    expect(validateCatalog(TEST_CATALOG)).toEqual([]);
  });

  it("accepts values on every inclusive range limit", () => {
    const catalog = build_catalog({
      placeables: {
        stall: {
          ...TEST_CATALOG.placeables.stall,
          refundRate: 1,
          stall: { ...TEST_STALL_CONFIG, quality: 5 },
        },
        seat: { ...TEST_CATALOG.placeables.seat, refundRate: 0 },
      },
      dishes: {
        noodles: {
          ...TEST_CATALOG.dishes.noodles,
          quality: 5,
          starRating: 5,
          nutritionVariants: [
            { profile: { healthRating: 5, conditionRatings: { diabetes: 5, obesity: 1 } } },
          ],
        },
        rice: { ...TEST_CATALOG.dishes.rice, quality: 0, starRating: 1 },
      },
      archetypes: {
        regular: { ...TEST_CATALOG.archetypes.regular, unlockReputation: 5 },
        valueSeeker: { ...TEST_CATALOG.archetypes.valueSeeker, unlockReputation: 0 },
      },
    });

    expect(validateCatalog(catalog)).toEqual([]);
  });

  it("reports placeables, then dishes, then archetypes", () => {
    const catalog = build_catalog({
      archetypes: { regular: { ...TEST_CATALOG.archetypes.regular, budget: -1 } },
      dishes: { rice: { ...TEST_CATALOG.dishes.rice, quality: 6 } },
      placeables: { seat: { ...TEST_CATALOG.placeables.seat, price: -1 } },
    });

    expect(validateCatalog(catalog)).toEqual([
      { path: "placeables.seat.price", message: "must be a non-negative number" },
      { path: "dishes.rice.quality", message: "must be between zero and five" },
      { path: "archetypes.regular.budget", message: "must be a non-negative number" },
    ]);
  });

  it("pins every issue for a malformed stall placeable", () => {
    const catalog = build_catalog({
      placeables: {
        "bad key": {
          ...TEST_CATALOG.placeables.stall,
          id: "stall",
          allowedRotations: [45],
          footprint: {
            width: 2,
            height: 1.5,
            cells: [
              { x: 0, y: 0 },
              { x: 0, y: 0 },
              { x: 2, y: 0 },
              { x: 0.5, y: 0 },
            ],
          },
          price: -1,
          refundRate: 2,
          unlockLevel: 0,
          stall: {
            ...TEST_STALL_CONFIG,
            orderMs: 0,
            preparationCapacity: 1.5,
            queueCapacity: 0,
            popularity: -1,
            quality: 6,
            dishIds: ["noodles", "Bad id!", "ghost"],
          },
          seatPoints: "x",
          servicePoint: { x: 0.5, y: 2 },
          trayReturnPoint: { x: 0, y: Infinity },
        },
      },
    });
    const path = "placeables.bad key";

    expect(validateCatalog(catalog)).toEqual([
      { path, message: "record key must be a non-empty safe ID" },
      { path: `${path}.id`, message: "must match its record key" },
      { path: `${path}.allowedRotations`, message: "may contain only 0, 90, 180, and 270" },
      { path: `${path}.footprint.height`, message: "must be a positive integer" },
      { path: `${path}.footprint.cells[1]`, message: "must be unique" },
      { path: `${path}.footprint.cells[2]`, message: "must be inside the footprint bounds" },
      { path: `${path}.footprint.cells[3]`, message: "must use finite integer coordinates" },
      { path: `${path}.price`, message: "must be a non-negative number" },
      { path: `${path}.refundRate`, message: "must be between zero and one" },
      { path: `${path}.unlockLevel`, message: "must be a positive integer" },
      { path: `${path}.stall.orderMs`, message: "must be a positive number" },
      { path: `${path}.stall.preparationCapacity`, message: "must be a positive integer" },
      { path: `${path}.stall.queueCapacity`, message: "must be a positive integer" },
      { path: `${path}.stall.popularity`, message: "must be a non-negative number" },
      { path: `${path}.stall.quality`, message: "must be between zero and five" },
      { path: `${path}.stall.dishIds`, message: "contains an invalid dish ID" },
      { path: `${path}.stall.dishIds`, message: "references unknown dish ghost" },
      { path: `${path}.seatPoints`, message: "must be an array" },
      { path: `${path}.servicePoint`, message: "must use finite integer coordinates" },
      { path: `${path}.trayReturnPoint`, message: "must use finite integer coordinates" },
    ]);
  });

  it("pins every issue for placeables missing their kind's required parts", () => {
    const { stall, seat, tray } = TEST_CATALOG.placeables;
    const catalog = build_catalog({
      placeables: {
        missing: null,
        "bare-stall": {
          ...stall,
          id: "bare-stall",
          stall: undefined,
          servicePoint: undefined,
          queueAnchor: undefined,
        },
        "empty-seat": { ...seat, id: "empty-seat", seatPoints: [] },
        "pointless-tray": { ...tray, id: "pointless-tray", trayReturnPoint: undefined },
        "no-footprint": { ...seat, id: "no-footprint", footprint: undefined, allowedRotations: [] },
      },
    });

    expect(validateCatalog(catalog)).toEqual([
      { path: "placeables.missing", message: "must be an object" },
      { path: "placeables.bare-stall.stall", message: "must be an object for stall definitions" },
      { path: "placeables.bare-stall.servicePoint", message: "is required for stall definitions" },
      { path: "placeables.bare-stall.queueAnchor", message: "is required for stall definitions" },
      { path: "placeables.empty-seat.seatPoints", message: "must not be empty for seats" },
      {
        path: "placeables.pointless-tray.trayReturnPoint",
        message: "is required for tray-return facilities",
      },
      { path: "placeables.no-footprint.allowedRotations", message: "must be a non-empty array" },
      { path: "placeables.no-footprint.footprint", message: "must be an object" },
    ]);
  });

  it("pins every issue for a malformed dish", () => {
    const catalog = build_catalog({
      dishes: {
        noodles: {
          ...TEST_CATALOG.dishes.noodles,
          id: "Noodles!",
          price: Number.NaN,
          preparationMs: 0,
          eatingMs: -5,
          quality: -1,
          starRating: 0,
          nutritionVariants: [
            { profile: { healthRating: 6, conditionRatings: { diabetes: 0, "made-up": 3 } } },
            { profile: undefined },
            { profile: { healthRating: 3, conditionRatings: { obesity: Infinity } } },
          ],
        },
        "Bad Key!": null,
      },
    });
    const path = "dishes.noodles";

    expect(validateCatalog(catalog)).toEqual([
      { path: `${path}.id`, message: "must be a non-empty safe ID" },
      { path: `${path}.price`, message: "must be a non-negative number" },
      { path: `${path}.preparationMs`, message: "must be a positive number" },
      { path: `${path}.eatingMs`, message: "must be a positive number" },
      { path: `${path}.quality`, message: "must be between zero and five" },
      { path: `${path}.starRating`, message: "must be between one and five" },
      {
        path: `${path}.nutritionVariants[0].profile.healthRating`,
        message: "must be between one and five",
      },
      {
        path: `${path}.nutritionVariants[0].profile.conditionRatings.diabetes`,
        message: "must be between one and five",
      },
      {
        path: `${path}.nutritionVariants[0].profile.conditionRatings.made-up`,
        message: "is not a supported health condition",
      },
      {
        path: `${path}.nutritionVariants[2].profile.conditionRatings.obesity`,
        message: "must be between one and five",
      },
      { path: "dishes.Bad Key!", message: "record key must be a non-empty safe ID" },
      { path: "dishes.Bad Key!", message: "must be an object" },
    ]);
  });

  it("pins every issue for a malformed archetype", () => {
    const catalog = build_catalog({
      archetypes: {
        regular: {
          ...TEST_CATALOG.archetypes.regular,
          id: "valueSeeker",
          budget: -1,
          patienceMs: 0,
          walkingSpeed: Infinity,
          priceSensitivity: -0.5,
          distanceSensitivity: Number.NaN,
          noveltyPreference: -1,
          unlockLevel: 1.5,
          unlockReputation: 6,
          unlockPrerequisiteIds: ["a", "a", "Bad id!"],
          visitSchedule: { startHour: 24, endHour: 24, peakMultiplier: 0 },
        },
      },
    });
    const path = "archetypes.regular";

    expect(validateCatalog(catalog)).toEqual([
      { path: `${path}.id`, message: "must match its record key" },
      { path: `${path}.budget`, message: "must be a non-negative number" },
      { path: `${path}.patienceMs`, message: "must be a positive number" },
      { path: `${path}.walkingSpeed`, message: "must be a positive number" },
      { path: `${path}.priceSensitivity`, message: "must be a non-negative number" },
      { path: `${path}.distanceSensitivity`, message: "must be a non-negative number" },
      { path: `${path}.noveltyPreference`, message: "must be a non-negative number" },
      { path: `${path}.unlockLevel`, message: "must be an integer" },
      { path: `${path}.unlockReputation`, message: "must be between zero and five" },
      { path: `${path}.unlockPrerequisiteIds`, message: "must not contain duplicates" },
      { path: `${path}.unlockPrerequisiteIds`, message: "must contain only non-empty safe IDs" },
      { path: `${path}.visitSchedule.startHour`, message: "must be an hour from 0 to 23" },
      {
        path: `${path}.visitSchedule.endHour`,
        message: "must be later than startHour and at most 24",
      },
      { path: `${path}.visitSchedule.peakMultiplier`, message: "must be a positive number" },
    ]);
  });

  it("pins the record-shape issues and stops before checking records", () => {
    const not_records = {
      placeables: [],
      dishes: null,
      archetypes: "none",
    } as unknown as SimulationCatalog;

    expect(validateCatalog(not_records)).toEqual([
      { path: "placeables", message: "must be a record" },
      { path: "dishes", message: "must be a record" },
      { path: "archetypes", message: "must be a record" },
    ]);
  });

  it("requires at least one archetype", () => {
    const no_archetypes = { ...TEST_CATALOG, archetypes: {} };

    expect(validateCatalog(no_archetypes)).toEqual([
      { path: "archetypes", message: "must contain at least one archetype" },
    ]);
  });
});
