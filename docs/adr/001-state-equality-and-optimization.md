# ADR-001: State Equality and Performance Optimization Strategy

**Status**: Accepted  
**Date**: 2025-01-06  
**Context**: Architectural review identified potential performance bottlenecks in state comparison functions

## Context

The versioning system uses `areStatesEqual()` to perform deep structural comparison of `ProjectState` objects when finding matching snapshots. This function is called by `findMatchingSnapshot()`, which performs a linear search through all snapshots.

### Current Implementation

- `areStatesEqual()` performs O(n) deep comparison where n = number of segments + target segments
- `findMatchingSnapshot()` performs O(m) linear search where m = number of snapshots
- Combined complexity: O(n × m) for worst-case scenario

### Performance Characteristics

- **Current scale**: Acceptable for <100 snapshots and <1K segments
- **Future scale**: Could become bottleneck with 10K+ segments or 100+ snapshots
- **Typical workflow**: Solo translators typically have <50 snapshots and <5K segments per project

## Decision

**Defer optimization until performance data shows actual bottlenecks.**

### Rationale

1. **Premature optimization risk**: Optimizing without data could introduce complexity or bugs
2. **Current performance acceptable**: No user complaints or performance issues reported
3. **Optimization complexity**: Efficient state comparison requires careful design (hashing, memoization, or structural indexing)
4. **YAGNI principle**: Don't optimize until there's a proven need

### When to Optimize

Optimize `areStatesEqual()` and `findMatchingSnapshot()` when:

- **Performance data shows**: >100ms latency for snapshot operations on typical projects
- **User feedback indicates**: Noticeable slowdown during rollback or snapshot creation
- **Benchmarking reveals**: Actual bottleneck in profiling data (not assumed)

### Optimization Strategies (Future)

If optimization becomes necessary, consider:

1. **Structural hashing**: Compute hash of state structure on snapshot creation, compare hashes instead of deep equality
2. **Indexed lookup**: Maintain index of state hashes → snapshot IDs for O(1) lookup
3. **Memoization**: Cache equality results for recently compared states
4. **Shallow comparison first**: Compare project ID and segment counts before deep comparison

**Important**: Any optimization must preserve immutability guarantees and remain pure (no side effects).

## Consequences

### Positive

- Simpler codebase without premature complexity
- Easier to maintain and understand
- No risk of optimization bugs affecting correctness

### Negative

- Potential future performance issues if project scale grows unexpectedly
- May need refactoring if optimization becomes necessary

### Mitigation

- Monitor performance metrics in production
- Add performance tests if/when optimization is implemented
- Document optimization strategy for future developers

---

# ADR-002: TM/Diff/Guards Modules Must Remain Pure

**Status**: Accepted  
**Date**: 2025-01-06  
**Context**: Planned modules (`/tm`, `/diff`, `/guards`) must be implemented as pure domain logic

## Context

The codebase architecture requires `core-domain` to remain pure (no IO, no side effects). Three planned modules need to be implemented:

- `/core-domain/tm`: Translation Memory lookup algorithms
- `/core-domain/diff`: Change detection and diff computation
- `/core-domain/guards`: Business rule validation

## Decision

**All three modules must be implemented as pure functions in `core-domain` with zero side effects.**

### Pure Function Signatures

#### TM Module
```typescript
// Pure function: takes TM entries as input, returns matches
function lookupTM(
  sourceText: string,
  tmEntries: ReadonlyArray<TMEntry>
): TMMatch[]

// NOT: function lookupTM(db: Database, sourceText: string): Promise<TMMatch[]>
```

#### Diff Module
```typescript
// Pure function: compares two states, returns diff structure
function computeDiff(
  fromState: ProjectState,
  toState: ProjectState
): DiffResult

// NOT: function computeDiff(fromSnapshotId: string, toSnapshotId: string): Promise<DiffResult>
```

#### Guards Module
```typescript
// Pure function: validates state against rules, returns findings
function validateProjectState(
  state: ProjectState,
  rules: ReadonlyArray<ValidationRule>
): ValidationFinding[]

// NOT: function validateProjectState(projectId: string): Promise<ValidationFinding[]>
```

### Adapter-Domain Boundary

**Domain (pure functions):**

- TM lookup algorithms (exact match, fuzzy match, scoring)
- Diff computation (structural comparison, change detection)
- Business rule validation (invariant checks, consistency rules)

**Adapters (side effects):**

- SQLite FTS5 queries for TM search
- Loading snapshots from database
- Persisting validation results
- Exporting diffs to HTML/PDF

### Example: TM Lookup

**Correct pattern:**

```typescript
// core-domain/tm/lookup.ts (pure)
export function lookupTM(
  sourceText: string,
  tmEntries: ReadonlyArray<TMEntry>
): TMMatch[] {
  // Pure algorithm: no DB, no IO, no side effects
  return tmEntries
    .map(entry => computeMatchScore(sourceText, entry))
    .filter(match => match.score >= 70)
    .sort((a, b) => b.score - a.score);
}

// adapters/storage-sqlite/tm-adapter.ts (side effects)
export function loadTMEntries(db: Database, clientId: string): TMEntry[] {
  // Load from database
  const rows = db.all('SELECT * FROM tm_units WHERE client_id = ?', clientId);
  return rows.map(row => deserializeTMEntry(row));
}

// Application service (orchestrates)
export function performTMLookup(db: Database, sourceText: string, clientId: string): TMMatch[] {
  const entries = loadTMEntries(db, clientId); // Adapter: side effect
  return lookupTM(sourceText, entries); // Domain: pure function
}
```

**Incorrect pattern:**
```typescript
// ❌ WRONG: Domain function with side effects
export function lookupTM(db: Database, sourceText: string): Promise<TMMatch[]> {
  const rows = await db.query('SELECT * FROM tm_units ...'); // Side effect in domain!
  // ...
}
```

## Consequences

### Positive

- Maintains architectural purity
- Enables testability (pure functions are easy to test)
- Allows domain logic to be reused in different contexts (testing, different storage backends)

### Negative

- Requires more code (adapters must load data, pass to domain)
- Slightly more complex orchestration in application layer

### Mitigation

- Document adapter-domain boundary with clear examples
- Add golden tests to prevent IO in domain modules
- Create placeholder modules with pure interfaces before implementation

