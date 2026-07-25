import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  MASTERY_CONTRACT_TEMPLATES,
  SCENARIOS,
  type ScenarioId,
} from "../../content/strategicGameplay";
import {
  createEmptyMasteryProgression,
  createEmptyMetaProgression,
  deriveMasteryContractView,
  masteryRotationForDay,
  type AcceptedMasteryContract,
  type MasteryAccumulationV1,
  type MasteryContractOutcomeV1,
  type MasteryProgressionV1,
  type MetaProgressionV1,
} from "../core/strategicProgression";
import type { MasteryMetric } from "../../content/strategicGameplay";

const DATABASE_NAME = "hawker-simulator";
export const INDEXED_DB_SCHEMA_VERSION = 2 as const;
export const PROGRESS_BUNDLE_VERSION = 3 as const;
const APP_VERSION = "1.0.0";
const PROGRESS_BUNDLE_FORMAT = "hawker-balance-progress";
const ACTIVE_SLOT = "active";
const BACKUP_SLOT = "backup";
const META_PROGRESSION_SLOT = "meta-progression";
const SCENARIO_SLOT_SEPARATOR = "::";
const PROGRESSION_PREFERENCE_KEYS = [
  "active-game-scope-v1",
  "main-progression-level-v1",
  "tutorial-complete",
  "nutrition-tour-v1-complete",
  "forecast-guide-v1-complete",
] as const;

type SaveSlot = typeof ACTIVE_SLOT | typeof BACKUP_SLOT;

interface SaveEnvelope {
  appVersion: string;
  saveVersion: 1 | 2;
  writtenAt: string;
  checksum: string;
  payload: unknown;
}

interface ProgressBundleEnvelopeV3 {
  readonly format: typeof PROGRESS_BUNDLE_FORMAT;
  readonly exportVersion: typeof PROGRESS_BUNDLE_VERSION;
  readonly appVersion: string;
  readonly writtenAt: string;
  readonly checksum: string;
  readonly payload: ProgressBundleSnapshot;
}

interface HawkerDatabase extends DBSchema {
  saves: {
    key: string;
    value: SaveEnvelope;
  };
  scenarioSaves: {
    key: string;
    value: SaveEnvelope;
  };
  metaProgression: {
    key: string;
    value: SaveEnvelope;
  };
  preferences: {
    key: string;
    value: unknown;
  };
}

export type GameSaveScope =
  | { readonly kind: "main" }
  | { readonly kind: "scenario"; readonly scenarioId: ScenarioId };

export interface ProgressBundleSnapshot {
  readonly main: unknown;
  readonly scenarios: Readonly<Partial<Record<ScenarioId, unknown>>>;
  readonly metaProgression: MetaProgressionV1;
}

export interface ProgressBundleValidators {
  /**
   * Runtime/core semantic validation belongs to the caller because the save
   * store deliberately has no catalog dependency. A thrown error aborts the
   * import before IndexedDB is opened for writing.
   */
  readonly validateMain?: (payload: unknown) => void;
  readonly validateScenario?: (
    scenarioId: ScenarioId,
    payload: unknown,
  ) => void;
}

export class SaveStoreError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SaveStoreError";
  }
}

export const MAIN_GAME_SCOPE: GameSaveScope = Object.freeze({ kind: "main" });

const SCENARIO_IDS = new Set<ScenarioId>(
  SCENARIOS.map((scenario) => scenario.id),
);

let databasePromise: Promise<IDBPDatabase<HawkerDatabase>> | undefined;

function database() {
  databasePromise ??= openDB<HawkerDatabase>(
    DATABASE_NAME,
    INDEXED_DB_SCHEMA_VERSION,
    {
      upgrade(db) {
        // V1 main-save and preference stores are retained in place. Creating
        // only the missing V2 stores keeps the immediately preceding preview
        // readable without rewriting or double-migrating its runtime payload.
        if (!db.objectStoreNames.contains("saves")) {
          db.createObjectStore("saves");
        }
        if (!db.objectStoreNames.contains("preferences")) {
          db.createObjectStore("preferences");
        }
        if (!db.objectStoreNames.contains("scenarioSaves")) {
          db.createObjectStore("scenarioSaves");
        }
        if (!db.objectStoreNames.contains("metaProgression")) {
          db.createObjectStore("metaProgression");
        }
      },
    },
  );
  return databasePromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      throw new SaveStoreError("Save payloads must contain JSON-compatible values");
    }
    return serialized;
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function checksum(value: unknown): string {
  const source = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function envelope(payload: unknown): SaveEnvelope {
  return {
    appVersion: APP_VERSION,
    saveVersion: 2,
    writtenAt: new Date().toISOString(),
    checksum: checksum(payload),
    payload,
  };
}

function isValidEnvelope(value: SaveEnvelope | undefined): value is SaveEnvelope {
  if (
    !value ||
    (value.saveVersion !== 1 && value.saveVersion !== 2) ||
    typeof value.appVersion !== "string" ||
    typeof value.writtenAt !== "string" ||
    typeof value.checksum !== "string"
  ) {
    return false;
  }
  try {
    return value.checksum === checksum(value.payload);
  } catch {
    return false;
  }
}

function scenarioId(value: unknown, path = "scenarioId"): ScenarioId {
  if (typeof value !== "string" || !SCENARIO_IDS.has(value as ScenarioId)) {
    throw new SaveStoreError(`${path} is not a supported scenario`);
  }
  return value as ScenarioId;
}

function scenarioSlotKey(id: ScenarioId, slot: SaveSlot): string {
  return `${id}${SCENARIO_SLOT_SEPARATOR}${slot}`;
}

function uniqueStringArray(value: unknown, path: string): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string" || entry.length === 0)
  ) {
    throw new SaveStoreError(`${path} must contain non-empty string IDs`);
  }
  if (new Set(value).size !== value.length) {
    throw new SaveStoreError(`${path} must not contain duplicate IDs`);
  }
  return [...value];
}

function uniqueSafeIntegerArray(
  value: unknown,
  path: string,
  minimum = 0,
): readonly number[] {
  if (!Array.isArray(value)) {
    throw new SaveStoreError(`${path} must contain integer IDs`);
  }
  const parsed = value.map((entry, index) =>
    safeInteger(entry, `${path}[${index}]`, minimum)
  );
  if (new Set(parsed).size !== parsed.length) {
    throw new SaveStoreError(`${path} must not contain duplicate IDs`);
  }
  return parsed;
}

const MASTERY_METRICS = new Set<MasteryMetric>([
  "completed-visits",
  "gross-sales-cents",
  "contribution-cents",
  "minimum-satisfaction",
  "maximum-median-wait-seconds",
  "flow-seconds",
  "distinct-preparations",
  "party-visits",
  "tray-return-rate-percent",
  "forecast-needs-met",
  "periods-without-refund",
  "combo-visits",
]);

function safeInteger(
  value: unknown,
  path: string,
  minimum = 0,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new SaveStoreError(`${path} must be a safe integer of at least ${minimum}`);
  }
  return value as number;
}

function optionalFiniteNumber(
  value: unknown,
  path: string,
  minimum = 0,
): number | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum
  ) {
    throw new SaveStoreError(`${path} must be a finite number of at least ${minimum}`);
  }
  return value;
}

function parseMasteryTarget(
  value: unknown,
  path: string,
): AcceptedMasteryContract["target"] {
  if (
    !isRecord(value) ||
    typeof value.metric !== "string" ||
    !MASTERY_METRICS.has(value.metric as MasteryMetric)
  ) {
    throw new SaveStoreError(`${path}.metric is invalid`);
  }
  return {
    metric: value.metric as MasteryMetric,
    value: safeInteger(value.value, `${path}.value`),
  };
}

function parseMasteryReward(
  value: unknown,
  path: string,
): AcceptedMasteryContract["reward"] {
  if (!isRecord(value)) {
    throw new SaveStoreError(`${path} must be an object`);
  }
  if (
    value.kind === "cosmetic" &&
    typeof value.cosmeticId === "string" &&
    value.cosmeticId.length > 0
  ) {
    return { kind: "cosmetic", cosmeticId: value.cosmeticId };
  }
  if (
    value.kind === "title" &&
    typeof value.titleId === "string" &&
    value.titleId.length > 0
  ) {
    return { kind: "title", titleId: value.titleId };
  }
  throw new SaveStoreError(`${path} is invalid`);
}

function legacyMasteryQualification(
  metric: MasteryMetric,
): AcceptedMasteryContract["qualification"] {
  switch (metric) {
    case "minimum-satisfaction":
    case "maximum-median-wait-seconds":
      return { minimumCompletedVisitsPerPeriod: 3 };
    case "tray-return-rate-percent":
      return { minimumTrayReturnOpportunitiesPerPeriod: 4 };
    default:
      return undefined;
  }
}

function parseMasteryQualification(
  value: unknown,
  path: string,
  metric: MasteryMetric,
): AcceptedMasteryContract["qualification"] {
  if (value === undefined) return legacyMasteryQualification(metric);
  if (!isRecord(value)) {
    throw new SaveStoreError(`${path} must be an object`);
  }
  const minimumCompletedVisitsPerPeriod =
    value.minimumCompletedVisitsPerPeriod === undefined
      ? undefined
      : safeInteger(
          value.minimumCompletedVisitsPerPeriod,
          `${path}.minimumCompletedVisitsPerPeriod`,
          1,
        );
  const minimumTrayReturnOpportunitiesPerPeriod =
    value.minimumTrayReturnOpportunitiesPerPeriod === undefined
      ? undefined
      : safeInteger(
          value.minimumTrayReturnOpportunitiesPerPeriod,
          `${path}.minimumTrayReturnOpportunitiesPerPeriod`,
          1,
        );
  if (
    minimumCompletedVisitsPerPeriod === undefined &&
    minimumTrayReturnOpportunitiesPerPeriod === undefined
  ) {
    throw new SaveStoreError(`${path} must define a participation floor`);
  }
  return {
    ...(minimumCompletedVisitsPerPeriod === undefined
      ? {}
      : { minimumCompletedVisitsPerPeriod }),
    ...(minimumTrayReturnOpportunitiesPerPeriod === undefined
      ? {}
      : { minimumTrayReturnOpportunitiesPerPeriod }),
  };
}

function parseAcceptedMasteryContract(
  value: unknown,
  path: string,
): AcceptedMasteryContract {
  if (!isRecord(value) || typeof value.templateId !== "string") {
    throw new SaveStoreError(`${path} is invalid`);
  }
  const acceptedPeriodSequence = value.acceptedPeriodSequence === undefined
    ? undefined
    : safeInteger(
        value.acceptedPeriodSequence,
        `${path}.acceptedPeriodSequence`,
        1,
      );
  const durationPeriods = value.durationPeriods === undefined
    ? undefined
    : safeInteger(value.durationPeriods, `${path}.durationPeriods`, 1);
  if (
    (acceptedPeriodSequence === undefined) !==
      (durationPeriods === undefined)
  ) {
    throw new SaveStoreError(
      `${path} must provide acceptedPeriodSequence and durationPeriods together`,
    );
  }
  const expiresAfterPeriod = safeInteger(
    value.expiresAfterPeriod,
    `${path}.expiresAfterPeriod`,
    1,
  );
  if (
    acceptedPeriodSequence !== undefined &&
    durationPeriods !== undefined &&
    expiresAfterPeriod !== acceptedPeriodSequence + durationPeriods
  ) {
    throw new SaveStoreError(
      `${path}.expiresAfterPeriod does not match its frozen acceptance window`,
    );
  }
  const target = parseMasteryTarget(value.target, `${path}.target`);
  const qualification = parseMasteryQualification(
    value.qualification,
    `${path}.qualification`,
    target.metric,
  );
  return {
    templateId: value.templateId,
    acceptedDay: safeInteger(value.acceptedDay, `${path}.acceptedDay`, 1),
    ...(acceptedPeriodSequence === undefined ? {} : { acceptedPeriodSequence }),
    ...(durationPeriods === undefined ? {} : { durationPeriods }),
    expiresAfterPeriod,
    target,
    ...(qualification === undefined ? {} : { qualification }),
    reward: parseMasteryReward(value.reward, `${path}.reward`),
  };
}

function assertMasteryProgressWindow(
  contract: AcceptedMasteryContract,
  progress: MasteryAccumulationV1,
  path: string,
  active: boolean,
): void {
  const ids = progress.processedPeriodSequenceIds;
  const qualifiedIds = progress.qualifiedPeriodSequenceIds;
  for (let index = 1; index < ids.length; index += 1) {
    if (ids[index] !== ids[index - 1]! + 1) {
      throw new SaveStoreError(
        `${path}.processedPeriodSequenceIds must be sorted and contiguous`,
      );
    }
  }
  if (
    ids.some((sequenceId) => sequenceId >= contract.expiresAfterPeriod)
  ) {
    throw new SaveStoreError(
      `${path}.processedPeriodSequenceIds must stay inside the frozen contract window`,
    );
  }
  for (let index = 1; index < qualifiedIds.length; index += 1) {
    if (qualifiedIds[index]! <= qualifiedIds[index - 1]!) {
      throw new SaveStoreError(
        `${path}.qualifiedPeriodSequenceIds must be sorted`,
      );
    }
  }
  if (qualifiedIds.some((sequenceId) => !ids.includes(sequenceId))) {
    throw new SaveStoreError(
      `${path}.qualifiedPeriodSequenceIds must reference processed periods`,
    );
  }
  if (!contract.qualification && qualifiedIds.length > 0) {
    throw new SaveStoreError(
      `${path}.qualifiedPeriodSequenceIds require a frozen qualification`,
    );
  }
  if (
    contract.acceptedPeriodSequence !== undefined &&
    ids[0] !== undefined &&
    ids[0] !== contract.acceptedPeriodSequence
  ) {
    throw new SaveStoreError(
      `${path}.processedPeriodSequenceIds must start at contract acceptance`,
    );
  }
  if (
    contract.durationPeriods !== undefined &&
    ids.length > contract.durationPeriods - (active ? 1 : 0)
  ) {
    throw new SaveStoreError(
      `${path}.processedPeriodSequenceIds exceed the frozen contract duration`,
    );
  }
  if (progress.trayReturns > progress.trayReturnOpportunities) {
    throw new SaveStoreError(
      `${path}.trayReturns cannot exceed tray-return opportunities`,
    );
  }
}

function parseMasteryAccumulation(
  value: unknown,
  path: string,
): MasteryAccumulationV1 {
  if (!isRecord(value)) {
    throw new SaveStoreError(`${path} must be an object`);
  }
  const minimumSatisfaction = optionalFiniteNumber(
    value.minimumSatisfaction,
    `${path}.minimumSatisfaction`,
  );
  if (minimumSatisfaction !== undefined && minimumSatisfaction > 100) {
    throw new SaveStoreError(`${path}.minimumSatisfaction must not exceed 100`);
  }
  return {
    completedVisits: safeInteger(
      value.completedVisits,
      `${path}.completedVisits`,
    ),
    grossSalesCents: safeInteger(
      value.grossSalesCents,
      `${path}.grossSalesCents`,
    ),
    contributionCents: safeInteger(
      value.contributionCents,
      `${path}.contributionCents`,
      Number.MIN_SAFE_INTEGER,
    ),
    ...(minimumSatisfaction === undefined ? {} : { minimumSatisfaction }),
    ...(value.maximumMedianWaitSeconds === undefined
      ? {}
      : {
          maximumMedianWaitSeconds: optionalFiniteNumber(
            value.maximumMedianWaitSeconds,
            `${path}.maximumMedianWaitSeconds`,
          )!,
        }),
    flowSeconds: safeInteger(value.flowSeconds, `${path}.flowSeconds`),
    distinctPreparationIds: uniqueStringArray(
      value.distinctPreparationIds,
      `${path}.distinctPreparationIds`,
    ),
    partyVisits: safeInteger(value.partyVisits, `${path}.partyVisits`),
    trayReturns: safeInteger(value.trayReturns, `${path}.trayReturns`),
    trayReturnOpportunities: safeInteger(
      value.trayReturnOpportunities,
      `${path}.trayReturnOpportunities`,
    ),
    forecastNeedsMet: safeInteger(
      value.forecastNeedsMet,
      `${path}.forecastNeedsMet`,
    ),
    periodsWithoutRefund: safeInteger(
      value.periodsWithoutRefund,
      `${path}.periodsWithoutRefund`,
    ),
    comboVisits: safeInteger(value.comboVisits, `${path}.comboVisits`),
    processedPeriodSequenceIds: uniqueSafeIntegerArray(
      value.processedPeriodSequenceIds,
      `${path}.processedPeriodSequenceIds`,
      1,
    ),
    qualifiedPeriodSequenceIds:
      value.qualifiedPeriodSequenceIds === undefined
        ? []
        : uniqueSafeIntegerArray(
            value.qualifiedPeriodSequenceIds,
            `${path}.qualifiedPeriodSequenceIds`,
            1,
          ),
  };
}

function parseActiveMastery(
  value: unknown,
  path: string,
): NonNullable<MasteryProgressionV1["activeContract"]> {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new SaveStoreError(`${path} must use schema version 1`);
  }
  const contract = parseAcceptedMasteryContract(
    value.contract,
    `${path}.contract`,
  );
  const progress = parseMasteryAccumulation(value.progress, `${path}.progress`);
  assertMasteryProgressWindow(contract, progress, `${path}.progress`, true);
  return {
    schemaVersion: 1,
    contract,
    progress,
  };
}

function parseMasteryOutcome(
  value: unknown,
  path: string,
): MasteryContractOutcomeV1 {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    (value.status !== "completed" && value.status !== "failed") ||
    typeof value.rewardGranted !== "boolean"
  ) {
    throw new SaveStoreError(`${path} is invalid`);
  }
  const contract = parseAcceptedMasteryContract(
    value.contract,
    `${path}.contract`,
  );
  const parsedProgress = parseMasteryAccumulation(
    value.progress,
    `${path}.progress`,
  );
  const legacyCompletedQualification =
    value.status === "completed" &&
    isRecord(value.contract) &&
    value.contract.qualification === undefined &&
    isRecord(value.progress) &&
    value.progress.qualifiedPeriodSequenceIds === undefined &&
    contract.qualification !== undefined;
  const progress = legacyCompletedQualification
    ? {
        ...parsedProgress,
        qualifiedPeriodSequenceIds:
          parsedProgress.processedPeriodSequenceIds,
      }
    : parsedProgress;
  assertMasteryProgressWindow(contract, progress, `${path}.progress`, false);
  const endedAtPeriodSequence = safeInteger(
    value.endedAtPeriodSequence,
    `${path}.endedAtPeriodSequence`,
    1,
  );
  if (
    contract.acceptedPeriodSequence !== undefined &&
    endedAtPeriodSequence < contract.acceptedPeriodSequence
  ) {
    throw new SaveStoreError(
      `${path}.endedAtPeriodSequence precedes contract acceptance`,
    );
  }
  if (value.status === "failed" && value.rewardGranted) {
    throw new SaveStoreError(`${path} cannot grant a reward for failure`);
  }
  const outcome: MasteryContractOutcomeV1 = {
    schemaVersion: 1,
    contract,
    status: value.status,
    endedAtPeriodSequence,
    progress,
    rewardGranted: value.rewardGranted,
  };
  if (outcome.status === "completed") {
    const view = deriveMasteryContractView(outcome);
    if (!view.satisfied || !view.qualificationSatisfied) {
      throw new SaveStoreError(
        `${path} cannot be completed without satisfying its frozen target and qualification`,
      );
    }
  }
  return outcome;
}

function parseMasteryProgression(value: unknown): MasteryProgressionV1 {
  if (value === undefined) return createEmptyMasteryProgression();
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new SaveStoreError("Meta mastery progression must use schema version 1");
  }
  const decidedRotation = value.decidedRotation === undefined
    ? undefined
    : safeInteger(value.decidedRotation, "metaProgression.mastery.decidedRotation");
  if (
    value.decision !== undefined &&
    value.decision !== "accepted" &&
    value.decision !== "skipped"
  ) {
    throw new SaveStoreError("metaProgression.mastery.decision is invalid");
  }
  const decision = value.decision as "accepted" | "skipped" | undefined;
  const activeContract = value.activeContract === undefined
    ? undefined
    : parseActiveMastery(
        value.activeContract,
        "metaProgression.mastery.activeContract",
      );
  const lastOutcome = value.lastOutcome === undefined
    ? undefined
    : parseMasteryOutcome(
        value.lastOutcome,
        "metaProgression.mastery.lastOutcome",
      );
  if ((decidedRotation === undefined) !== (decision === undefined)) {
    throw new SaveStoreError(
      "Meta mastery rotation and decision must be present together",
    );
  }
  if (decision === "skipped" && activeContract) {
    throw new SaveStoreError(
      "Skipped mastery rotations cannot contain an active contract",
    );
  }
  if (activeContract && decision !== "accepted") {
    throw new SaveStoreError(
      "Active mastery contracts require an accepted rotation",
    );
  }
  if (
    decision === "accepted" &&
    !activeContract &&
    !lastOutcome
  ) {
    throw new SaveStoreError(
      "Accepted mastery rotations require an active contract or outcome",
    );
  }
  if (
    activeContract &&
    decidedRotation !== undefined &&
    masteryRotationForDay(activeContract.contract.acceptedDay) !==
      decidedRotation
  ) {
    throw new SaveStoreError(
      "Active mastery contract acceptance does not match its decided rotation",
    );
  }
  if (
    decision === "accepted" &&
    !activeContract &&
    lastOutcome &&
    decidedRotation !== undefined &&
    masteryRotationForDay(lastOutcome.contract.acceptedDay) !== decidedRotation
  ) {
    throw new SaveStoreError(
      "Mastery outcome acceptance does not match its decided rotation",
    );
  }
  return {
    schemaVersion: 1,
    ...(decidedRotation === undefined ? {} : { decidedRotation }),
    ...(decision === undefined ? {} : { decision }),
    ...(activeContract === undefined ? {} : { activeContract }),
    ...(lastOutcome === undefined ? {} : { lastOutcome }),
  };
}

function parseMetaProgression(value: unknown): MetaProgressionV1 {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new SaveStoreError("Meta progression must use schema version 1");
  }
  if (!isRecord(value.scenarioMedals)) {
    throw new SaveStoreError("Meta progression scenario medals must be an object");
  }
  const scenarioMedals: Partial<
    Record<ScenarioId, "bronze" | "silver" | "gold">
  > = {};
  for (const [rawId, medal] of Object.entries(value.scenarioMedals)) {
    const id = scenarioId(rawId, `metaProgression.scenarioMedals.${rawId}`);
    if (medal !== "bronze" && medal !== "silver" && medal !== "gold") {
      throw new SaveStoreError(
        `metaProgression.scenarioMedals.${rawId} is invalid`,
      );
    }
    scenarioMedals[id] = medal;
  }
  const unlockedCosmeticIds = uniqueStringArray(
    value.unlockedCosmeticIds,
    "metaProgression.unlockedCosmeticIds",
  );
  const unlockedTitleIds = uniqueStringArray(
    value.unlockedTitleIds,
    "metaProgression.unlockedTitleIds",
  );
  const completedContractIds = uniqueStringArray(
    value.completedContractIds,
    "metaProgression.completedContractIds",
  );
  const mastery = parseMasteryProgression(value.mastery);
  const medalOrder = ["bronze", "silver", "gold"] as const;
  for (const scenario of SCENARIOS) {
    const medal = scenarioMedals[scenario.id];
    if (!medal) continue;
    const medalIndex = medalOrder.indexOf(medal);
    const missingReward = medalOrder
      .slice(0, medalIndex + 1)
      .map((earnedMedal) => scenario.cosmeticRewardIds[earnedMedal])
      .find((cosmeticId) => !unlockedCosmeticIds.includes(cosmeticId));
    if (missingReward) {
      throw new SaveStoreError(
        `Meta progression ${scenario.id} ${medal} medal is missing cumulative cosmetic ${missingReward}`,
      );
    }
  }
  for (const contractId of completedContractIds) {
    const template = MASTERY_CONTRACT_TEMPLATES.find(
      (candidate) => candidate.id === contractId,
    );
    if (!template) continue;
    const rewardPresent = template.reward.kind === "cosmetic"
      ? unlockedCosmeticIds.includes(template.reward.cosmeticId)
      : unlockedTitleIds.includes(template.reward.titleId);
    if (!rewardPresent) {
      throw new SaveStoreError(
        `Meta progression completed contract ${contractId} is missing its reward`,
      );
    }
  }
  const outcome = mastery.lastOutcome;
  if (outcome?.status === "completed") {
    const completionRecorded = completedContractIds.includes(
      outcome.contract.templateId,
    );
    const rewardPresent = outcome.contract.reward.kind === "cosmetic"
      ? unlockedCosmeticIds.includes(outcome.contract.reward.cosmeticId)
      : unlockedTitleIds.includes(outcome.contract.reward.titleId);
    if (!completionRecorded || !rewardPresent) {
      throw new SaveStoreError(
        "Completed mastery outcome must match its completed contract and unlocked reward",
      );
    }
  }
  return {
    schemaVersion: 1,
    scenarioMedals,
    unlockedCosmeticIds,
    unlockedTitleIds,
    completedContractIds,
    mastery,
  };
}

function parseScenarioPayloads(
  value: unknown,
): Readonly<Partial<Record<ScenarioId, unknown>>> {
  if (!isRecord(value)) {
    throw new SaveStoreError("Progress bundle scenarios must be an object");
  }
  const scenarios: Partial<Record<ScenarioId, unknown>> = {};
  for (const [rawId, payload] of Object.entries(value)) {
    const id = scenarioId(rawId, `scenarios.${rawId}`);
    if (payload === undefined) {
      throw new SaveStoreError(`scenarios.${rawId} has no save payload`);
    }
    scenarios[id] = payload;
  }
  return scenarios;
}

function parseBundleSnapshot(value: unknown): ProgressBundleSnapshot {
  if (
    !isRecord(value) ||
    !Object.hasOwn(value, "main") ||
    value.main === undefined
  ) {
    throw new SaveStoreError("Progress bundle is missing its main save");
  }
  return {
    main: value.main,
    scenarios: parseScenarioPayloads(value.scenarios),
    metaProgression: parseMetaProgression(value.metaProgression),
  };
}

function validateSnapshot(
  snapshot: ProgressBundleSnapshot,
  validators: ProgressBundleValidators,
): void {
  validators.validateMain?.(snapshot.main);
  for (const [rawId, payload] of Object.entries(snapshot.scenarios)) {
    validators.validateScenario?.(scenarioId(rawId), payload);
  }
}

async function putWithBackup(
  store: {
    get(key: string): Promise<SaveEnvelope | undefined>;
    put(value: SaveEnvelope, key: string): Promise<unknown>;
  },
  activeKey: string,
  backupKey: string,
  payload: unknown,
): Promise<void> {
  const current = await store.get(activeKey);
  if (isValidEnvelope(current)) await store.put(current, backupKey);
  await store.put(envelope(payload), activeKey);
}

async function candidatePayloads(
  store: {
    get(key: string): Promise<SaveEnvelope | undefined>;
  },
  activeKey: string,
  backupKey: string,
): Promise<readonly unknown[]> {
  const active = await store.get(activeKey);
  const backup = await store.get(backupKey);
  return [active, backup]
    .filter((candidate): candidate is SaveEnvelope => isValidEnvelope(candidate))
    .map((candidate) => candidate.payload);
}

export function scenarioGameScope(id: ScenarioId): GameSaveScope {
  return { kind: "scenario", scenarioId: scenarioId(id) };
}

export async function saveScopedGame(
  scope: GameSaveScope,
  payload: unknown,
): Promise<void> {
  if (scope.kind === "main") {
    await saveGame(payload);
    return;
  }
  await saveScenarioGame(scope.scenarioId, payload);
}

export async function loadScopedGame(
  scope: GameSaveScope,
): Promise<unknown | undefined> {
  return (await loadScopedGameCandidates(scope))[0];
}

export async function loadScopedGameCandidates(
  scope: GameSaveScope,
): Promise<readonly unknown[]> {
  return scope.kind === "main"
    ? loadGameCandidates()
    : loadScenarioGameCandidates(scope.scenarioId);
}

export async function clearScopedGame(scope: GameSaveScope): Promise<void> {
  if (scope.kind === "main") {
    await clearMainGame();
    return;
  }
  await clearScenarioGame(scope.scenarioId);
}

export async function saveGame(payload: unknown): Promise<void> {
  const db = await database();
  const transaction = db.transaction("saves", "readwrite");
  await putWithBackup(
    transaction.store,
    ACTIVE_SLOT,
    BACKUP_SLOT,
    payload,
  );
  await transaction.done;
}

export async function loadGame(): Promise<unknown | undefined> {
  return (await loadGameCandidates())[0];
}

export async function loadGameCandidates(): Promise<readonly unknown[]> {
  const db = await database();
  return candidatePayloads(
    db.transaction("saves", "readonly").store,
    ACTIVE_SLOT,
    BACKUP_SLOT,
  );
}

export async function clearMainGame(): Promise<void> {
  const db = await database();
  const transaction = db.transaction("saves", "readwrite");
  await Promise.all([
    transaction.store.delete(ACTIVE_SLOT),
    transaction.store.delete(BACKUP_SLOT),
  ]);
  await transaction.done;
}

/**
 * Backward-compatible main reset. Scenario slots and meta rewards intentionally
 * survive; callers use eraseAllProgress for the separately confirmed wipe.
 */
export async function clearGame(): Promise<void> {
  await clearMainGame();
}

export async function saveScenarioGame(
  id: ScenarioId,
  payload: unknown,
): Promise<void> {
  const validId = scenarioId(id);
  const db = await database();
  const transaction = db.transaction("scenarioSaves", "readwrite");
  await putWithBackup(
    transaction.store,
    scenarioSlotKey(validId, ACTIVE_SLOT),
    scenarioSlotKey(validId, BACKUP_SLOT),
    payload,
  );
  await transaction.done;
}

export async function loadScenarioGame(
  id: ScenarioId,
): Promise<unknown | undefined> {
  return (await loadScenarioGameCandidates(id))[0];
}

export async function loadScenarioGameCandidates(
  id: ScenarioId,
): Promise<readonly unknown[]> {
  const validId = scenarioId(id);
  const db = await database();
  return candidatePayloads(
    db.transaction("scenarioSaves", "readonly").store,
    scenarioSlotKey(validId, ACTIVE_SLOT),
    scenarioSlotKey(validId, BACKUP_SLOT),
  );
}

export async function clearScenarioGame(id: ScenarioId): Promise<void> {
  const validId = scenarioId(id);
  const db = await database();
  const transaction = db.transaction("scenarioSaves", "readwrite");
  await Promise.all([
    transaction.store.delete(scenarioSlotKey(validId, ACTIVE_SLOT)),
    transaction.store.delete(scenarioSlotKey(validId, BACKUP_SLOT)),
  ]);
  await transaction.done;
}

export async function saveMetaProgression(
  value: MetaProgressionV1,
): Promise<void> {
  const metaProgression = parseMetaProgression(value);
  const db = await database();
  const transaction = db.transaction("metaProgression", "readwrite");
  await putWithBackup(
    transaction.store,
    `${META_PROGRESSION_SLOT}${SCENARIO_SLOT_SEPARATOR}${ACTIVE_SLOT}`,
    `${META_PROGRESSION_SLOT}${SCENARIO_SLOT_SEPARATOR}${BACKUP_SLOT}`,
    metaProgression,
  );
  await transaction.done;
}

export async function loadMetaProgressionCandidates(): Promise<
  readonly MetaProgressionV1[]
> {
  const db = await database();
  const candidates = await candidatePayloads(
    db.transaction("metaProgression", "readonly").store,
    `${META_PROGRESSION_SLOT}${SCENARIO_SLOT_SEPARATOR}${ACTIVE_SLOT}`,
    `${META_PROGRESSION_SLOT}${SCENARIO_SLOT_SEPARATOR}${BACKUP_SLOT}`,
  );
  return candidates.flatMap((candidate) => {
    try {
      return [parseMetaProgression(candidate)];
    } catch {
      return [];
    }
  });
}

export async function loadMetaProgression(): Promise<MetaProgressionV1> {
  return (await loadMetaProgressionCandidates())[0] ??
    createEmptyMetaProgression();
}

export async function loadProgressBundleSnapshot(
  freshMainPayload?: unknown,
  validators: ProgressBundleValidators = {},
): Promise<ProgressBundleSnapshot> {
  const db = await database();
  const transaction = db.transaction(
    ["saves", "scenarioSaves", "metaProgression"],
    "readonly",
  );
  const storedMainCandidates = await candidatePayloads(
    transaction.objectStore("saves"),
    ACTIVE_SLOT,
    BACKUP_SLOT,
  );
  const mainCandidates = freshMainPayload === undefined
    ? storedMainCandidates
    : [freshMainPayload, ...storedMainCandidates];
  const scenarios: Partial<Record<ScenarioId, unknown>> = {};
  for (const definition of SCENARIOS) {
    const candidates = await candidatePayloads(
      transaction.objectStore("scenarioSaves"),
      scenarioSlotKey(definition.id, ACTIVE_SLOT),
      scenarioSlotKey(definition.id, BACKUP_SLOT),
    );
    let selected = false;
    for (const candidate of candidates) {
      try {
        validators.validateScenario?.(definition.id, candidate);
        scenarios[definition.id] = candidate;
        selected = true;
        break;
      } catch {
        // A checksum-valid active slot may still be semantically damaged.
        // Prefer its independently stored backup when validation rejects it.
      }
    }
    if (candidates.length > 0 && !selected) {
      throw new SaveStoreError(
        `There is no semantically valid ${definition.name} scenario save to export`,
      );
    }
  }
  const metaCandidates = await candidatePayloads(
    transaction.objectStore("metaProgression"),
    `${META_PROGRESSION_SLOT}${SCENARIO_SLOT_SEPARATOR}${ACTIVE_SLOT}`,
    `${META_PROGRESSION_SLOT}${SCENARIO_SLOT_SEPARATOR}${BACKUP_SLOT}`,
  );
  await transaction.done;
  let main: unknown;
  for (const candidate of mainCandidates) {
    try {
      validators.validateMain?.(candidate);
      main = candidate;
      break;
    } catch {
      // A checksum-valid active slot may still be semantically damaged.
      // Prefer its independently stored backup when validation rejects it.
    }
  }
  if (main === undefined) {
    throw new SaveStoreError(
      "There is no semantically valid main-centre save to export",
    );
  }
  let metaProgression = createEmptyMetaProgression();
  let selectedMeta = metaCandidates.length === 0;
  for (const candidate of metaCandidates) {
    try {
      metaProgression = parseMetaProgression(candidate);
      selectedMeta = true;
      break;
    } catch {
      // A damaged active meta slot may recover from its valid backup.
    }
  }
  if (!selectedMeta) {
    throw new SaveStoreError(
      "There is no semantically valid medal and mastery progress to export",
    );
  }
  return { main, scenarios, metaProgression };
}

export function serializeProgressBundle(
  snapshot: ProgressBundleSnapshot,
): string {
  const payload = parseBundleSnapshot(snapshot);
  const bundle: ProgressBundleEnvelopeV3 = {
    format: PROGRESS_BUNDLE_FORMAT,
    exportVersion: PROGRESS_BUNDLE_VERSION,
    appVersion: APP_VERSION,
    writtenAt: new Date().toISOString(),
    checksum: checksum(payload),
    payload,
  };
  return JSON.stringify(bundle, null, 2);
}

interface DecodedProgressSource {
  readonly snapshot: ProgressBundleSnapshot;
  readonly legacyMainOnly: boolean;
}

function decodeProgressSource(
  source: string,
  validators: ProgressBundleValidators = {},
): DecodedProgressSource {
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch (error) {
    throw new SaveStoreError("The progress bundle is not valid JSON", {
      cause: error,
    });
  }
  if (isValidEnvelope(value as SaveEnvelope)) {
    const migratedLegacySnapshot: ProgressBundleSnapshot = {
      main: (value as unknown as SaveEnvelope).payload,
      scenarios: {},
      metaProgression: createEmptyMetaProgression(),
    };
    validateSnapshot(migratedLegacySnapshot, validators);
    return {
      snapshot: migratedLegacySnapshot,
      legacyMainOnly: true,
    };
  }
  if (
    !isRecord(value) ||
    value.format !== PROGRESS_BUNDLE_FORMAT ||
    value.exportVersion !== PROGRESS_BUNDLE_VERSION ||
    typeof value.appVersion !== "string" ||
    typeof value.writtenAt !== "string" ||
    typeof value.checksum !== "string" ||
    value.checksum !== checksum(value.payload)
  ) {
    throw new SaveStoreError("The progress bundle is damaged or unsupported");
  }
  const snapshot = parseBundleSnapshot(value.payload);
  validateSnapshot(snapshot, validators);
  return {
    snapshot,
    legacyMainOnly: false,
  };
}

export function deserializeProgressBundle(
  source: string,
  validators: ProgressBundleValidators = {},
): ProgressBundleSnapshot {
  return decodeProgressSource(source, validators).snapshot;
}

export async function exportProgressBundle(
  freshMainPayload?: unknown,
  validators: ProgressBundleValidators = {},
): Promise<string> {
  return serializeProgressBundle(
    await loadProgressBundleSnapshot(freshMainPayload, validators),
  );
}

/**
 * Replaces main, scenario, and meta progress in one IndexedDB transaction.
 * Parsing, checksums, structure, and caller-supplied semantic validation all
 * complete before this function opens that write transaction.
 */
export async function importProgressBundle(
  source: string,
  validators: ProgressBundleValidators = {},
): Promise<ProgressBundleSnapshot> {
  const decoded = decodeProgressSource(source, validators);
  const snapshot = decoded.snapshot;
  const db = await database();
  if (decoded.legacyMainOnly) {
    // A V1/V2 file predates scenarios and meta rewards. Treat it as a main
    // replacement so importing an old preview cannot erase newer medals,
    // cosmetics, titles, or independent challenge progress.
    const transaction = db.transaction("saves", "readwrite");
    await putWithBackup(
      transaction.store,
      ACTIVE_SLOT,
      BACKUP_SLOT,
      snapshot.main,
    );
    await transaction.done;
    return snapshot;
  }
  const transaction = db.transaction(
    ["saves", "scenarioSaves", "metaProgression"],
    "readwrite",
  );
  const mainStore = transaction.objectStore("saves");
  const scenarioStore = transaction.objectStore("scenarioSaves");
  const metaStore = transaction.objectStore("metaProgression");
  const currentMain = await mainStore.get(ACTIVE_SLOT);
  await scenarioStore.clear();
  await metaStore.clear();
  if (isValidEnvelope(currentMain)) {
    await mainStore.put(currentMain, BACKUP_SLOT);
  } else {
    await mainStore.delete(BACKUP_SLOT);
  }
  await mainStore.put(envelope(snapshot.main), ACTIVE_SLOT);
  for (const [rawId, payload] of Object.entries(snapshot.scenarios)) {
    const id = scenarioId(rawId);
    await scenarioStore.put(
      envelope(payload),
      scenarioSlotKey(id, ACTIVE_SLOT),
    );
  }
  await metaStore.put(
    envelope(snapshot.metaProgression),
    `${META_PROGRESSION_SLOT}${SCENARIO_SLOT_SEPARATOR}${ACTIVE_SLOT}`,
  );
  await transaction.done;
  return snapshot;
}

/**
 * Commits the destructive portion of a preserved-meta main reset in one
 * transaction. A crash can therefore leave either the old main with its old
 * mastery state or no main with the cleaned mastery state, never a fresh main
 * paired with the stale accepted contract.
 */
export async function resetMainProgress(
  value: MetaProgressionV1,
): Promise<void> {
  const metaProgression = parseMetaProgression(value);
  const db = await database();
  const transaction = db.transaction(
    ["saves", "metaProgression"],
    "readwrite",
  );
  const mainStore = transaction.objectStore("saves");
  const metaStore = transaction.objectStore("metaProgression");
  await Promise.all([
    mainStore.delete(ACTIVE_SLOT),
    mainStore.delete(BACKUP_SLOT),
    metaStore.delete(
      `${META_PROGRESSION_SLOT}${SCENARIO_SLOT_SEPARATOR}${ACTIVE_SLOT}`,
    ),
    metaStore.delete(
      `${META_PROGRESSION_SLOT}${SCENARIO_SLOT_SEPARATOR}${BACKUP_SLOT}`,
    ),
  ]);
  await metaStore.put(
    envelope(metaProgression),
    `${META_PROGRESSION_SLOT}${SCENARIO_SLOT_SEPARATOR}${ACTIVE_SLOT}`,
  );
  await transaction.done;
}

/**
 * Separately confirmed destructive action. Display/audio and nutrition-lens
 * settings remain, while game stores and progress-bearing preferences are
 * cleared atomically.
 */
export async function eraseAllProgress(): Promise<void> {
  const db = await database();
  const transaction = db.transaction(
    ["saves", "scenarioSaves", "metaProgression", "preferences"],
    "readwrite",
  );
  await Promise.all([
    transaction.objectStore("saves").clear(),
    transaction.objectStore("scenarioSaves").clear(),
    transaction.objectStore("metaProgression").clear(),
    ...PROGRESSION_PREFERENCE_KEYS.map((key) =>
      transaction.objectStore("preferences").delete(key)
    ),
  ]);
  await transaction.done;
}

export async function savePreference(
  key: string,
  value: unknown,
): Promise<void> {
  const db = await database();
  await db.put("preferences", value, key);
}

export async function loadPreference<T>(
  key: string,
  fallback: T,
): Promise<T> {
  const db = await database();
  const value = await db.get("preferences", key);
  return (value as T | undefined) ?? fallback;
}

/**
 * Legacy single-main export retained for V1/V2 file compatibility. New UI
 * flows should use exportProgressBundle so meta rewards and scenarios travel
 * together.
 */
export function exportSave(payload: unknown): string {
  return JSON.stringify(envelope(payload), null, 2);
}

export function importSave(source: string): unknown {
  let value: SaveEnvelope;
  try {
    value = JSON.parse(source) as SaveEnvelope;
  } catch (error) {
    throw new SaveStoreError("The save file is not valid JSON", { cause: error });
  }
  if (!isValidEnvelope(value)) {
    throw new SaveStoreError("The save file is damaged or unsupported");
  }
  return value.payload;
}
