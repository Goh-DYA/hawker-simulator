/**
 * Simulation catalog validation and the shared simulation ID rule.
 *
 * `validateCatalog` checks the record shapes first and stops there if any section is not a
 * record. It then runs one rule group per record type, placeables, dishes and archetypes in
 * that order, so the issue list keeps a stable order for the runtime and the tests. A thrown
 * error from deeply malformed data is reported as a single issue instead of escaping.
 */
import type { CustomerArchetype, DishDefinition, PlaceableDefinition, SimulationCatalog } from "./types";
import { ROTATIONS } from "./enums";
import { HEALTH_CONDITIONS } from "./nutrition";

/** One catalog validation problem: the path of the offending value and what is wrong with it. */
export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

const SIMULATION_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

/**
 * Tests whether a value is a well-formed simulation ID.
 *
 * @param value - The value to test.
 * @returns True when the value is a string matching the simulation ID pattern.
 */
export function isValidSimulationId(value: unknown): value is string {
  return typeof value === "string" && SIMULATION_ID_PATTERN.test(value);
}

/**
 * Thrown by {@link assertValidCatalog} when a catalog has issues; `issues` lists every one of them.
 */
export class CatalogValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(`Simulation catalog is invalid (${issues.length} issue${issues.length === 1 ? "" : "s"})`);
    this.name = "CatalogValidationError";
    this.issues = issues;
  }
}

function positiveNumber(value: number, path: string, issues: ValidationIssue[], allowZero = false): void {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
    issues.push({ path, message: allowZero ? "must be a non-negative number" : "must be a positive number" });
  }
}

function positiveInteger(value: number, path: string, issues: ValidationIssue[]): void {
  if (!Number.isInteger(value) || value <= 0) issues.push({ path, message: "must be a positive integer" });
}

function gridPoint(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is { readonly x: number; readonly y: number } {
  if (
    !value ||
    typeof value !== "object" ||
    !("x" in value) ||
    !("y" in value) ||
    typeof value.x !== "number" ||
    typeof value.y !== "number" ||
    !Number.isInteger(value.x) ||
    !Number.isInteger(value.y)
  ) {
    issues.push({ path, message: "must use finite integer coordinates" });
    return false;
  }
  return true;
}

/**
 * Checks a record's key and `id`, and that the record is an object at all.
 *
 * @param key - The record key in its catalog section.
 * @param record - The record stored under that key.
 * @param path - The issue path of the record.
 * @param issues - The issue list to append to.
 * @returns True when the record is an object whose remaining fields can be checked.
 */
function check_record_identity(
  key: string,
  record: { readonly id: string } | null | undefined,
  path: string,
  issues: ValidationIssue[],
): boolean {
  if (!isValidSimulationId(key)) issues.push({ path, message: "record key must be a non-empty safe ID" });
  if (!record || typeof record !== "object") {
    issues.push({ path, message: "must be an object" });
    return false;
  }
  if (!isValidSimulationId(record.id)) issues.push({ path: `${path}.id`, message: "must be a non-empty safe ID" });
  else if (record.id !== key) issues.push({ path: `${path}.id`, message: "must match its record key" });
  return true;
}

/**
 * Reports a value that is not a finite number inside an inclusive range.
 *
 * @param value - The value to check.
 * @param min - The smallest allowed value.
 * @param max - The largest allowed value.
 * @param path - The issue path of the value.
 * @param message - The issue message, which names the range.
 * @param issues - The issue list to append to.
 */
function check_range(
  value: number,
  min: number,
  max: number,
  path: string,
  message: string,
  issues: ValidationIssue[],
): void {
  if (!Number.isFinite(value) || value < min || value > max) issues.push({ path, message });
}

/**
 * Checks one placeable definition: rotations, footprint, price, kind-specific parts and points.
 *
 * @param catalog - The catalog, whose dishes stall menus must reference.
 * @param path - The issue path of the definition.
 * @param definition - The definition to check.
 * @param issues - The issue list to append to.
 */
function validate_placeable(
  catalog: SimulationCatalog,
  path: string,
  definition: PlaceableDefinition,
  issues: ValidationIssue[],
): void {
  if (!Array.isArray(definition.allowedRotations) || definition.allowedRotations.length === 0) {
    issues.push({ path: `${path}.allowedRotations`, message: "must be a non-empty array" });
  } else if (definition.allowedRotations.some((rotation) => !ROTATIONS.includes(rotation))) {
    issues.push({ path: `${path}.allowedRotations`, message: "may contain only 0, 90, 180, and 270" });
  }
  if (!definition.footprint || typeof definition.footprint !== "object") {
    issues.push({ path: `${path}.footprint`, message: "must be an object" });
  } else {
    positiveInteger(definition.footprint.width, `${path}.footprint.width`, issues);
    positiveInteger(definition.footprint.height, `${path}.footprint.height`, issues);
  }
  if (definition.footprint && typeof definition.footprint === "object" && definition.footprint.cells !== undefined) {
    if (!Array.isArray(definition.footprint.cells) || definition.footprint.cells.length === 0) {
      issues.push({ path: `${path}.footprint.cells`, message: "must be a non-empty array when provided" });
    } else {
      const seen = new Set<string>();
      definition.footprint.cells.forEach((cell, index) => {
        if (!gridPoint(cell, `${path}.footprint.cells[${index}]`, issues)) return;
        const key = `${cell.x},${cell.y}`;
        if (seen.has(key)) issues.push({ path: `${path}.footprint.cells[${index}]`, message: "must be unique" });
        seen.add(key);
        if (cell.x < 0 || cell.y < 0 || cell.x >= definition.footprint.width || cell.y >= definition.footprint.height) {
          issues.push({ path: `${path}.footprint.cells[${index}]`, message: "must be inside the footprint bounds" });
        }
      });
    }
  }
  positiveNumber(definition.price, `${path}.price`, issues, true);
  if (definition.refundRate !== undefined) {
    check_range(definition.refundRate, 0, 1, `${path}.refundRate`, "must be between zero and one", issues);
  }
  if (definition.unlockLevel !== undefined && (!Number.isInteger(definition.unlockLevel) || definition.unlockLevel < 1)) {
    issues.push({ path: `${path}.unlockLevel`, message: "must be a positive integer" });
  }
  if (definition.kind === "stall") {
    if (!definition.stall || typeof definition.stall !== "object") {
      issues.push({ path: `${path}.stall`, message: "must be an object for stall definitions" });
    }
    if (!definition.servicePoint) issues.push({ path: `${path}.servicePoint`, message: "is required for stall definitions" });
    if (!definition.queueAnchor) issues.push({ path: `${path}.queueAnchor`, message: "is required for stall definitions" });
    if (definition.stall && typeof definition.stall === "object") {
      positiveNumber(definition.stall.orderMs, `${path}.stall.orderMs`, issues);
      positiveInteger(definition.stall.preparationCapacity, `${path}.stall.preparationCapacity`, issues);
      positiveInteger(definition.stall.queueCapacity, `${path}.stall.queueCapacity`, issues);
      positiveNumber(definition.stall.popularity, `${path}.stall.popularity`, issues, true);
      check_range(definition.stall.quality, 0, 5, `${path}.stall.quality`, "must be between zero and five", issues);
      if (!Array.isArray(definition.stall.dishIds) || definition.stall.dishIds.length === 0) {
        issues.push({ path: `${path}.stall.dishIds`, message: "must not be empty" });
      }
      for (const dishId of Array.isArray(definition.stall.dishIds) ? definition.stall.dishIds : []) {
        if (!isValidSimulationId(dishId)) issues.push({ path: `${path}.stall.dishIds`, message: "contains an invalid dish ID" });
        else if (!catalog.dishes[dishId]) issues.push({ path: `${path}.stall.dishIds`, message: `references unknown dish ${dishId}` });
      }
    }
  }
  if (definition.seatPoints !== undefined && !Array.isArray(definition.seatPoints)) {
    issues.push({ path: `${path}.seatPoints`, message: "must be an array" });
  }
  if (definition.kind === "seat" && (!Array.isArray(definition.seatPoints) || definition.seatPoints.length === 0)) {
    issues.push({ path: `${path}.seatPoints`, message: "must not be empty for seats" });
  }
  if (definition.kind === "tray-return" && !definition.trayReturnPoint) {
    issues.push({ path: `${path}.trayReturnPoint`, message: "is required for tray-return facilities" });
  }
  if (definition.servicePoint) gridPoint(definition.servicePoint, `${path}.servicePoint`, issues);
  if (definition.queueAnchor) gridPoint(definition.queueAnchor, `${path}.queueAnchor`, issues);
  if (definition.trayReturnPoint) gridPoint(definition.trayReturnPoint, `${path}.trayReturnPoint`, issues);
  if (Array.isArray(definition.seatPoints)) {
    definition.seatPoints.forEach((point, index) => gridPoint(point, `${path}.seatPoints[${index}]`, issues));
  }
}

/**
 * Checks every placeable definition, in record order.
 *
 * @param catalog - The catalog whose placeables are checked.
 * @param issues - The issue list to append to.
 */
function validate_placeables(catalog: SimulationCatalog, issues: ValidationIssue[]): void {
  for (const [key, definition] of Object.entries(catalog.placeables ?? {})) {
    const path = `placeables.${key}`;
    if (!check_record_identity(key, definition, path, issues)) continue;
    validate_placeable(catalog, path, definition, issues);
  }
}

/**
 * Checks one dish definition: price, timings, quality, star rating and nutrition ratings.
 *
 * @param path - The issue path of the dish.
 * @param dish - The dish to check.
 * @param issues - The issue list to append to.
 */
function validate_dish(path: string, dish: DishDefinition, issues: ValidationIssue[]): void {
  positiveNumber(dish.price, `${path}.price`, issues, true);
  positiveNumber(dish.preparationMs, `${path}.preparationMs`, issues);
  positiveNumber(dish.eatingMs, `${path}.eatingMs`, issues);
  check_range(dish.quality, 0, 5, `${path}.quality`, "must be between zero and five", issues);
  if (dish.starRating !== undefined) {
    check_range(dish.starRating, 1, 5, `${path}.starRating`, "must be between one and five", issues);
  }
  for (const [variantIndex, variant] of (dish.nutritionVariants ?? []).entries()) {
    const profile = variant.profile;
    if (!profile) continue;
    const profilePath = `${path}.nutritionVariants[${variantIndex}].profile`;
    if (profile.healthRating !== undefined) {
      check_range(profile.healthRating, 1, 5, `${profilePath}.healthRating`, "must be between one and five", issues);
    }
    for (const [condition, rating] of Object.entries(profile.conditionRatings ?? {})) {
      if (!HEALTH_CONDITIONS.includes(condition as (typeof HEALTH_CONDITIONS)[number])) {
        issues.push({
          path: `${profilePath}.conditionRatings.${condition}`,
          message: "is not a supported health condition",
        });
      } else {
        check_range(
          rating,
          1,
          5,
          `${profilePath}.conditionRatings.${condition}`,
          "must be between one and five",
          issues,
        );
      }
    }
  }
}

/**
 * Checks every dish definition, in record order.
 *
 * @param catalog - The catalog whose dishes are checked.
 * @param issues - The issue list to append to.
 */
function validate_dishes(catalog: SimulationCatalog, issues: ValidationIssue[]): void {
  for (const [key, dish] of Object.entries(catalog.dishes ?? {})) {
    const path = `dishes.${key}`;
    if (!check_record_identity(key, dish, path, issues)) continue;
    validate_dish(path, dish, issues);
  }
}

/**
 * Checks one customer archetype: budget, timings, sensitivities, unlock rules and schedule.
 *
 * @param path - The issue path of the archetype.
 * @param archetype - The archetype to check.
 * @param issues - The issue list to append to.
 */
function validate_archetype(path: string, archetype: CustomerArchetype, issues: ValidationIssue[]): void {
  positiveNumber(archetype.budget, `${path}.budget`, issues, true);
  positiveNumber(archetype.patienceMs, `${path}.patienceMs`, issues);
  positiveNumber(archetype.walkingSpeed, `${path}.walkingSpeed`, issues);
  for (const field of ["priceSensitivity", "qualitySensitivity", "queueSensitivity", "distanceSensitivity"] as const) {
    positiveNumber(archetype[field], `${path}.${field}`, issues, true);
  }
  if (archetype.noveltyPreference !== undefined) {
    positiveNumber(archetype.noveltyPreference, `${path}.noveltyPreference`, issues, true);
  }
  if (archetype.unlockLevel !== undefined) {
    positiveNumber(archetype.unlockLevel, `${path}.unlockLevel`, issues);
    if (!Number.isInteger(archetype.unlockLevel)) {
      issues.push({ path: `${path}.unlockLevel`, message: "must be an integer" });
    }
  }
  if (archetype.unlockReputation !== undefined) {
    check_range(
      archetype.unlockReputation,
      0,
      5,
      `${path}.unlockReputation`,
      "must be between zero and five",
      issues,
    );
  }
  if (archetype.unlockPrerequisiteIds !== undefined) {
    if (
      new Set(archetype.unlockPrerequisiteIds).size !==
      archetype.unlockPrerequisiteIds.length
    ) {
      issues.push({
        path: `${path}.unlockPrerequisiteIds`,
        message: "must not contain duplicates",
      });
    }
    for (const prerequisiteId of archetype.unlockPrerequisiteIds) {
      if (!isValidSimulationId(prerequisiteId)) {
        issues.push({
          path: `${path}.unlockPrerequisiteIds`,
          message: "must contain only non-empty safe IDs",
        });
      }
    }
  }
  if (archetype.visitSchedule !== undefined) {
    const schedule = archetype.visitSchedule;
    if (
      !Number.isInteger(schedule.startHour) ||
      schedule.startHour < 0 ||
      schedule.startHour > 23
    ) {
      issues.push({ path: `${path}.visitSchedule.startHour`, message: "must be an hour from 0 to 23" });
    }
    if (
      !Number.isInteger(schedule.endHour) ||
      schedule.endHour < 1 ||
      schedule.endHour > 24 ||
      schedule.endHour <= schedule.startHour
    ) {
      issues.push({ path: `${path}.visitSchedule.endHour`, message: "must be later than startHour and at most 24" });
    }
    positiveNumber(
      schedule.peakMultiplier,
      `${path}.visitSchedule.peakMultiplier`,
      issues,
    );
  }
}

/**
 * Checks every customer archetype, in record order, and that there is at least one.
 *
 * @param catalog - The catalog whose archetypes are checked.
 * @param issues - The issue list to append to.
 */
function validate_archetypes(catalog: SimulationCatalog, issues: ValidationIssue[]): void {
  for (const [key, archetype] of Object.entries(catalog.archetypes ?? {})) {
    const path = `archetypes.${key}`;
    if (!check_record_identity(key, archetype, path, issues)) continue;
    validate_archetype(path, archetype, issues);
  }
  if (Object.keys(catalog.archetypes ?? {}).length === 0) {
    issues.push({ path: "archetypes", message: "must contain at least one archetype" });
  }
}

function validateCatalogInternal(catalog: SimulationCatalog): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!catalog || typeof catalog !== "object") return [{ path: "catalog", message: "must be an object" }];
  if (!catalog.placeables || typeof catalog.placeables !== "object" || Array.isArray(catalog.placeables)) {
    issues.push({ path: "placeables", message: "must be a record" });
  }
  if (!catalog.dishes || typeof catalog.dishes !== "object" || Array.isArray(catalog.dishes)) {
    issues.push({ path: "dishes", message: "must be a record" });
  }
  if (!catalog.archetypes || typeof catalog.archetypes !== "object" || Array.isArray(catalog.archetypes)) {
    issues.push({ path: "archetypes", message: "must be a record" });
  }
  if (issues.length > 0) return issues;

  validate_placeables(catalog, issues);
  validate_dishes(catalog, issues);
  validate_archetypes(catalog, issues);
  return issues;
}

/**
 * Validates a simulation catalog.
 *
 * A catalog malformed enough to throw during validation is reported as a single `catalog` issue
 * instead of throwing (see TD-36 in `docs/KNOWN_ISSUES.md`).
 *
 * @param catalog - The catalog to check.
 * @returns Every issue found, or an empty list when the catalog is valid.
 */
export function validateCatalog(catalog: SimulationCatalog): readonly ValidationIssue[] {
  try {
    return validateCatalogInternal(catalog);
  } catch (error) {
    return [{
      path: "catalog",
      message: `contains malformed data: ${error instanceof Error ? error.message : String(error)}`,
    }];
  }
}

/**
 * Validates a catalog and throws when it has any issue.
 *
 * @param catalog - The catalog to check.
 * @throws CatalogValidationError When the catalog has at least one issue.
 */
export function assertValidCatalog(catalog: SimulationCatalog): void {
  const issues = validateCatalog(catalog);
  if (issues.length > 0) throw new CatalogValidationError(issues);
}
