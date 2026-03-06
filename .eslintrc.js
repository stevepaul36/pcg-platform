// .eslintrc.js
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Allow explicit `any` sparingly — the codebase uses it for Express middleware
    "@typescript-eslint/no-explicit-any": "warn",
    // Unused vars prefixed with _ are intentional (e.g. _next in error handler)
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    // Prefer const over let when variable is never reassigned
    "prefer-const": "error",
    // Consistent return types
    "@typescript-eslint/explicit-function-return-type": "off",
    // Allow empty catch blocks (used in fire-and-forget patterns)
    "no-empty": ["error", { allowEmptyCatch: true }],
  },
  ignorePatterns: ["dist/", "node_modules/", ".next/", "*.js"],
};
