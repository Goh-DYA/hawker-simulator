/** Integer Singapore-dollar money primitives for deterministic core rules. */

declare const MONEY_CENTS: unique symbol;
declare const MONEY_DELTA_CENTS: unique symbol;

export type MoneyCents = number & { readonly [MONEY_CENTS]: "MoneyCents" };
export type MoneyDeltaCents = number & { readonly [MONEY_DELTA_CENTS]: "MoneyDeltaCents" };

export const ZERO_CENTS = 0 as MoneyCents;
export const SGD_CENTS_PER_DOLLAR = 100;
export type SgdDisplay = "compact" | "ledger";

function finiteCents(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError("SGD amount must be a safe integer number of cents");
  }
  return value;
}

/** The single visible formatter for every player-facing Singapore-dollar amount. */
export function formatSgd(cents: number, display: SgdDisplay = "compact"): string {
  const safeCents = finiteCents(cents);
  const dollars = safeCents / SGD_CENTS_PER_DOLLAR;
  const fractionDigits = display === "ledger" || safeCents % SGD_CENTS_PER_DOLLAR !== 0
    ? 2
    : 0;
  const amount = new Intl.NumberFormat("en-SG", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(dollars);
  return display === "ledger" ? `SGD ${amount}` : `S$${amount}`;
}

/** Full currency wording for accessible names and screen-reader-only copy. */
export function describeSgd(cents: number): string {
  const safeCents = finiteCents(cents);
  const sign = safeCents < 0 ? "minus " : "";
  const absolute = Math.abs(safeCents);
  const dollars = Math.floor(absolute / SGD_CENTS_PER_DOLLAR);
  const remainder = absolute % SGD_CENTS_PER_DOLLAR;
  const dollarLabel = dollars === 1 ? "Singapore dollar" : "Singapore dollars";
  const centLabel = remainder === 1 ? "cent" : "cents";
  return `${sign}${dollars} ${dollarLabel} and ${remainder} ${centLabel}`;
}

export function asMoneyCents(value: number, name = "Money"): MoneyCents {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer number of cents`);
  }
  return value as MoneyCents;
}

export function asMoneyDeltaCents(value: number, name = "Money delta"): MoneyDeltaCents {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${name} must be a safe integer number of cents`);
  return value as MoneyDeltaCents;
}

/** Converts an authored or legacy SGD amount exactly once at an input boundary. */
export function sgdToCents(value: number, name = "SGD amount"): MoneyCents {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be non-negative`);
  }
  return asMoneyCents(Math.round((value + Number.EPSILON) * SGD_CENTS_PER_DOLLAR), name);
}

/** Compatibility-only conversion for older callers. Core calculations stay in cents. */
export function centsToSgd(value: MoneyCents): number {
  return value / SGD_CENTS_PER_DOLLAR;
}

export function addCents(...values: readonly MoneyCents[]): MoneyCents {
  return asMoneyCents(values.reduce<number>((total, value) => total + value, 0));
}

export function subtractCents(value: MoneyCents, amount: MoneyCents): MoneyCents {
  if (amount > value) throw new RangeError("Money subtraction cannot make the balance negative");
  return asMoneyCents(value - amount);
}

/** Multiplies cents by basis points with deterministic half-up cent rounding. */
export function multiplyByBasisPoints(value: MoneyCents, basisPoints: number): MoneyCents {
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) {
    throw new RangeError("Basis points must be a non-negative safe integer");
  }
  const numerator = value * basisPoints;
  if (!Number.isSafeInteger(numerator)) throw new RangeError("Money calculation exceeds safe integer range");
  return asMoneyCents(Math.floor((numerator + 5_000) / 10_000));
}

/** Applies a rate with floor rounding, used by the fixed 70% resale rule. */
export function floorRate(value: MoneyCents, numerator: number, denominator: number): MoneyCents {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    numerator < 0 ||
    denominator <= 0
  ) {
    throw new RangeError("Rate must use non-negative integer terms and a positive denominator");
  }
  const product = value * numerator;
  if (!Number.isSafeInteger(product)) throw new RangeError("Money calculation exceeds safe integer range");
  return asMoneyCents(Math.floor(product / denominator));
}
