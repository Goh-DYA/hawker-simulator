/**
 * Recovery of saved objects and unlocks whose content definitions changed.
 *
 * Applies the explicit alias and refund migrations from `DeserializeOptions` and records
 * each change in the recovery report.
 */
import { getObjectQueueAnchor, samePoint, validatePlacement } from "../grid";
import { get_navigation_reserved_points } from "../queueing";
import { compareIds } from "../ordering";
import type { PersistentGameStateV5, PlacedObject, SimulationCatalog } from "../types";
import { PersistenceError } from "./fields";
import type { DeserializeOptions, PersistenceRecoveryReport } from "./index";

/**
 * Validates saved objects against the catalog, applying explicit content migrations.
 *
 * Objects whose definition was renamed are remapped through `definitionIdAliases`, and
 * objects whose definition was removed are dropped and refunded through
 * `removedDefinitionRefunds`. A queue head saved one tile off its service point is moved
 * back onto it.
 *
 * @param save - The migrated save.
 * @param catalog - The simulation catalog the save is loaded against.
 * @param options - The explicit content migrations.
 * @returns The accepted objects and a report of every recovery applied.
 * @throws PersistenceError When an object ID repeats, a removed definition has no migration, a refund is invalid or a placement is invalid.
 */
export function normalizeObjects(
  save: PersistentGameStateV5,
  catalog: SimulationCatalog,
  options: DeserializeOptions,
): { readonly objects: readonly PlacedObject[]; readonly recovery: PersistenceRecoveryReport } {
  const accepted: Record<string, PlacedObject> = {};
  const warnings: string[] = [];
  const remappedObjectIds: Record<string, string> = {};
  const removedObjectIds: string[] = [];
  let currencyRefunded = 0;
  for (const source of save.objects) {
    if (accepted[source.id]) throw new PersistenceError(`Duplicate saved object id: ${source.id}`);
    let definitionId = source.definitionId;
    if (!catalog.placeables[definitionId]) {
      const alias = options.definitionIdAliases?.[definitionId];
      if (alias && catalog.placeables[alias]) {
        definitionId = alias;
        remappedObjectIds[source.id] = alias;
        warnings.push(`Remapped ${source.id} from ${source.definitionId} to ${alias}`);
      } else {
        const refund = options.removedDefinitionRefunds?.[definitionId];
        if (refund === undefined) {
          throw new PersistenceError(
            `Saved object ${source.id} references removed definition ${definitionId}; provide an alias or explicit refund migration`,
          );
        }
        if (!Number.isFinite(refund) || refund < 0) {
          throw new PersistenceError(`Refund migration for ${definitionId} must be non-negative`);
        }
        currencyRefunded += refund;
        removedObjectIds.push(source.id);
        warnings.push(`Removed ${source.id} (${definitionId}) and refunded ${refund}`);
        continue;
      }
    }
    const sourceObject: PlacedObject = { ...source, definitionId };
    const queueAnchor = getObjectQueueAnchor(sourceObject, catalog);
    const queueHead = sourceObject.queuePath?.[0];
    const queueHeadMovedOneTile =
      queueAnchor &&
      queueHead &&
      !samePoint(queueAnchor, queueHead) &&
      Math.abs(queueAnchor.x - queueHead.x) + Math.abs(queueAnchor.y - queueHead.y) === 1;
    const object: PlacedObject = queueHeadMovedOneTile
      ? {
          ...sourceObject,
          queuePath: [queueAnchor, ...(sourceObject.queuePath?.slice(0, -1) ?? [])],
        }
      : sourceObject;
    if (queueHeadMovedOneTile) {
      warnings.push(`Moved ${object.id}'s queue head to its updated service point`);
    }
    const validation = validatePlacement(save.map, accepted, catalog, object, {
      reservedPoints: get_navigation_reserved_points(save),
    });
    if (!validation.valid) {
      throw new PersistenceError(`Saved object ${object.id} has invalid placement: ${validation.reasons.join("; ")}`);
    }
    accepted[object.id] = object;
  }
  return {
    objects: Object.values(accepted),
    recovery: { warnings, remappedObjectIds, removedObjectIds, currencyRefunded },
  };
}

/**
 * Validates saved unlocked definition IDs against the catalog, applying explicit content migrations.
 *
 * @param ids - The saved unlocked definition IDs.
 * @param catalog - The simulation catalog the save is loaded against.
 * @param options - The explicit content migrations.
 * @returns The accepted IDs, sorted with `compareIds`, and the recovery warnings.
 * @throws PersistenceError When an ID references a removed definition with no migration.
 */
export function normalizeUnlocks(
  ids: readonly string[],
  catalog: SimulationCatalog,
  options: DeserializeOptions,
): { readonly ids: readonly string[]; readonly warnings: readonly string[] } {
  const accepted = new Set<string>();
  const warnings: string[] = [];
  for (const id of ids) {
    if (catalog.placeables[id]) {
      accepted.add(id);
      continue;
    }
    const alias = options.definitionIdAliases?.[id];
    if (alias && catalog.placeables[alias]) {
      accepted.add(alias);
      warnings.push(`Remapped unlocked definition ${id} to ${alias}`);
      continue;
    }
    if (options.removedDefinitionRefunds?.[id] !== undefined) {
      warnings.push(`Removed obsolete unlocked definition ${id}`);
      continue;
    }
    throw new PersistenceError(
      `Progression references removed definition ${id}; provide an alias or explicit removal migration`,
    );
  }
  return { ids: [...accepted].sort(compareIds), warnings };
}
