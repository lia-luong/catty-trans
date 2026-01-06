// Jest configuration for Catty Trans.
// This keeps tests focused on the pure TypeScript core-domain and adapters,
// without bundling or UI concerns. ts-jest compiles TypeScript on the fly so
// we can import domain modules directly from `core-domain` and `adapters`.

/** @type {import('jest').Config} */
const config = {
  // Use ts-jest so that TypeScript source in `core-domain` and `adapters`
  // can be imported directly without a separate build step.
  preset: 'ts-jest',

  // Use the test-specific tsconfig which includes jest types
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },

  // Treat the repository root as the base for module resolution, so tests
  // can use simple relative imports to the domain modules.
  roots: ['<rootDir>/tests', '<rootDir>/core-domain', '<rootDir>/adapters'],

  testEnvironment: 'node',

  // Keep the pattern broad enough to discover all Jest tests we add for
  // golden behaviour, integration checks, and future suites.
  testMatch: ['**/?(*.)+(spec|test).ts'],

  // Map TypeScript path resolution in a minimal way; if the project adds
  // path aliases later, this can be expanded to mirror tsconfig settings.
  moduleFileExtensions: ['ts', 'js', 'json'],
};

module.exports = config;


