/**
 * The launch content validator.
 *
 * `validateContent` parses the content with the Zod schemas, then runs the semantic rule
 * groups from `rules.ts` in a fixed order, and reports every problem in one error.
 */
import { LAUNCH_CONTENT } from "./catalog";
import {
  check_customers,
  check_dishes,
  check_economy,
  check_identity_and_copy,
  check_nutrition,
  check_placeables,
  check_progression,
  check_roster,
  check_stalls,
} from "./rules";
import { launchContentSchema } from "./schemas";
import type { PlaceableCategory } from "./types";

/** The summary `validateContent` returns for content that passes every check. */
export interface ContentValidationReport {
  readonly version: string;
  readonly counts: {
    readonly stalls: number;
    readonly dishes: number;
    readonly placeables: number;
    readonly customerArchetypes: number;
    readonly nutritionProfiles: number;
    readonly nutritionVariantFamilies: number;
    readonly localizationKeys: number;
  };
  readonly categoryCounts: Readonly<Record<PlaceableCategory, number>>;
  readonly starterBundleCost: number;
}

/** The aggregated error `validateContent` throws, holding every issue it found. */
export class ContentValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Launch content validation failed:\n- ${issues.join("\n- ")}`);
    this.name = "ContentValidationError";
    this.issues = issues;
  }
}

/**
 * Performs schema and semantic validation. It throws one aggregated, actionable
 * error so development startup and CI show every broken content relationship at
 * once instead of failing on the first malformed record.
 *
 * @param candidate - The content to validate; the launch content when omitted.
 * @returns The counts and starter bundle cost of the valid content.
 * @throws ContentValidationError When the content fails the schema or any semantic rule.
 */
export const validateContent = (
  candidate: unknown = LAUNCH_CONTENT,
): ContentValidationReport => {
  const parsed = launchContentSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new ContentValidationError(
      parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
      ),
    );
  }

  const content = parsed.data;
  const issues: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) issues.push(message);
  };

  check_roster(content, check);
  check_identity_and_copy(content, check);
  check_stalls(content, check);
  check_dishes(content, check);
  check_nutrition(content, check);
  const categoryCounts = check_placeables(content, check);
  check_progression(content, check);
  const starterBundleCost = check_economy(content, check);
  check_customers(content, check);

  if (issues.length > 0) throw new ContentValidationError(issues);

  return {
    version: content.version,
    counts: {
      stalls: content.stalls.length,
      dishes: content.dishes.length,
      placeables: content.placeables.length,
      customerArchetypes: content.customerArchetypes.length,
      nutritionProfiles: content.nutrition.profiles.length,
      nutritionVariantFamilies: content.nutrition.variantFamilies.length,
      localizationKeys: Object.keys(content.localization).length,
    },
    categoryCounts,
    starterBundleCost,
  };
};
