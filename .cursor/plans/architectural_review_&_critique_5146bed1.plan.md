---
name: Architectural Review & Critique
overview: Comprehensive architectural review identifying domain impurities, hidden mutations, premature optimizations, solid foundations, fragile areas, and explicit "do not build" constraints to prevent architectural erosion.
todos: []
---

# Ar

chitectural Review: Catty Trans Codebase

## Executive Summary

The codebase demonstrates **strong architectural discipline** with a pure `core-domain` and comprehensive test coverage. However, there are **structural gaps** (missing planned modules) and **potential performance bottlenecks** that could become architectural debt if not addressed proactively.---

## 1. Domain Impurity Analysis

### ✅ **No Impurities Found**

**Findings:**

- `core-domain` contains **zero** imports from adapters, UI, or runtime layers
- **Zero** filesystem, database, network, or timer dependencies in `core-domain`
- Architecture tests (`core-domain-no-io.test.ts`) actively prevent boundary violations
- All state transitions are pure functions with no side effects

**Evidence:**

- `grep` search found no forbidden imports in `core-domain/`
- All core-domain files use only TypeScript standard library
- `checksum-utils.ts` correctly lives in `adapters/integrity/`, not `core-domain`

**Verdict:** ✅ **ARCHITECTURALLY SOUND** — Domain boundary is well-enforced.---

## 2. Hidden Mutation Analysis

### ✅ **No Hidden Mutations Found**

**Findings:**

- All state transitions return **new objects** using spread operators
- `applyTranslationChange()` creates new arrays via `.map()` and spread syntax
- `commitSnapshot()` and `rollbackToSnapshot()` build new `Map` instances
- Golden test `no-state-mutation.test.ts` verifies immutability with reference equality checks

**Evidence:**

```75:159:core-domain/state/project-state.ts
export function applyTranslationChange(
  previous: ProjectState,
  change: TranslationChange,
): ProjectState {
  // ... validation guards ...
  
  // Returns new ProjectState object
  return {
    ...previous,
    targetSegments: updatedTargetSegments, // new array
  };
}
```

**Potential Concern:**

- `areStatesEqual()` in `versioning.ts` performs **deep structural comparison** which is O(n) for large states. This is acceptable for current scale but could become a bottleneck with 10K+ segment projects.

**Verdict:** ✅ **ARCHITECTURALLY SOUND** — Immutability is correctly implemented and tested.---

## 3. Premature Optimization Analysis

### ⚠️ **One Potential Premature Optimization**

**Finding:**

- `findMatchingSnapshot()` in `versioning.ts` performs **linear search** through all snapshots (O(n) where n = snapshot count)
- Comment acknowledges this: *"for production, consider a more efficient equality function if performance becomes a concern"*

**Assessment:**

- **NOT premature** — This is a reasonable implementation with explicit acknowledgment of future optimization needs
- Linear search is acceptable for <100 snapshots (typical solo translator workflow)
- Optimization should be deferred until performance data shows it's needed

**Verdict:** ✅ **ACCEPTABLE** — No premature optimizations found. The note is appropriate technical debt documentation.---

## 4. What Is Solid

### ✅ **Core Architecture**

1. **Pure Domain Core**

- Zero side effects in `core-domain`
- All functions are deterministic
- Clear separation between domain and infrastructure

2. **Immutability Guarantees**

- State transitions never mutate inputs
- Comprehensive test coverage (`no-state-mutation.test.ts`, `rollback-exact.test.ts`)
- Reference equality checks prevent accidental mutations

3. **Architectural Guardrails**

- Golden tests prevent IO in `core-domain` (`core-domain-no-io.test.ts`)
- Tests prevent forbidden imports (`domain-adapter-agnostic.test.ts`)
- Automated enforcement of architectural rules

4. **Data Integrity**

- Checksum verification in adapters
- Domain invariant validation in `loadProjectState()`
- Explicit error handling (returns `null` on corruption, never partial data)

5. **Versioning System**

- Branching support for conflicting histories
- Exact rollback (not approximate)
- History graph preserved during rollback

### ✅ **Code Quality**

- Clear business intent comments (explain *why*, not *what*)
- Branded types prevent ID mix-ups (`ProjectId`, `SegmentId`, etc.)
- Comprehensive error handling in adapters

---

## 5. What Is Fragile

### ⚠️ **Structural Gaps**

1. **Missing Core Modules**

- README lists `/core-domain/tm`, `/core-domain/diff`, `/core-domain/guards` as planned
- **None of these exist yet**
- Risk: Future implementations may violate architectural boundaries if built without clear guidance

2. **Performance Scalability**

- `areStatesEqual()` does O(n) deep comparison — could be slow for 10K+ segment projects
- `findMatchingSnapshot()` does O(n) linear search — could be slow for 100+ snapshots
- **Not critical now**, but should be monitored as project size grows

3. **Documentation-Implementation Drift**

- `tech-decomposition.md` describes extensive services (TMService, QAService, DiffService) that don't exist
- Risk: New developers may implement features in wrong layers based on outdated docs

### ⚠️ **Potential Architectural Risks**

1. **No TM Module Yet**

- Translation Memory is core domain logic but doesn't exist
- When built, must remain pure (no DB access, no FTS5 queries in `core-domain`)
- Risk: Pressure to "just query SQLite directly" could erode boundaries

2. **No Diff Module Yet**

- Change detection is domain logic but doesn't exist
- When built, must be pure (compare two `ProjectState` objects, return diff structure)
- Risk: Temptation to add file I/O for diff export could leak into domain

3. **No Guards Module Yet**

- Business rule validation is domain logic but doesn't exist
- When built, must be pure (validate `ProjectState`, return validation results)
- Risk: QA rules might be implemented as adapters instead of domain logic

---

## 6. What Must NOT Be Built Next

### 🚫 **Explicit Constraints**

1. **DO NOT add any IO to `core-domain`**

- No filesystem access (even for "convenience" utilities)
- No database queries (even "read-only" lookups)
- No network calls (even "optional" features)
- No timers or randomness (even for "testing")

2. **DO NOT import adapters from `core-domain`**

- Even if it "makes sense" to reuse checksum logic
- Even if it "saves code duplication"
- **Solution:** Duplicate pure logic in `core-domain` if needed, or pass values from adapters

3. **DO NOT optimize `areStatesEqual()` or `findMatchingSnapshot()` yet**

- Wait for performance data showing actual bottlenecks
- Premature optimization could introduce complexity or bugs
- **Exception:** If building TM/diff modules requires these, optimize as part of that work

4. **DO NOT build TM/Diff/Guards as adapters**

- These are **domain logic** and must live in `core-domain`
- TM lookup algorithms, diff computation, and business rule validation are pure functions
- **Correct pattern:** Pure functions in `core-domain`, adapters only handle persistence/IO

5. **DO NOT add caching to `core-domain`**

- Caching is a side effect (mutates state)
- **Correct pattern:** Cache in adapters or application services layer
- Domain functions remain pure and cacheable by callers

6. **DO NOT add "convenience" functions that hide side effects**

- Example: `createSnapshotWithAutoId()` that generates IDs
- **Correct pattern:** Callers provide IDs; domain functions remain pure

7. **DO NOT implement performance optimizations from `tech-decomposition.md` yet**

- Worker threads, LRU caches, parallel processing belong in adapters/services
- Wait until TM/Diff modules exist and show performance needs
- **Exception:** SQLite PRAGMA settings in adapters are fine (infrastructure, not domain)

---

## 7. Recommended Corrections

### 🔧 **Immediate Actions**

1. **Update README to reflect current state**

- Mark `/core-domain/tm`, `/core-domain/diff`, `/core-domain/guards` as "planned" or "not yet implemented"
- Add note: "These modules must remain pure (no IO, no adapters)"

2. **Add architectural decision record (ADR)**

- Document why `areStatesEqual()` uses deep comparison
- Document when to optimize (performance data threshold)
- Document that TM/Diff/Guards must be pure domain logic

3. **Create placeholder modules with interfaces**

- Add `/core-domain/tm/tm-types.ts` with pure type definitions
- Add `/core-domain/diff/diff-types.ts` with pure type definitions
- Add `/core-domain/guards/guard-types.ts` with pure type definitions
- This establishes the boundary before implementation

### 🔧 **Before Building TM/Diff/Guards**

1. **Define pure function signatures first**

- Example: `lookupTM(sourceText: string, tmEntries: ReadonlyArray<TMEntry>): TMMatch[]`
- No database parameter, no async, no side effects
- Adapters will load TM entries from DB, pass to domain function

2. **Add golden tests before implementation**

- Test that TM module has no IO
- Test that diff module has no IO
- Test that guards module has no IO
- Prevents accidental boundary violations during implementation

3. **Document the adapter-domain boundary**

- Clear examples: "TM lookup algorithm = domain, SQLite FTS5 query = adapter"
- Clear examples: "Diff computation = domain, HTML export = adapter"

---

## 8. Explicit Risks

### ⚠️ **High Risk**

1. **Documentation Drift**

- `tech-decomposition.md` describes services that don't exist
- New developers may implement features in wrong layers
- **Mitigation:** Update docs or add "NOT YET IMPLEMENTED" markers

2. **Missing Modules Create Pressure**

- When building TM, there will be pressure to "just query SQLite directly"
- When building Diff, there will be pressure to "just write files directly"
- **Mitigation:** Define pure interfaces first, add golden tests, then implement

### ⚠️ **Medium Risk**

1. **Performance Bottlenecks (Future)**

- `areStatesEqual()` could become slow for large projects
- `findMatchingSnapshot()` could become slow for long histories
- **Mitigation:** Monitor performance, optimize when data shows need

2. **Incomplete Test Coverage**

- Golden tests exist for immutability and IO boundaries
- But no tests for TM/Diff/Guards modules (they don't exist yet)
- **Mitigation:** Add tests before implementing these modules

### ⚠️ **Low Risk**

1. **Type Safety**

- Branded types prevent ID mix-ups
- But no runtime validation (TypeScript only)
- **Mitigation:** Acceptable for now; add runtime validation if bugs appear

---

## 9. Summary

### ✅ **Strengths**

- Pure domain core with zero impurities
- Immutability correctly implemented and tested
- Architectural guardrails prevent boundary violations
- Clear separation of concerns

### ⚠️ **Weaknesses**

- Missing planned modules (TM, Diff, Guards)
- Documentation describes non-existent features
- Potential performance bottlenecks (not critical yet)

### 🚫 **Constraints**

- **DO NOT** add IO to `core-domain`
- **DO NOT** import adapters from `core-domain`
- **DO NOT** build TM/Diff/Guards as adapters
- **DO NOT** optimize prematurely

### 📋 **Next Steps**

1. Update README to reflect current state