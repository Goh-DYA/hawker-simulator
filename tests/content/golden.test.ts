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
const CONTENT_SHA256 = "95c80d7611a87334352d3b93fa23514d41c438430c58190ee61fcebd525a0528";

/** sha256 of `JSON.stringify` of each part of {@link CONTENT_SHA256}, as a diff aid. */
const CONTENT_PART_SHA256 = {
  stalls: "6a3cbfb9eed34cfc26a03e2058e27c0002c1497acf015b1a162f74a47a3a21b4",
  dishes: "dab8add677ed5a50a227fc4ff9ed89830ff05903641312c69b9e2975bd1fc860",
  placeables: "d2502d9ac3af12a77f7eb39cde4e4a7cc9a1c6707750ed83d0d2a46549714eaa",
  customerArchetypes: "260ab8446848041b70b698e934c4b710fc180a70f4e531dd0c57aa2b533e5713",
  localizationEntries: "407d258061f90a16e365a9e66de235bb0e97af0ced6ec149524c062223002841",
} as const;

/** sha256 of `JSON.stringify(LAUNCH_CONTENT)`, which adds the economy and nutrition data. */
const LAUNCH_CONTENT_SHA256 = "f5fe0c60aafaa168c83759a9a994cc8089880722a0172bb3def68991aba2264e";

/** sha256 of `JSON.stringify(validateContent())`. */
const VALIDATION_REPORT_SHA256 = "0d0c235dcc29c9a9469b8175eacf92e00d96e8f122f84b2dd8de0d6471963166";

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
