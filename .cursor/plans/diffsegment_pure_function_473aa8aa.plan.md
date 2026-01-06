---
name: diffSegment Pure Function
overview: ""
todos:
  - id: create-diff-segment
    content: Create core-domain/diff/diff-segment.ts with diffSegment function
    status: completed
---

# diffSegment Pure Function (Explainability First)

## Overview

Implement a pure `diffSegment` function that compares two segment states and returns a `SegmentDiff` explaining what changed and why. The function detects content changes and TM-driven insertions only when provenance evidence exists.---

## Input Types

### New Type: `SegmentDiffInput`

Extends segment state with optional TM provenance. Defined in [`core-domain/diff/diff-segment.ts`](core-domain/diff/diff-segment.ts):

```typescript
// Input for diff computation, extending SegmentState with optional provenance
export type SegmentDiffInput = SegmentState & {
  // If this state resulted from accepting a TM match, reference the entry
  readonly tmProvenance?: {
    readonly projectId: ProjectId;
    readonly snapshotId: SnapshotId;
  };
};
```

---

## Function Signature

```typescript
function diffSegment(
  segmentId: SegmentId,
  sourceText: string,
  before: SegmentDiffInput | undefined,
  after: SegmentDiffInput | undefined,
): SegmentDiff
```

---

## Detection Rules

| Scenario | `changeType` | `cause` ||----------|--------------|---------|| `before === undefined`, `after` exists | `'created'` | Check `after.tmProvenance` || `after === undefined`, `before` exists | `'deleted'` | `'unknown'` (deletions have no TM cause) || Both exist, content identical | `'unchanged'` | `'unknown'` || Both exist, content differs, `after.tmProvenance` exists | `'modified'` | `'tm_insert'` || Both exist, content differs, no provenance | `'modified'` | `'unknown'` |**Critical rule**: Cause is `'unknown'` unless explicit TM provenance exists on the `after` state. Never infer.---

## Dispute Scenario

**Situation**: Client claims translator used wrong terminology. Translator says they followed TM guidance.**Resolution via diff**:

```typescript
const diff = diffSegment(
  segmentId,
  'The product is ready.',
  { translatedText: '', status: 'draft', targetLanguage: 'fr-FR' },
  { 
    translatedText: 'Le produit est prêt.',
    status: 'translated',
    targetLanguage: 'fr-FR',
    tmProvenance: { projectId, snapshotId }  // Evidence exists
  }
);

// Result:
// diff.cause === 'tm_insert'
// diff.after.translatedText === 'Le produit est prêt.'
```

The diff proves the translation came from TM (cause: `'tm_insert'`), not manual typing. The translator can reference the `snapshotId` to show what TM entry was available at translation time.If no `tmProvenance` existed, `cause` would be `'unknown'` — the diff refuses to guess, protecting both parties.---

## Implementation

### File: [`core-domain/diff/diff-segment.ts`](core-domain/diff/diff-segment.ts)

1. Define `SegmentDiffInput` type
2. Implement `diffSegment` as pure function
3. Export types and function
4. No imports from adapters/UI/runtime

### Determinism Guarantees