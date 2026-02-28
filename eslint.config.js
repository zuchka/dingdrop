import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    ignores: ["build/**", "node_modules/**", "public/build/**"],
  },
];
