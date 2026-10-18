/**
 * Pure stall helpers the world view uses: which dishes a stall displays as counter props, and
 * what the vendor is doing, read from the customers the stall is serving.
 */
import type { StallDefinition } from "@/src/content";
import type { GameSnapshot } from "@/src/game/core";
import type { StallVendorActivity } from "../visuals/vendor";

const DEFAULT_DISPLAY_DISH_LIMIT = 4;

/**
 * Selects the active dishes that may be represented as props on a stall.
 * The catalogue order is used only as a safe fallback when no active ID is valid.
 *
 * @param stall - The stall content definition, whose dish IDs are the permitted props.
 * @param activeIds - Dish IDs in display priority order; IDs the stall does not sell and
 *   repeats are skipped.
 * @param limit - The most props to return.
 * @returns Up to `limit` permitted dish IDs, or the stall's first dish when none is active.
 * @throws RangeError When `limit` is not a positive safe integer.
 */
export function displayDishIdsForStall(
  stall: StallDefinition,
  activeIds: readonly string[],
  limit = DEFAULT_DISPLAY_DISH_LIMIT,
): readonly string[] {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new RangeError("Stall display dish limit must be a positive integer.");
  }

  const permittedIds = new Set(stall.dishIds);
  const selectedIds: string[] = [];
  const seenIds = new Set<string>();

  for (const dishId of activeIds) {
    if (!permittedIds.has(dishId) || seenIds.has(dishId)) continue;
    selectedIds.push(dishId);
    seenIds.add(dishId);
    if (selectedIds.length === limit) return selectedIds;
  }

  if (selectedIds.length > 0) return selectedIds;
  const fallbackId = stall.dishIds[0];
  return fallbackId ? [fallbackId] : [];
}

/**
 * Works out what a stall's vendor is doing from the customers it is serving.
 *
 * A customer waiting for food at the stall means the vendor is preparing that order; otherwise
 * a customer ordering means the vendor is taking an order, and the vendor idles when neither
 * applies.
 *
 * @param snapshot - The game snapshot being rendered.
 * @param objectId - The placed stall's object ID.
 * @returns The vendor activity, plus the dish and variant being prepared when there is one.
 */
export function stallServiceVisualState(
  snapshot: GameSnapshot,
  objectId: string,
): {
  readonly activity: StallVendorActivity;
  readonly preparingDishId?: string;
  readonly preparingVariantId?: string;
} {
  const preparing = snapshot.customers.find(
    (customer) =>
      customer.targetStallId === objectId &&
      customer.status === "waiting-for-food" &&
      customer.orderedDishId,
  );
  if (preparing) {
    return {
      activity: "prepare",
      preparingDishId: preparing.orderedDishId,
      preparingVariantId: preparing.orderedNutritionVariantId,
    };
  }
  const ordering = snapshot.customers.some(
    (customer) => customer.targetStallId === objectId && customer.status === "ordering",
  );
  return { activity: ordering ? "order" : "idle" };
}
