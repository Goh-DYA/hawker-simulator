export const RUNTIME_ENVELOPE_SCHEMA_VERSION = 5 as const;

export type SupportedRuntimeEnvelopeVersion = 1 | 2 | 3 | 4 | 5;

export interface RuntimePersistentStateV5 {
  readonly runtimeSchemaVersion: 5;
  readonly core: unknown;
  readonly stallMenus: Readonly<Record<string, readonly string[]>>;
  readonly nutritionDataVersion: string;
  readonly activeDishVariants: Readonly<Record<string, string>>;
  readonly periodOutcomes: unknown;
}

export interface DecodedRuntimeSaveEnvelope {
  readonly core: unknown;
  readonly runtimeSchemaVersion?: SupportedRuntimeEnvelopeVersion;
  readonly menus?: Readonly<Record<string, readonly string[]>>;
  readonly variants?: Readonly<Record<string, string>>;
  readonly nutritionDataVersion?: string;
  readonly periodOutcomes?: unknown;
  /**
   * True when a pre-V5 envelope omitted one or more runtime-owned selections.
   * Callers should retain their existing reviewed-default recovery notice.
   */
  readonly incompleteLegacyRuntime: boolean;
}

export class RuntimeEnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeEnvelopeError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportedVersion(
  value: unknown,
): value is SupportedRuntimeEnvelopeVersion {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function stringArrayRecord(
  value: unknown,
): Readonly<Record<string, readonly string[]>> | undefined {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(Object.entries(value).flatMap(([key, candidate]) => {
    if (!Array.isArray(candidate)) return [];
    return [[key, [...new Set(candidate.filter(
      (entry): entry is string => typeof entry === "string" && entry.length > 0,
    ))]]];
  }));
}

function stringRecord(
  value: unknown,
): Readonly<Record<string, string>> | undefined {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(Object.entries(value).flatMap(([key, candidate]) =>
    typeof candidate === "string" && candidate.length > 0
      ? [[key, candidate]]
      : []));
}

function hasValidStringArrayRecord(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every((candidate) =>
    Array.isArray(candidate) &&
    candidate.every((entry) => typeof entry === "string" && entry.length > 0) &&
    new Set(candidate).size === candidate.length);
}

function hasValidStringRecord(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every(
    (candidate) => typeof candidate === "string" && candidate.length > 0,
  );
}

/**
 * Decodes every existing runtime wrapper into the V5 field model without
 * rewriting the core payload. In particular, legacy integer cents cross this
 * boundary untouched and are migrated exactly once by core persistence.
 *
 * A raw core save remains supported for import compatibility.
 */
export function decodeRuntimeSaveEnvelope(
  value: unknown,
): DecodedRuntimeSaveEnvelope {
  if (!isRecord(value) || value.runtimeSchemaVersion === undefined) {
    return {
      core: value,
      incompleteLegacyRuntime: false,
    };
  }
  if (!isSupportedVersion(value.runtimeSchemaVersion)) {
    throw new RuntimeEnvelopeError(
      `Unsupported runtime save version: ${String(value.runtimeSchemaVersion)}`,
    );
  }
  if (!Object.hasOwn(value, "core")) {
    throw new RuntimeEnvelopeError("Runtime save envelope is missing its core state");
  }
  const validMenus = hasValidStringArrayRecord(value.stallMenus);
  const validVariants = hasValidStringRecord(value.activeDishVariants);
  const menus = stringArrayRecord(value.stallMenus);
  const variants = stringRecord(value.activeDishVariants);
  const nutritionDataVersion = typeof value.nutritionDataVersion === "string" &&
      value.nutritionDataVersion.length > 0
    ? value.nutritionDataVersion
    : undefined;
  const incompleteRuntime = (
    !validMenus ||
    !validVariants ||
    nutritionDataVersion === undefined ||
    !Object.hasOwn(value, "periodOutcomes")
  );
  if (value.runtimeSchemaVersion === 5 && incompleteRuntime) {
    throw new RuntimeEnvelopeError(
      "Runtime V5 save envelope is missing required reviewed selections",
    );
  }
  return {
    core: value.core,
    runtimeSchemaVersion: value.runtimeSchemaVersion,
    menus,
    variants,
    nutritionDataVersion,
    periodOutcomes: value.periodOutcomes,
    incompleteLegacyRuntime: value.runtimeSchemaVersion < 5 && incompleteRuntime,
  };
}

/**
 * Creates the exact V5 wrapper written by the runtime after all content-aware
 * menu/variant reconciliation has completed.
 */
export function createRuntimeSaveEnvelopeV5(
  value: Omit<RuntimePersistentStateV5, "runtimeSchemaVersion">,
): RuntimePersistentStateV5 {
  return {
    runtimeSchemaVersion: RUNTIME_ENVELOPE_SCHEMA_VERSION,
    core: value.core,
    stallMenus: Object.fromEntries(
      Object.entries(value.stallMenus).map(([stallId, dishIds]) => [
        stallId,
        [...dishIds],
      ]),
    ),
    nutritionDataVersion: value.nutritionDataVersion,
    activeDishVariants: { ...value.activeDishVariants },
    periodOutcomes: value.periodOutcomes,
  };
}
