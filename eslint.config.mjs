import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Import order: Node built-ins, third-party packages, first-party `@/` modules, then relative
  // imports. Blank lines between groups are left to each file, because the codebase mixes both.
  {
    rules: {
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          "newlines-between": "ignore",
          alphabetize: { order: "ignore" },
        },
      ],
    },
  },
  // src/game/core is the pure, deterministic simulation (ADR 0004): no content, engine, UI,
  // storage or browser APIs, and no ambient randomness or wall-clock time.
  {
    files: ["src/game/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "phaser", message: "src/game/core must stay engine-free." },
            { name: "react", message: "src/game/core must stay UI-free." },
            { name: "react-dom", message: "src/game/core must stay UI-free." },
            { name: "idb", message: "src/game/core must not touch storage." },
            { name: "zod", message: "src/game/core receives validated data; schemas live in src/content." },
          ],
          patterns: [
            {
              group: [
                "@/src/content*",
                "**/content/**",
                "@/src/game/runtime*",
                "@/src/game/persistence*",
                "@/app/*",
                "next/*",
              ],
              message: "src/game/core may only import from itself; it receives a SimulationCatalog instead.",
            },
          ],
        },
      ],
      // The patterns above match `@/` aliases; this resolves every specifier, relative ones
      // included, so `../../content` or `../runtime/world` fail too.
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/game/core",
              from: [
                "./src/content",
                "./src/game/runtime",
                "./src/game/persistence",
                "./src/game/audio",
                "./src/game/pwa",
                "./app",
              ],
              message: "src/game/core may only import from itself; it receives a SimulationCatalog instead.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        ...[
          "window",
          "document",
          "navigator",
          "location",
          "localStorage",
          "sessionStorage",
          "indexedDB",
          "performance",
          "fetch",
        ].map((name) => ({ name, message: "src/game/core must not use browser APIs." })),
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Thread randomness through rng.ts instead." },
        { object: "Date", property: "now", message: "Core time comes from the fixed simulation step." },
      ],
    },
  },
  // Render and visuals modules draw through Phaser objects handed to them, so they may import
  // Phaser types only; a value import would pull the engine into chunks that must stay light.
  {
    files: [
      "src/game/runtime/render/**/*.ts",
      "src/game/runtime/art/**/*.ts",
      "src/game/runtime/visuals/**/*.ts",
      "src/game/runtime/{catalog,world,saves,nutrition,snapshot}.ts",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "phaser",
              message: "Import Phaser types only (import type); the scene owns the engine.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  // app/ loads the runtime lazily (dynamic import inside an effect), so a static value import
  // of the runtime root, render code or vendor visuals would pull Phaser into the eager chunk
  // or into SSR.
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/src/game/runtime/createHawkerRuntime",
              message: "Load the runtime with a dynamic import() so Phaser stays out of the eager chunk and SSR.",
              allowTypeImports: true,
            },
            {
              name: "@/src/game/runtime/visuals/vendor",
              message: "Vendor visuals belong to the lazily loaded runtime.",
            },
          ],
          patterns: [
            {
              group: ["@/src/game/runtime/render/*", "@/src/game/runtime/art/*"],
              message: "Render code belongs to the lazily loaded runtime.",
            },
          ],
        },
      ],
      // The rule above matches `@/` aliases; this resolves relative specifiers as well.
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./app",
              from: "./src/game/runtime/render",
              message: "Render code belongs to the lazily loaded runtime.",
            },
            {
              target: "./app",
              from: "./src/game/runtime/art",
              message: "Painters belong to the lazily loaded runtime; the HUD gets thumbnails through the controller.",
            },
            {
              target: "./app",
              from: "./src/game/runtime/visuals/vendor.ts",
              message: "Vendor visuals belong to the lazily loaded runtime.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next. Generated output is ignored here rather
  // than on the command line, so `npx eslint .` and `npm run lint` agree.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "next-env.d.ts",
    // Build, deploy and tooling output:
    "dist/**",
    ".wrangler/**",
    ".vinext/**",
    ".vercel/**",
    "coverage/**",
    // Local, git-ignored art previews:
    "scratch/**",
  ]),
]);

export default eslintConfig;
