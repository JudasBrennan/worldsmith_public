import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "assets/**",
      "dist/**",
      "worldsmith-export.json",
      "panoptesv/**",
      "tmp-veg-samples/**",
      "scripts/extract-veg-colours.mjs",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // Browser globals for UI source files and the root app entry point.
  {
    files: ["ui/**/*.js", "app.js"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  // Node globals for script files only (engine modules are pure ESM with no Node APIs).
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // Test files need both: node (test runner APIs) and browser (jsdom for UI tests).
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
