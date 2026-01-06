---
name: Diff Limits and Degradation
overview: ""
todos:
  - id: create-diff-limits
    content: Create core-domain/diff/diff-limits.ts with thresholds and DiffCompleteness
    status: completed
  - id: update-diff-result
    content: Update DiffResult in diff-types.ts with completeness fields
    status: completed
---

# Diff Limits and Degradation

## Overview

Define explicit performance thresholds for diff computation and a degradation model that fails loudly and honestly when limits are exceeded. Partial diffs are always labelled with explanations — silent truncation is forbidden.---

## Threshold Constants

Define in [`core-domain/diff/diff-limits.ts`](core-domain/diff/diff-limits.ts):| Constant | Value | Rationale ||----------|-------|-----------|| `MAX_SEGMENTS_PER_DIFF` | 10,000 | Reasonable upper bound for a single project; beyond this, diff becomes unwieldy for human review || `MAX_CHANGES_RETURNED` | 5,000 | Prevents memory bloat; forces pagination for very large changesets || `WARN_SEGMENTS_THRESHOLD` | 5,000 | Triggers warning flag before hard limit; gives user early notice |---

## Degradation Behaviour

### `DiffCompleteness` Type

Discriminated union describing diff state:

```typescript
type DiffCompleteness =
  | { readonly status: 'complete' }
  | { readonly status: 'partial'; readonly truncatedAt: number; readonly reason: string }
  | { readonly status: 'refused'; readonly reason: string };
```

| Status | Meaning | User Experience ||--------|---------|-----------------|| `'complete'` | All changes computed | Normal diff view || `'partial'` | Diff truncated at limit | Banner: "Showing first N of M changes. [reason]" || `'refused'` | Diff not attempted | Error: "Project too large for diff. [reason]" |

### Rules

1. **Never silently truncate** — if changes exceed `MAX_CHANGES_RETURNED`, status is `'partial'` with `truncatedAt` count
2. **Refuse gracefully** — if segment count exceeds `MAX_SEGMENTS_PER_DIFF`, status is `'refused'` with explanation
3. **Warn early** — if segment count exceeds `WARN_SEGMENTS_THRESHOLD`, include warning in result metadata

---

## Updated `DiffResult` Type

Extend existing `DiffResult` in [`diff-types.ts`](core-domain/diff/diff-types.ts):

```typescript
export type DiffResult = {
  readonly fromSnapshotId: SnapshotId;
  readonly toSnapshotId: SnapshotId;
  readonly changes: ReadonlyArray<DiffUnit>;
  readonly summary: DiffSummary;
  
  // New: completeness status with explanation
  readonly completeness: DiffCompleteness;
  
  // New: total count before truncation (for partial diffs)
  readonly totalChangesBeforeTruncation?: number;
};
```

---

## What Users See

| Scenario | UI Message ||----------|------------|| Complete diff | (no banner) || Partial diff | "Showing 5,000 of 8,234 changes. Results truncated to preserve performance." || Refused diff | "This project has 15,000 segments, exceeding the 10,000 segment limit for diff computation. Consider comparing smaller snapshots." || Warning threshold | "Large project: 6,500 segments. Diff may be slow." |---

## Why This Preserves Trust

1. **Transparency**: Users always know if they're seeing incomplete data
2. **No silent failures**: A partial diff is explicitly labelled, not quietly truncated
3. **Actionable feedback**: Refused diffs explain why and suggest alternatives
4. **Predictable behaviour**: Same inputs always produce same completeness status
5. **Audit trail**: `totalChangesBeforeTruncation` enables users to understand scope

---

## Implementation

### File: [`core-domain/diff/diff-limits.ts`](core-domain/diff/diff-limits.ts)

1. Define threshold constants
2. Define `DiffCompleteness` type
3. Export pure helper: `checkDiffFeasibility(segmentCount) → DiffCompleteness`