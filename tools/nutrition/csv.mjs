/**
 * CSV parsing and row hashing for the nutrition importer.
 *
 * The importer reads the reviewed food and guideline CSV files with `parseCsv`, and records
 * each mapped food row's `canonicalRowHash` in profile provenance so a later source change
 * to that row is detectable.
 */
// @ts-check
import { createHash } from "node:crypto";

/**
 * One parsed CSV data row, keyed by trimmed column heading.
 *
 * @typedef {object} CsvRow
 * @property {number} sourceRowNumber - One-based position of the record among the file's
 *   non-blank records, where the heading row is 1.
 * @property {Record<string, string>} values - Raw cell text keyed by column heading.
 */

/**
 * A parsed CSV file: its headings in source order and its data rows.
 *
 * @typedef {object} ParsedCsv
 * @property {string[]} headers
 * @property {CsvRow[]} rows
 */

/**
 * Hex SHA-256 digest of the input, used for source file and row hashes.
 *
 * @param {string} input - Text to hash as UTF-8.
 * @returns {string} The lowercase hexadecimal digest.
 */
export const sha256 = (input) =>
  createHash("sha256").update(input).digest("hex");

/**
 * Parses RFC 4180-style CSV, including quoted commas, escaped quotes, embedded
 * newlines, CRLF input, and an optional UTF-8 byte-order mark.
 *
 * @param {string} text - The whole CSV file.
 * @returns {ParsedCsv} The trimmed headings and every non-blank data row.
 * @throws {Error} When the input ends inside a quoted field, has no records, repeats a
 *   heading, or has a record whose field count differs from the heading row.
 */
export const parseCsv = (text) => {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  /** @type {string[][]} */
  const records = [];
  /** @type {string[]} */
  let record = [];
  let cell = "";
  let quoted = false;

  const pushRecord = () => {
    record.push(cell);
    cell = "";
    if (record.some((value) => value.length > 0)) records.push(record);
    record = [];
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      record.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      pushRecord();
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("CSV input ends inside a quoted field.");
  if (cell.length > 0 || record.length > 0) pushRecord();
  if (records.length === 0) throw new Error("CSV input has no records.");

  const headers = records[0].map((header) => header.trim());
  if (new Set(headers).size !== headers.length) {
    throw new Error("CSV input contains duplicate column headings.");
  }

  const rows = records.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(
        `CSV record ${index + 2} has ${values.length} fields; expected ${headers.length}.`,
      );
    }
    return {
      sourceRowNumber: index + 2,
      values: Object.fromEntries(
        headers.map((header, columnIndex) => [header, values[columnIndex]]),
      ),
    };
  });

  return { headers, rows };
};

/**
 * Hashes one row's cells in heading order, so the digest is independent of object key
 * order and changes whenever any cell or the heading order changes.
 *
 * @param {readonly string[]} headers - The file's headings in source order.
 * @param {Readonly<Record<string, string>>} row - The row's cells keyed by heading.
 * @returns {string} The hex SHA-256 of the row's `[heading, cell]` pairs as JSON.
 */
export const canonicalRowHash = (headers, row) =>
  sha256(JSON.stringify(headers.map((header) => [header, row[header]])));
