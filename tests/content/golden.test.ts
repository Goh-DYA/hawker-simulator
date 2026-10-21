/**
 * Golden master for the launch content data and its validation report.
 *
 * Each literal is the sha256 of a raw `JSON.stringify` string, so array order, object key
 * order and every derived field are pinned along with the values. The localization table
 * is hashed as `Object.entries`, which pins the order of its keys as well as the key
 * strings, because the runtime and saves address copy by those keys.
 *
 * The per-collection hashes only locate which collection moved once the combined hash
 * fails. The literals change only in intentional content commits. If a refactor makes one
 * fail, the refactor changed the shipped content: fix the code, never the literal.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  CUSTOMER_ARCHETYPES,
  DISHES,
  ENGLISH_LOCALIZATION,
  LAUNCH_CONTENT,
  PLACEABLES,
  STALLS,
  validateContent,
} from "@/src/content";

/** sha256 of `JSON.stringify` of the combined launch data. */
const CONTENT_SHA256 = "5dbe8fec9d413f6e3f15779817ab18accc07a70e3a2f1411bc88e8a75f224850";

/** sha256 of `JSON.stringify` of each part of {@link CONTENT_SHA256}, as a diff aid. */
const CONTENT_PART_SHA256 = {
  stalls: "6a3cbfb9eed34cfc26a03e2058e27c0002c1497acf015b1a162f74a47a3a21b4",
  dishes: "dab8add677ed5a50a227fc4ff9ed89830ff05903641312c69b9e2975bd1fc860",
  placeables: "5244912bfba4e749105eb988e6af89961d0affbdc0eea8a855490e7428e00dfe",
  customerArchetypes: "511a1cc7425691baa23464b197a4925468701f4d7db3933a19c1250e7d028856",
  localizationEntries: "5ec1237f56dd7fa23cddc4ef5a046d2729342d56e33a812406c929bcc672c887",
} as const;

/** sha256 of `JSON.stringify(LAUNCH_CONTENT)`, which adds the economy and nutrition data. */
const LAUNCH_CONTENT_SHA256 = "d1f9fb8253771cff10de4c5795487e0bb59601b86653339daf48eb5a372cc4ce";

/** sha256 of `JSON.stringify(validateContent())`. */
const VALIDATION_REPORT_SHA256 = "0efbdc17f8a800ab981941ceea303e7bd6bfbc8c0a4bf6c020ac07cafc334394";

function hash_json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

describe("launch content golden", () => {
  it("pins the stalls, dishes, placeables, archetypes and localization order", () => {
    expect(
      hash_json({
        STALLS,
        DISHES,
        PLACEABLES,
        CUSTOMER_ARCHETYPES,
        entries: Object.entries(ENGLISH_LOCALIZATION),
      }),
    ).toBe(CONTENT_SHA256);
  });

  it("pins each content collection separately", () => {
    expect({
      stalls: hash_json(STALLS),
      dishes: hash_json(DISHES),
      placeables: hash_json(PLACEABLES),
      customerArchetypes: hash_json(CUSTOMER_ARCHETYPES),
      localizationEntries: hash_json(Object.entries(ENGLISH_LOCALIZATION)),
    }).toEqual(CONTENT_PART_SHA256);
  });

  it("pins the whole launch content object", () => {
    expect(hash_json(LAUNCH_CONTENT)).toBe(LAUNCH_CONTENT_SHA256);
  });

  it("pins the validation report", () => {
    expect(hash_json(validateContent())).toBe(VALIDATION_REPORT_SHA256);
  });
});
