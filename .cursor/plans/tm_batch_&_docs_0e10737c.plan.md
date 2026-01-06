---
name: TM Batch & Docs
overview: Implement `insertTMEntryBatch` in the SQLite adapter for bulk TM promotion workflows, and add inline "Scaling Limits" documentation to `diff-limits.ts`.
todos:
  - id: batch-insert
    content: Implement insertTMEntryBatch function in sqlite-tm-adapter.ts
    status: completed
  - id: batch-tests
    content: Create tests/adapters/sqlite-tm-batch.test.ts with batch insert tests
    status: completed
    dependencies:
      - batch-insert
  - id: scaling-docs
    content: Add Scaling Limits documentation block to diff-limits.ts
    status: completed
---

# Implement TM Batch Insert and Scaling Documentation

## Task 1: `insertTMEntryBatch` in SQLite Adapter

Add a batch insert function to [`adapters/storage-sqlite/sqlite-tm-adapter.ts`](adapters/storage-sqlite/sqlite-tm-adapter.ts) that handles duplicates gracefully.**Function signature:**

```typescript
export type BatchInsertResult = {
  readonly inserted: readonly TMEntry[];
  readonly skipped: readonly TMEntry[];  // Duplicate constraint violations
  readonly failed: readonly TMEntry[];   // Other errors
};

export function insertTMEntryBatch(
  db: Database,
  entries: readonly TMEntry[],
): BatchInsertResult;
```

**Implementation approach:**

- Iterate entries individually (not batch transaction) to allow partial success
- Catch `PRIMARY KEY constraint` errors per entry and mark as `skipped`
- Catch other errors and mark as `failed`
- Return structured result for UI to display breakdown

**Test file:** Create `tests/adapters/sqlite-tm-batch.test.ts` with cases:

- Batch with all new entries (all inserted)
- Batch with all duplicates (all skipped)
- Mixed batch (some inserted, some skipped)
- Empty batch (returns empty arrays)

---

## Task 2: Scaling Limits Documentation in `diff-limits.ts`

Add a documentation block to [`core-domain/diff/diff-limits.ts`](core-domain/diff/diff-limits.ts) explaining the in-memory architecture constraint.**Location:** After the module-level comment (line 7), before the first constant.**Content:**

```typescript
// ============================================================================
// SCALING LIMITS — ARCHITECTURAL CONSTRAINTS
// ============================================================================
//
// The diff engine operates on in-memory snapshots. Both ProjectState objects
// (from/to) are fully loaded before comparison begins.
//
// Memory footprint estimate at MAX_SEGMENTS_PER_DIFF (10,000 segments):
//   ~18-20 MB peak memory usage
//   Formula: (segmentCount * 2 * ~150 bytes) + (changesCount * ~250 bytes)
//
// IMPORTANT: Raising MAX_SEGMENTS_PER_DIFF beyond 10,000 requires architectural
// changes:
//   1. Streaming/iterator-based diff algorithm
//   2. Cursor-based segment loading from adapter
//   3. Incremental change emission (yield batches)
//
// Estimated effort for streaming refactor: 2-3 weeks
// See: docs/adr/002-state-equality-performance.md
// ============================================================================
```

No code changes required — documentation only.---

## Files Changed