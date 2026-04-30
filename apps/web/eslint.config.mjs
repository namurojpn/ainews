import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "__tests__/**",
    "vitest.setup.ts",
    "vitest.config.mts",
    "prisma/seed.ts",
  ]),
  {
    rules: {
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "prefer-const": "error",
      // async data-fetching inside useEffect is a standard React pattern
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
