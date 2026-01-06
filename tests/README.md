# Test Suite — Catty Trans

This document catalogues all tests and shared helpers for the Catty Trans project.

## Running Tests

```bash
# Run all tests
npm test

# Run golden tests only
npm test -- --testPathPattern="golden"

# Run specific suite (e.g. diff tests)
npm test -- --testPathPattern="diff"

# Run with coverage
npm test -- --coverage
```

---

## Directory Structure

```text
tests/
├── golden/                    # Golden tests (invariants that must never break)
│   ├── architecture/          # Core-domain purity (G1–G5) ✅ COMPLETE
│   ├── core-domain/           # Immutability, rollback, snapshots (G6–G8) ✅ COMPLETE
│   ├── diff/                  # Explainability, limits, TM distinction (G9–G12) ✅ COMPLETE
│   ├── failure/               # Graceful degradation (G12–G13) ✅ COMPLETE
│   ├── meta/                  # System-level explainability ✅ COMPLETE
│   ├── tm/                    # TM isolation, immutability (G14–G16) ✅ COMPLETE
│   │   └── tm-duplicate-handling.test.ts  # TM batch duplicate handling (G11) ✅ NEW
│   └── tm-query/              # Query determinism, provenance (G17–G18) ✅ COMPLETE
├── adapters/                  # Adapter functionality tests ✅ NEW SECTION
│   └── sqlite-tm-batch.test.ts           # Batch TM insert tests (12 cases) ✅ NEW
├── helpers/                   # Shared test utilities ✅ COMPLETE
│   ├── assertions.ts          # Custom Jest matchers
│   ├── state-equality.ts      # State comparison utilities
│   └── test-fixtures.ts       # Fixture factories (extended for batch operations)
└── README.md                  # This file
```

---

## Golden Tests

Golden tests define invariants that must never break. They are numbered for reference in documentation and organised by domain concern.

### Architecture (G1–G5)

Ensures `core-domain` remains pure and adapter-agnostic.

| File | Purpose |
|------|---------|
| `core-domain-no-io.test.ts` | Verifies core-domain has no I/O imports |
| `diff-module-pure.test.ts` | Ensures diff module is pure |
| `domain-adapter-agnostic.test.ts` | Confirms domain has no adapter dependencies |
| `guards-module-pure.test.ts` | Ensures guards module is pure |
| `tm-module-pure.test.ts` | Ensures TM module is pure |

### Core Domain (G6–G8)

Validates immutability, rollback, and snapshot behaviour.

| File | Purpose |
|------|---------|
| `no-state-mutation.test.ts` | State transitions never mutate existing objects |
| `rollback-exact.test.ts` | Rollback restores exact previous state |
| `snapshot-immutability.test.ts` | Snapshots are immutable once created |

### Diff (G9–G12)

Ensures diff explains what changed, never invents reasons, and handles limits.

| File | Purpose |
|------|---------|
| `explains-what-changed.test.ts` | Diff includes before/after values and change category |
| `no-invented-reasons.test.ts` | Diff never guesses TM involvement without evidence; includes `explainChangeCause` tests ✅ Extended |
| `tm-driven-distinguishable.test.ts` | TM-driven changes are explicitly marked |
| `manual-edit-vs-tm-insert.test.ts` | Manual edits vs TM inserts are distinguishable |
| `diff-limits-stress.test.ts` | Stress test for large segment sets and degradation |

### Failure Handling (G12–G13)

Validates graceful degradation and explicit failure states.

| File | Purpose |
|------|---------|
| `corrupted-artefact-blocks.test.ts` | Corrupted data is detected and reported |
| `partial-diff-labelled.test.ts` | Partial diffs are explicitly labelled, never silent |

### Meta (Explainability)

Ensures all domain decisions are explainable to users.

| File | Purpose |
|------|---------|
| `explainability.test.ts` | Domain operations provide human-readable explanations |

### Translation Memory (G14–G16)

Validates TM isolation, immutability, and ad-hoc handling.

| File | Purpose |
|------|---------|
| `ad-hoc-no-pollution.test.ts` | Ad-hoc translations don't pollute TM |
| `cross-client-blocked.test.ts` | Cross-client TM access is blocked |
| `tm-entries-immutable.test.ts` | TM entries are immutable once created |
| `tm-duplicate-handling.test.ts` | TM duplicate handling with batch operations (G11) ✅ NEW |

### TM Query (G17–G18)

Ensures TM queries are deterministic and explainable.

| File | Purpose |
|------|---------|
| `match-provenance-explainable.test.ts` | TM matches include provenance explanation |
| `same-query-same-result.test.ts` | Same query + same TM state = same result |

### Adapter Tests ✅ NEW

Tests for adapter functionality and integration.

| File | Purpose |
|------|---------|
| `adapters/sqlite-tm-batch.test.ts` | Batch TM insert: partial success, error categorization, realistic workflows (12 cases) ✅ NEW |

---

## Test Helpers

Shared utilities in `helpers/` reduce boilerplate and ensure consistency.

### `test-fixtures.ts`

Factory functions for creating valid domain entities:

```typescript
import { makeProject, makeSegment, makeTargetSegment, makeProjectState } from './helpers/test-fixtures';

const project = makeProject({ name: 'My Project' });
const segment = makeSegment(project, { sourceText: 'Hello' });
const state = makeProjectState({ project, segments: [segment] });
```

Available factories:
- `makeProject(overrides?)` — Creates a valid `Project`
- `makeSegment(project, overrides?)` — Creates a valid `Segment`
- `makeTargetSegment(project, segment, overrides?)` — Creates a valid `TargetSegment`
- `makeProjectState(options?)` — Creates a valid `ProjectState`
- `makeTranslationChange(options)` — Creates a valid `TranslationChange`
- `makeEmptyHistoryGraph()` — Creates an empty `HistoryGraph`
- `makeVersionedState(state?, history?)` — Creates a `VersionedState`
- `makePromotionContext(project, segment, overrides?)` — Creates a `PromotionContext` ✅ Extended with `existingSourceTexts` for batch operations
- `makeTMEntry(overrides?)` — Creates a valid `TMEntry` ✅ NEW for batch testing

### `state-equality.ts`

Utilities for comparing domain states in tests.

### `assertions.ts`

Custom Jest matchers for domain-specific assertions.

---

## Writing New Tests

### Golden Test Conventions

1. **File naming**: `kebab-case.test.ts`
2. **Describe block**: Include golden test number (e.g. `G12 — Partial Diff Is Labelled`)
3. **Comments**: Explain business intent, not syntax
4. **Given/When/Then**: Structure tests with clear phases
5. **No mocks**: Golden tests use real domain functions

### Example Structure

```typescript
/**
 * G99 — Example Golden Test
 *
 * Validates that [invariant description].
 *
 * Scenario: [when this happens]
 */

import { someDomainFunction } from '../../../core-domain/module';

describe('G99 — Example Golden Test', () => {
  it('should [expected behaviour]', () => {
    // Given: [setup]
    const input = createTestInput();

    // When: [action]
    const result = someDomainFunction(input);

    // Then: [assertions]
    expect(result).toBe(expected);
  });
});
```

---

## Test Philosophy

1. **Golden tests are contracts** — They define behaviour that must never change
2. **Fail loudly** — Tests should fail clearly when invariants are violated
3. **No silent truncation** — Partial results must always be labelled
4. **Determinism** — Same inputs must always produce same outputs
5. **Explainability** — All domain decisions must be human-readable

---

## Test Coverage Summary

**Status:** ✅ All critical paths tested and passing

- **Golden Tests:** 40+ tests covering all domain invariants
- **Adapter Tests:** Comprehensive coverage for SQLite and TM batch operations
- **Test Fixtures:** Factory functions for all major domain entities
- **Pre-UI Mitigations:** Tests for P0 (Safety), P1 (UX), P2 (Scaling) complete

**Blocking Coverage:**
- ✅ Core-domain purity: No I/O, side effects verified absent
- ✅ State immutability: All transitions verified non-mutating
- ✅ Rollback correctness: Exact state restoration validated
- ✅ TM isolation: Client boundaries enforced across 4 test suites
- ✅ Diff explainability: All causation decisions tested
- ✅ Error handling: Corruption detection and graceful degradation verified
- ✅ Batch operations: TM batch insert with 12 comprehensive scenarios

**All tests ready for UI development phase.**
