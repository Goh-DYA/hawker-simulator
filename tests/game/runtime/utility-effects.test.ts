import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { PLACEABLES } from "@/src/content";
import { buildCatalog } from "@/src/game/runtime/catalog";
import {
  count_station_crew,
  hasMeaningfulUtility,
  utilityEffectsForPlaceable,
} from "@/src/game/runtime/contentUtility";

describe("placeable gameplay utility", () => {
  it("gives every sign and facility a discoverable, non-zero simulation effect", () => {
    const managed = PLACEABLES.filter(
      (item) => item.category === "signage" || item.category === "facility",
    );
    assert.equal(managed.length, 16);
    assert.ok(managed.every(hasMeaningfulUtility));
    assert.ok(
      managed
        .filter((item) => item.category === "signage")
        .every((item) => utilityEffectsForPlaceable(item).wayfinding > 0),
    );
  });

  it("gives every placeable but a plain seat an effect the simulation reads", () => {
    const inert = PLACEABLES.filter(
      (item) => item.category !== "seat" && !hasMeaningfulUtility(item),
    ).map((item) => item.id);
    assert.deepEqual(inert, []);
  });

  it("authors no queue points, which the simulation never reads", () => {
    assert.deepEqual(
      PLACEABLES.filter((item) => item.queuePoints.length > 0).map((item) => item.id),
      [],
    );
  });

  it("gives each formerly weak early piece a distinct effect it describes", () => {
    const effects = (id: string) => {
      const item = PLACEABLES.find((candidate) => candidate.id === id);
      assert.ok(item);
      const utility = utilityEffectsForPlaceable(item);
      return {
        cleanliness: utility.cleanliness,
        queuePatience: utility.queuePatience,
        eatingSpeed: utility.eatingSpeed,
        cleaningEfficiency: utility.cleaningEfficiency,
        movementSpeed: utility.movementSpeed,
      };
    };
    assert.deepEqual(effects("item.first-aid-cabinet"), {
      cleanliness: 0,
      queuePatience: 0.04,
      eatingSpeed: 0,
      cleaningEfficiency: 0.15,
      movementSpeed: 0,
    });
    assert.deepEqual(effects("item.protected-utility-point"), {
      cleanliness: 3,
      queuePatience: 0,
      eatingSpeed: 0,
      cleaningEfficiency: 0.2,
      movementSpeed: 0.04,
    });
    assert.deepEqual(effects("item.cutlery-napkin-station"), {
      cleanliness: 1,
      queuePatience: 0,
      eatingSpeed: 0.06,
      cleaningEfficiency: 0,
      movementSpeed: 0,
    });
    assert.deepEqual(effects("item.folding-overflow-table"), {
      cleanliness: 0,
      queuePatience: 0,
      eatingSpeed: 0.08,
      cleaningEfficiency: 0,
      movementSpeed: 0,
    });
    for (const id of [
      "item.high-volume-air-fan",
      "item.condiment-counter",
      "item.queue-ticket-dispenser",
      "item.mobile-prep-cart",
      "item.retractable-queue-rail",
    ]) {
      assert.ok(effects(id).queuePatience >= 0.06, id);
    }
  });

  it("brings one table-cleaning crew member per tray-return opening, plus one for a self-clearing station", () => {
    const crew = Object.fromEntries(
      PLACEABLES.filter((item) => count_station_crew(item) > 0).map((item) => [
        item.id,
        count_station_crew(item),
      ]),
    );
    assert.deepEqual(crew, {
      "item.single-bay-tray-return": 1,
      "item.dual-bay-tray-return": 2,
      "item.dish-drop-counter": 2,
      "item.tray-return-conveyor": 3,
    });
  });

  it("projects a station's crew into the catalog, leaving a one-member station on core's default", () => {
    const { catalog } = buildCatalog();
    assert.equal(catalog.placeables["item.single-bay-tray-return"]?.cleaningCrew, undefined);
    assert.equal(catalog.placeables["item.dual-bay-tray-return"]?.cleaningCrew, 2);
    assert.equal(catalog.placeables["item.tray-return-conveyor"]?.cleaningCrew, 3);
    assert.equal(catalog.placeables["item.stacking-stool"]?.cleaningCrew, undefined);
  });
});
