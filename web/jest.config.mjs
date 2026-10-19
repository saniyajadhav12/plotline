import nextJest from "next/jest.js";

// next/jest applies Next.js's own compiler (TypeScript + JSX), the @/ path alias
// from tsconfig.json, CSS/image import handling, and .env loading.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Same alias as tsconfig.json ("@/*" -> "./src/*"). next/jest rewrites @/ in
  // import statements, but jest.mock("@/...") is resolved by Jest itself.
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  // Reset every jest.fn() / mock between tests, so one test's fake API
  // responses can never leak into another.
  clearMocks: true,
  restoreMocks: true,
};

export default createJestConfig(config);
