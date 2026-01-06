---
name: Golden Tests Implementation
overview: Set up Jest testing infrastructure and implement golden tests for existing core-domain functionality (G1-G3, G12-G15), with placeholder tests for unimplemented features (TM and diff engine).
todos:
  - id: setup-jest
    content: "Set up Jest testing infrastructure: create package.json with Jest dependencies, jest.config.js for TypeScript, and test scripts"
    status: completed
  - id: test-g1
    content: "Implement G1 — Snapshot Immutability test: verify snapshots remain byte-for-byte identical after later changes"
    status: completed
    dependencies:
      - setup-jest
  - id: test-g2
    content: "Implement G2 — Rollback Is Exact test: verify rollbackToSnapshot restores exact state with no residual metadata"
    status: completed
    dependencies:
      - setup-jest
  - id: test-g3
    content: "Implement G3 — No Silent State Mutation test: verify applyTranslationChange does not mutate input state"
    status: completed
    dependencies:
      - setup-jest
  - id: test-g13
    content: "Implement G13 — Corrupted Artefact Blocks Progress test: verify verifySnapshotIntegrity detects and blocks corrupted snapshots"
    status: completed
    dependencies:
      - setup-jest
  - id: test-g14
    content: "Implement G14 — core-domain Has No IO test: static analysis to detect forbidden imports (fs, sqlite, network, etc.)"
    status: completed
    dependencies:
      - setup-jest
  - id: test-g15
    content: "Implement G15 — Domain Logic Is Adapter-Agnostic test: static analysis to detect adapter-specific assumptions"
    status: completed
    dependencies:
      - setup-jest
  - id: create-test-helpers
    content: "Create test utilities: test-fixtures.ts for factory functions, assertions.ts for custom assertions, state-equality.ts for deep equality"
    status: completed
    dependencies:
      - setup-jest
  - id: placeholder-tm-tests
    content: "Create placeholder tests for G4-G6 (TM safety): cross-client-blocked, ad-hoc-no-pollution, tm-entries-immutable with test.skip()"
    status: completed
    dependencies:
      - setup-jest
  - id: placeholder-tm-query-tests
    content: "Create placeholder tests for G7-G8 (TM query determinism): same-query-same-result, match-provenance-explainable with test.skip()"
    status: completed
    dependencies:
      - setup-jest
  - id: placeholder-diff-tests
    content: "Create placeholder tests for G9-G11 (diff engine): explains-what-changed, no-invented-reasons, tm-driven-distinguishable with test.skip()"
    status: completed
    dependencies:
      - setup-jest
  - id: placeholder-g12-g16
    content: Create placeholder tests for G12 (partial diff) and G16 (explainability) with test.skip()
    status: completed
    dependencies:
      - setup-jest
---

# Golden Tests Implementation Plan

## Overview

Implement golden tests from `tests/all-golden-tests.md` using Jest. Focus on tests for existing functionality (core-domain invariants, integrity checks, architectural guardrails), and create placeholder tests for unimplemented features (TM and diff engine) that will be implemented later.

## Test Organization

Tests will be organized in `tests/` directory mirroring the golden test structure:

- `tests/golden/core-domain/` - Core domain invariant tests (G1-G3)
- `tests/golden/tm/` - TM safety tests (G4-G6) - **Placeholders only**
- `tests/golden/tm-query/` - TM query determinism tests (G7-G8) - **Placeholders only**
- `tests/golden/diff/` - Diff engine tests (G9-G11) - **Placeholders only**
- `tests/golden/failure/` - Failure behavior tests (G12-G13)
- `tests/golden/architecture/` - Architectural guardrail tests (G14-G15)
- `tests/golden/meta/` - Meta explainability test (G16) - **Placeholder only**

## Implementation Tasks

### 1. Set Up Jest Testing Infrastructure

**Files to create:**

- `package.json` - Add Jest dependencies and test scripts
- `jest.config.js` - Jest configuration for TypeScript
- `tsconfig.test.json` - TypeScript config for tests (if needed)

**Configuration:**

- TypeScript support via `ts-jest`
- Test file pattern: `**/*.test.ts`, `**/*.spec.ts`
- Coverage reporting (optional)
- Path aliases if needed for imports

### 2. Implement Core Domain Invariant Tests (G1-G3)

**G1 — Snapshot Immutability** (`tests/golden/core-domain/snapshot-immutability.test.ts`)

- Test that snapshots remain byte-for-byte identical after later changes
- Verify no reference equality to mutable structures
- Use `commitSnapshot` and `applyTranslationChange` from `core-domain/history/versioning.ts`

**G2 — Rollback Is Exact, Not Approximate** (`tests/golden/core-domain/rollback-exact.test.ts`)

- Test that `rollbackToSnapshot` restores exact state
- Verify no residual metadata, flags, or counters from later states
- Use `rollbackToSnapshot` from `core-domain/history/versioning.ts`

**G3 — No Silent State Mutation** (`tests/golden/core-domain/no-state-mutation.test.ts`)

- Test that `applyTranslationChange` doesn't mutate input state
- Verify returned state is a new object
- Use deep equality checks to ensure immutability

### 3. Implement Failure Behavior Tests (G12-G13)

**G12 — Partial Diff Is Labelled as Partial** (`tests/golden/failure/partial-diff-labelled.test.ts`)

- **Placeholder**: Skip until diff engine is implemented
- Document expected behavior: diff result must include `isPartial === true` when computation exceeds threshold

**G13 — Corrupted Artefact Blocks Progress** (`tests/golden/failure/corrupted-artefact-blocks.test.ts`)

- Test that `verifySnapshotIntegrity` from `adapters/integrity/verify-snapshot-integrity.ts` detects checksum mismatches
- Verify system refuses to proceed with corrupted snapshots
- Test that `isSafe === false` when checksum mismatch is detected

### 4. Implement Architectural Guardrail Tests (G14-G15)

**G14 — core-domain Has No IO** (`tests/golden/architecture/core-domain-no-io.test.ts`)

- Static analysis test: scan `core-domain/` for forbidden imports
- Check for: `fs`, `sqlite`, network libraries, timers, randomness
- Use Jest to verify no imports match forbidden patterns

**G15 — Domain Logic Is Adapter-Agnostic** (`tests/golden/architecture/domain-adapter-agnostic.test.ts`)

- Static analysis test: scan `core-domain/` for adapter-specific assumptions
- Check for SQLite-specific or Postgres-specific code
- Verify no database-specific types or logic in core-domain

### 5. Create Placeholder Tests for Unimplemented Features

**TM Safety Tests (G4-G6):**

- `tests/golden/tm/cross-client-blocked.test.ts` - Placeholder with `test.skip()`
- `tests/golden/tm/ad-hoc-no-pollution.test.ts` - Placeholder with `test.skip()`
- `tests/golden/tm/tm-entries-immutable.test.ts` - Placeholder with `test.skip()`

**TM Query Tests (G7-G8):**

- `tests/golden/tm-query/same-query-same-result.test.ts` - Placeholder with `test.skip()`
- `tests/golden/tm-query/match-provenance-explainable.test.ts` - Placeholder with `test.skip()`

**Diff Engine Tests (G9-G11):**

- `tests/golden/diff/explains-what-changed.test.ts` - Placeholder with `test.skip()`
- `tests/golden/diff/no-invented-reasons.test.ts` - Placeholder with `test.skip()`
- `tests/golden/diff/tm-driven-distinguishable.test.ts` - Placeholder with `test.skip()`

**Meta Test (G16):**

- `tests/golden/meta/explainability.test.ts` - Placeholder with `test.skip()`

**Each placeholder should:**

- Include the full test scenario from the golden test document
- Use `test.skip()` to mark as pending
- Add a `TODO` comment referencing the feature that needs to be implemented
- Include expected test structure (Given/When/Then) as comments

### 6. Test Utilities and Helpers

**Files to create:**

- `tests/helpers/test-fixtures.ts` - Factory functions for creating test data (ProjectState, VersionedState, etc.)
- `tests/helpers/assertions.ts` - Custom assertion helpers for domain-specific checks
- `tests/helpers/state-equality.ts` - Deep equality utilities for ProjectState comparison

## Key Files to Reference

- `core-domain/state/project-state.ts` - `applyTranslationChange` function
- `core-domain/history/versioning.ts` - `commitSnapshot`, `rollbackToSnapshot`, `VersionedState`
- `core-domain/state/domain-entities.ts` - Domain types (Project, Segment, SnapshotId, etc.)
- `adapters/integrity/verify-snapshot-integrity.ts` - Integrity verification logic
- `tests/all-golden-tests.md` - Source of truth for all test requirements

## Testing Strategy

1. **Golden tests run first**: These tests must pass before any other tests
2. **Fail fast**: If a golden test fails, the change is rejected unless the test is explicitly revised
3. **Deterministic**: All tests must be deterministic (no randomness, no time-dependent behavior)