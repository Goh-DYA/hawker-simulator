/**
 * The release identity in `src/content/release.ts`: the content version the validator reports
 * and the Settings note shows, and the last-update date and its formatting.
 */
import { describe, expect, it } from "vitest";

import {
  CONTENT_UPDATED_ON,
  CONTENT_VERSION,
  LAUNCH_CONTENT,
  format_release_date,
} from "@/src/content";

describe("release identity", () => {
  it("reports the release version as the launch content version", () => {
    expect(LAUNCH_CONTENT.version).toBe(CONTENT_VERSION);
    expect(CONTENT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("records the last update as a real calendar date", () => {
    expect(() => format_release_date(CONTENT_UPDATED_ON)).not.toThrow();
  });

  it("formats a date as day, month name and year", () => {
    expect(format_release_date("2026-10-20")).toBe("20 October 2026");
    expect(format_release_date("2028-02-29")).toBe("29 February 2028");
    expect(format_release_date("2026-01-05")).toBe("5 January 2026");
  });

  it("rejects a value that is not an ISO calendar date", () => {
    for (const value of ["2026-02-29", "2026-13-01", "2026-00-10", "20 October 2026", ""]) {
      expect(() => format_release_date(value), value).toThrow(RangeError);
    }
  });
});
