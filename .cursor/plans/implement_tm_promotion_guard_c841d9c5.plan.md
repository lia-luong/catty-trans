---
name: Implement TM Promotion Guard
overview: Implement `canPromoteSegment` function with promotion rules to prevent accidental TM pollution. The function will enforce cross-client isolation, ad-hoc project restrictions, and snapshotId validation.
todos:
  - id: types
    content: Define PromotionDecision and PromotionContext types
    status: completed
  - id: function
    content: Implement canPromoteSegment pure function with all validation rules
    status: completed
    dependencies:
      - types
  - id: scenarios
    content: Document 3 real-world failure scenarios in code comments
    status: completed
    dependencies:
      - function
---

# Implement TM Promotion Guard

## Overview

Create a pure function `canPromoteSegment` in [`core-domain/tm/promotion-guard.ts`](core-domain/tm/promotion-guard.ts) that implements promotion rules to prevent accidental TM pollution. This guards against cross-client contamination, ad-hoc project pollution, and ensures all promotions reference valid snapshots.

## Types

### `PromotionDecision`

```typescript
export type PromotionDecision = {
  readonly allowed: boolean;
  readonly reason: string;
  readonly requiresExplicitOverride: boolean;
};
```



### `PromotionContext`

```typescript
export type PromotionContext = {
  readonly project: Project;
  readonly snapshotId: SnapshotId;
  readonly sourceSegment: Segment;
  readonly isAdHoc: boolean;
  readonly targetClientId?: ClientId;  // Optional: for cross-client validation
};
```



### Function Signature

```typescript
canPromoteSegment(targetSegment: TargetSegment, context: PromotionContext): PromotionDecision
```



## Promotion Rules (Priority Order)

| # | Rule | Check | allowed | requiresExplicitOverride ||---|------|-------|---------|--------------------------|| 1 | Valid snapshotId | `snapshotId` non-empty | false | false || 2 | Project not archived | `project.status !== 'archived'` | false | false || 3 | Non-empty translation | `translatedText.trim().length > 0` | false | false || 4 | Segment belongs to project | `targetSegment.projectId === context.project.id` | false | false || 5 | Cross-client blocked | If `targetClientId` provided, must match `project.clientId` | false | false || 6 | Ad-hoc blocked | `isAdHoc === true` | false | **true** |Draft segments (`status: 'draft'`) ARE allowed for promotion (status doesn't affect eligibility).

## Failure Scenarios (Documented in Code)

### Scenario 1: Cross-Client Promotion Attempt

- **Situation**: Translator promotes segment from Client A project, but `targetClientId` is Client B
- **Blocked**: `allowed: false`, `requiresExplicitOverride: false`
- **Reason**: "Cross-client promotion blocked: segment belongs to client [A] but target TM belongs to client [B]. This prevents IP contamination."

### Scenario 2: Ad-Hoc Rush Job

- **Situation**: Late-night rush job marked `isAdHoc: true`, translator clicks "promote to TM"
- **Blocked**: `allowed: false`, `requiresExplicitOverride: true`
- **Reason**: "Ad-hoc projects do not promote to TM by default to prevent pollution. Explicit override required."

### Scenario 3: Missing SnapshotId

- **Situation**: Promotion attempted with empty/missing snapshotId
- **Blocked**: `allowed: false`, `requiresExplicitOverride: false`
- **Reason**: "Promotion requires valid snapshotId for provenance tracking."

## Implementation Notes

- **Pure function**: No side effects, no I/O, deterministic