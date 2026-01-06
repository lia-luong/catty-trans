---
name: TM-Diff Provenance Integration
overview: ""
todos:
  - id: add-tm-attribution-type
    content: Add TMAttribution type and extend SegmentDiff in diff-types.ts
    status: completed
  - id: update-diff-segment
    content: Update diffSegment to populate tmAttribution when cause is tm_insert
    status: completed
---

# TM ↔ Diff Provenance Integration

## Overview

Extend `SegmentDiff` to expose TM provenance in diff output, making TM influence visible and defensible. When a change was caused by accepting a TM match, the diff includes full attribution to the source project and snapshot.---

## Current State

- `SegmentDiffInput` (in `diff-segment.ts`) accepts optional `tmProvenance` on input
- `SegmentDiff` (in `diff-types.ts`) has `cause: ChangeCause` but no attribution details
- When `cause === 'tm_insert'`, users cannot see *which* TM entry was used

**Gap**: The diff says "TM-driven" but doesn't say "from which project/snapshot".---

## Proposed Changes

### New Type: `TMAttribution`

Captures the provenance of a TM-driven change in diff output:

```typescript
export type TMAttribution = {
  // The project that contributed the TM entry.
  readonly sourceProjectId: ProjectId;
  
  // The snapshot the TM entry came from.
  readonly sourceSnapshotId: SnapshotId;
};
```



### Extended `SegmentDiff`

Add optional `tmAttribution` field:

```typescript
export type SegmentDiff = {
  // ... existing fields ...
  
  // TM attribution when cause is 'tm_insert'.
  // Present only when cause === 'tm_insert'; undefined otherwise.
  // Enables accountability: translator can prove which TM entry was used.
  readonly tmAttribution?: TMAttribution;
};
```

---

## Attribution Rules

| Scenario | `cause` | `tmAttribution` ||----------|---------|-----------------|| TM match accepted | `'tm_insert'` | `{ sourceProjectId, sourceSnapshotId }` || Manual edit | `'unknown'` | `undefined` || No provenance available | `'unknown'` | `undefined` || Deletion | `'unknown'` | `undefined` |**Critical rule**: `tmAttribution` is present if and only if `cause === 'tm_insert'`. Never populate attribution without evidence.---

## How This Supports Accountability

### Dispute Scenario

**Client**: "You used the wrong terminology in segment 42."**Translator's defence** (using diff):

1. Pull diff for segment 42
2. Diff shows: `cause: 'tm_insert'`, `tmAttribution: { sourceProjectId: 'project-2023', sourceSnapshotId: 'approved-final' }`
3. Translator proves: "I accepted a TM match from your approved project 'project-2023', snapshot 'approved-final'. The terminology came from your own previously approved work."

### Audit Trail

The attribution path is:

```javascript
SegmentDiff.tmAttribution.sourceSnapshotId
    → Snapshot (immutable)
    → TMEntry (with full provenance)
    → Original translation (approved by client)
```

---

## Implementation

### File: [`core-domain/diff/diff-types.ts`](core-domain/diff/diff-types.ts)

1. Import `ProjectId` from domain-entities
2. Add `TMAttribution` type
3. Extend `SegmentDiff` with optional `tmAttribution` field

### File: [`core-domain/diff/diff-segment.ts`](core-domain/diff/diff-segment.ts)

1. Import `TMAttribution` from diff-types
2. Update `diffSegment` to populate `tmAttribution` when `cause === 'tm_insert'`

---