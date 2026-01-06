---
name: Define TM Domain Types with Client Isolation
overview: Replace the existing TMEntry type definition with new types that structurally enforce client isolation and include explicit provenance tracking. Define TMEntry, TMProvenance, and ClientScope types with documented invariants and forbidden states.
todos:
  - id: define-tm-provenance
    content: Define TMProvenance type with projectId, snapshotId, createdAt fields and documented invariants
    status: completed
  - id: define-client-scope
    content: Define ClientScope as branded type wrapping ClientId for structural client isolation
    status: completed
  - id: define-tm-entry
    content: Define TMEntry type with all required fields (sourceText, targetText, clientId, projectId, snapshotId, createdAt) and invariants
    status: completed
    dependencies:
      - define-tm-provenance
      - define-client-scope
  - id: remove-search-logic
    content: Remove lookup function implementations (lookupTM, lookupExactMatch, lookupFuzzyMatches) as they are search logic
    status: completed
  - id: document-invariants
    content: Add comprehensive comments documenting invariants and forbidden states for all three types
    status: completed
    dependencies:
      - define-tm-entry
---

# Define TM Domain Types with Client Isolation

## Overview

Replace the existing `TMEntry` definition in `core-domain/tm/tm-types.ts` with new types that:

- Structurally enforce client isolation via `ClientScope`
- Include explicit provenance tracking via `TMProvenance`
- Document invariants and forbidden states
- Ensure immutability through readonly fields

## Type Definitions

### 1. TMProvenance

A type capturing where a TM entry originated from, enabling audit trails and defensibility.**Fields:**

- `projectId: ProjectId` - The project that created this entry
- `snapshotId: SnapshotId` - The snapshot this entry came from
- `createdAt: number` - Epoch milliseconds when entry was created (explicit, passed in)

**Invariants:**

- All fields are required (no optional provenance)
- `createdAt` must be a valid epoch timestamp (>= 0)
- `projectId` and `snapshotId` must reference valid domain entities

**Forbidden states:**

- `createdAt` cannot be in the future (relative to creation context)
- `projectId` cannot be empty or invalid
- `snapshotId` cannot be empty or invalid

### 2. ClientScope

A branded type that structurally enforces client isolation. Any function working with TM entries must explicitly operate within a client scope.**Structure:**

- Branded type wrapping `ClientId`
- Ensures type-level isolation: functions cannot accidentally mix entries from different clients

**Invariants:**

- Must always wrap a valid `ClientId`
- Cannot be constructed without explicit client context

**Forbidden states:**

- Empty or undefined client scope
- Mixing entries from different client scopes in the same operation

### 3. TMEntry

The core type representing a single translation memory entry.**Required fields:**

- `sourceText: string` - Source language text
- `targetText: string` - Target language text
- `clientId: ClientId` - Client that owns this entry (structural isolation)
- `projectId: ProjectId` - Project that created this entry
- `snapshotId: SnapshotId` - Snapshot this entry came from
- `createdAt: number` - Explicit creation timestamp (epoch milliseconds)

**Structure:**

- All fields readonly (immutability)
- Provenance fields grouped logically
- Client isolation enforced via `clientId` field

**Invariants:**

- `sourceText` and `targetText` are non-empty strings (after trimming)
- `clientId`, `projectId`, `snapshotId` are valid branded IDs
- `createdAt` is a valid epoch timestamp
- Entry is immutable once created (all fields readonly)
- `clientId` must match the client scope when entry is used

**Forbidden states:**

- Empty `sourceText` or `targetText`
- `clientId` that doesn't match the intended client scope
- `createdAt` in the future
- Any mutation of entry fields after creation
- Entries without explicit provenance (all provenance fields required)

## Implementation Details

### File Structure

- File: `core-domain/tm/tm-types.ts`
- Remove existing `TMEntry` definition (lines 13-30)
- Remove lookup functions (lines 56-94) - these are search logic, forbidden per requirements
- Keep only type definitions, no function implementations

### Type Relationships

```javascript
ClientScope (branded ClientId)
    ↓
TMEntry {
  clientId: ClientId (structural isolation)
  provenance: TMProvenance {
    projectId: ProjectId
    snapshotId: SnapshotId
    createdAt: number
  }
  sourceText: string
  targetText: string
}
```



### Comments Style

Follow existing codebase patterns:

- Explain business intent, not syntax
- Document invariants explicitly
- List forbidden states clearly
- Use professional, concise language

## Files to Modify

1. `core-domain/tm/tm-types.ts`

- Replace `TMEntry` type definition
- Add `TMProvenance` type
- Add `ClientScope` type
- Remove lookup function implementations (search logic)
- Update imports if needed