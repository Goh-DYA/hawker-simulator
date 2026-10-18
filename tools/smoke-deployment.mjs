/**
 * Smoke-checks a live deployment: `npm run smoke:deployment -- <base URL>`.
 *
 * It fetches the root page, the web manifest, the service worker and two static assets,
 * and asserts the status codes, the security headers, the shell's title and copy, that
 * the shell links no third-party origins, and the manifest and service-worker markers.
 * When `VERCEL_AUTOMATION_BYPASS_SECRET` is set, it is sent as the Vercel protection
 * bypass header so protected preview deployments can be checked. Any failed assertion
 * exits non-zero.
 */
import assert from "node:assert/strict";

const deployment = process.argv[2];

if (!deployment) {
  process.stderr.write("Usage: npm run smoke:deployment -- https://deployment.example\n");
  process.exit(2);
}

const baseUrl = new URL(deployment);
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const requestHeaders = bypass
  ? {
      "x-vercel-protection-bypass": bypass,
    }
  : undefined;

/**
 * Fetches a deployment path and requires a 200 response.
 *
 * @param {string} path - The path to fetch, relative to the deployment's base URL.
 * @returns {Promise<Response>} The response.
 * @throws {Error} When the request fails, naming whether the bypass header was sent.
 * @throws {import("node:assert").AssertionError} When the status is not 200.
 */
async function request(path) {
  const url = new URL(path, baseUrl);
  let response;
  try {
    response = await fetch(url, {
      headers: requestHeaders,
      redirect: "follow",
      cache: "no-store",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const bypassState = bypass
      ? "The Vercel automation bypass header was supplied."
      : "No Vercel automation bypass secret was supplied.";
    throw new Error(`Deployment request failed for ${url}: ${detail} ${bypassState}`, {
      cause: error,
    });
  }
  assert.equal(response.status, 200, `${url} returned ${response.status}`);
  return response;
}

const rootResponse = await request("/");
assert.match(
  rootResponse.headers.get("content-type") ?? "",
  /^text\/html\b/i,
  "The root response is not HTML.",
);
assert.match(
  rootResponse.headers.get("content-security-policy") ?? "",
  /default-src 'self'/,
  "The root response is missing the expected Content-Security-Policy.",
);
assert.equal(
  rootResponse.headers.get("x-content-type-options"),
  "nosniff",
  "The root response is missing X-Content-Type-Options.",
);
assert.equal(
  rootResponse.headers.get("x-frame-options"),
  "DENY",
  "The root response is missing X-Frame-Options.",
);

const html = await rootResponse.text();
assert.match(html, /<title>Hawker Balance/);
assert.match(html, /Run the centre\. Read the plate\./);
assert.match(html, /data-testid="game-world"/);
assert.match(html, /manifest\.webmanifest/);

const responseOrigin = new URL(rootResponse.url).origin;
for (const match of html.matchAll(/https?:\/\/[^"'<>\s]+/g)) {
  assert.equal(
    new URL(match[0]).origin,
    responseOrigin,
    `Unexpected third-party URL in the rendered shell: ${match[0]}`,
  );
}

const manifestResponse = await request("/manifest.webmanifest");
const manifest = await manifestResponse.json();
assert.equal(manifest.name, "Hawker Balance");
assert.equal(manifest.start_url, "/");
assert.equal(manifest.display, "standalone");

const serviceWorkerResponse = await request("/sw.js");
const serviceWorker = await serviceWorkerResponse.text();
assert.match(serviceWorker, /hawker-simulator-1\.0\.0-[a-f0-9]{12}/);
assert.match(serviceWorker, /WARM_CACHE/);
assert.match(serviceWorker, /ACTIVATE_UPDATE/);

await request("/icons/icon.svg");
await request("/og.png");

process.stdout.write(`Deployment smoke checks passed: ${rootResponse.url}\n`);
