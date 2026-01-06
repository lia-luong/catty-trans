---
name: Snapshot Integrity Checks
overview: Design and implement integrity verification for project snapshots with explicit failure handling, human-readable error messages, and user recovery options. Never auto-repair or continue on unsafe state.
todos:
  - id: schema_update
    content: Add checksum column to project_snapshots table in schema-projects-snapshots.sql
    status: pending
  - id: integrity_types
    content: Create adapters/integrity/integrity-types.ts with IntegrityReport, IntegrityIssue types
    status: pending
  - id: checksum_utils
    content: Create adapters/integrity/checksum-utils.ts with calculateSnapshotChecksum function
    status: pending
  - id: verify_implementation
    content: Create verify-snapshot-integrity.ts in adapters/integrity/ with verifySnapshotIntegrity function implementing all check types (checksum, missing payload, orphaned, invalid JSON, domain violations)
    status: pending
    dependencies:
      - integrity_types
      - checksum_utils
  - id: update_save_snapshot
    content: Update saveSnapshot to calculate and store checksum when saving
    status: pending
    dependencies:
      - checksum_utils
      - schema_update
  - id: error_messages
    content: Create adapters/integrity/integrity-messages.ts with human-readable error message formatting
    status: pending
    dependencies:
      - integrity_types
---

# Snapshot

Integrity Checks and Recovery Behavior

## Overview

Implement integrity verification for project snapshots that fails loudly and provides clear recovery options. The system will detect corruption, missing data, and orphaned snapshots, but will never auto-repair or continue with unsafe state.

## Architecture

The integrity checking system operates at two levels:

1. **Storage-level checks** (adapter layer): Database integrity, checksum validation, missing payloads
2. **Domain-level checks** (core-domain integration): History graph consistency, orphaned snapshots

## Implementation Plan

### 1. Schema Update

**File**: `adapters/storage-sqlite/schema-projects-snapshots.sql`Add `checksum` column to `project_snapshots` table:

- Type: `TEXT NOT NULL`
- Stores SHA-256 hash of `state_json` (hex-encoded, 64 characters)
- Indexed for efficient verification queries
```sql
ALTER TABLE project_snapshots ADD COLUMN checksum TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_snapshots_checksum ON project_snapshots(checksum);
```


**Migration strategy**: Existing snapshots will need checksums calculated and backfilled on first access or via migration script.

### 2. IntegrityReport Type Definition

**File**: `adapters/integrity/integrity-types.ts` (new file)Define structured report type that categorizes integrity issues:

```typescript
// Integrity issue severity levels
export type IntegritySeverity = 'error' | 'warning';

// Specific integrity failure types
export type IntegrityIssueType =
  | 'checksum_mismatch'      // state_json hash doesn't match stored checksum
  | 'missing_payload'        // state_json is NULL or empty
  | 'orphaned_no_project'   // snapshot references non-existent project
  | 'orphaned_not_in_history' // snapshot not present in VersionedState history
  | 'invalid_json'           // state_json cannot be parsed
  | 'domain_invariant_violation'; // Parsed state violates domain rules

// Individual integrity issue for a specific snapshot
export type IntegrityIssue = {
  readonly snapshotId: SnapshotId;
  readonly issueType: IntegrityIssueType;
  readonly severity: IntegritySeverity;
  readonly message: string; // Human-readable error message
  readonly details?: Record<string, unknown>; // Additional context (expected vs actual checksum, etc.)
};

// Complete integrity report for a project
export type IntegrityReport = {
  readonly projectId: ProjectId;
  readonly verifiedAtEpochMs: number;
  readonly totalSnapshots: number;
  readonly issues: ReadonlyArray<IntegrityIssue>;
  readonly isSafe: boolean; // true if no errors (warnings allowed)
};
```



### 3. Checksum Calculation Utility

**File**: `adapters/integrity/checksum-utils.ts` (new file)Pure function to calculate SHA-256 hash of state JSON:

```typescript
import { createHash } from 'crypto';

// Calculate SHA-256 checksum for state_json payload
// Returns hex-encoded string (64 characters)
export function calculateSnapshotChecksum(stateJson: string): string {
  return createHash('sha256').update(stateJson, 'utf8').digest('hex');
}
```



### 4. verifySnapshotIntegrity Implementation

**File**: `adapters/integrity/verify-snapshot-integrity.ts` (new file)Create new file with integrity verification function. This will import the `Database` interface from `storage-sqlite` adapter:

```typescript
import type { Database } from '../storage-sqlite/sqlite-project-snapshot-adapter';
import type { ProjectId, SnapshotId } from '../../core-domain/state/domain-entities';
import type { VersionedState } from '../../core-domain/history/versioning';
import type { IntegrityReport, IntegrityIssue } from './integrity-types';
import { calculateSnapshotChecksum } from './checksum-utils';

// Verify integrity of all snapshots for a given project
// Returns comprehensive report of all integrity issues found
export function verifySnapshotIntegrity(
  db: Database,
  projectId: ProjectId,
  versionedState: VersionedState, // For history graph validation
): IntegrityReport {
  // Query all snapshots for this project
  // For each snapshot:
  //   1. Check project exists (orphaned_no_project)
  //   2. Check state_json is not NULL/empty (missing_payload)
  //   3. Verify checksum matches (checksum_mismatch)
  //   4. Attempt JSON parse (invalid_json)
  //   5. Validate parsed state against domain invariants (domain_invariant_violation)
  //   6. Check snapshot exists in history graph (orphaned_not_in_history)
  
  // Return IntegrityReport with all issues found
}
```

**Checks performed**:

1. **Missing payload**: `state_json IS NULL OR state_json = ''`
2. **Checksum mismatch**: Calculate hash of `state_json`, compare with stored `checksum`
3. **Orphaned (no project)**: `project_id` not found in `projects` table
4. **Invalid JSON**: `JSON.parse()` throws exception
5. **Domain invariant violation**: Reuse validation logic from `loadProjectState` (project ID match, segment consistency, target language validity)
6. **Orphaned (not in history)**: Snapshot ID not present in `versionedState.history.snapshots`

### 5. Update saveSnapshot to Store Checksums

**File**: `adapters/storage-sqlite/sqlite-project-snapshot-adapter.ts`Modify `saveSnapshot` to calculate and store checksum. Import checksum utility from integrity adapter:

```typescript
import { calculateSnapshotChecksum } from '../integrity/checksum-utils';

export function saveSnapshot(...) {
  const stateJson = JSON.stringify(state);
  const checksum = calculateSnapshotChecksum(stateJson);
  
  db.run(
    `INSERT INTO project_snapshots (
      id, project_id, created_at_epoch_ms, label, state_json, checksum
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    snapshotId,
    state.project.id,
    createdAtEpochMs,
    label ?? null,
    stateJson,
    checksum, // Store calculated checksum
  );
}
```



### 6. Error Messages and User Experience

**File**: `adapters/integrity/integrity-messages.ts` (new file)Human-readable error messages for each issue type:

```typescript
export function formatIntegrityMessage(issue: IntegrityIssue): string {
  switch (issue.issueType) {
    case 'checksum_mismatch':
      return `Snapshot "${issue.snapshotId}" has been corrupted. The stored data does not match its integrity checksum.`;
    case 'missing_payload':
      return `Snapshot "${issue.snapshotId}" is missing its data payload. The snapshot record exists but contains no state.`;
    case 'orphaned_no_project':
      return `Snapshot "${issue.snapshotId}" references project "${issue.details?.projectId}" which no longer exists.`;
    case 'orphaned_not_in_history':
      return `Snapshot "${issue.snapshotId}" exists in storage but is not present in the project's version history.`;
    // ... other cases
  }
}
```



### 7. User Options and Recovery Behavior

**Behavior when integrity check fails**:

1. **System refuses to load project** if `isSafe === false`
2. **Display IntegrityReport** with:

- List of all issues (grouped by type)
- Affected snapshot IDs and timestamps
- Human-readable error messages

3. **User options** (no auto-repair):

- **View details**: Show full IntegrityReport with technical details
- **Export report**: Save IntegrityReport as JSON for analysis
- **Delete corrupted snapshots**: Remove specific snapshots (user must explicitly confirm)
- **Restore from backup**: If user has external backup, guide them to restore
- **Continue at own risk**: Advanced option to bypass check (logs warning, user acknowledges risk)

**UI Integration Points** (to be implemented in presentation layer):

- Integrity check runs on project load
- If unsafe, show modal dialog with issues and options
- Block all project operations until integrity is restored or user explicitly bypasses

### 8. Integration with Existing Code

**Update `loadProjectState`**:

- Before returning state, optionally run `verifySnapshotIntegrity`
- If integrity check fails, return `null` (existing behavior) OR throw structured error with `IntegrityReport`

**Consideration**: Should integrity check be:

- **Always-on** (every load): Safer but slower
- **On-demand** (explicit user action): Faster but requires user awareness
- **Hybrid** (on first load after app start, then cached): Balance of safety and performance

## Files to Create/Modify

1. **New files in `/adapters/integrity/`**:

- `adapters/integrity/integrity-types.ts` - Type definitions (IntegrityReport, IntegrityIssue)
- `adapters/integrity/checksum-utils.ts` - Checksum calculation utility
- `adapters/integrity/integrity-messages.ts` - Human-readable error message formatting
- `adapters/integrity/verify-snapshot-integrity.ts` - Main integrity verification function

2. **Modified files**:

- `adapters/storage-sqlite/schema-projects-snapshots.sql` - Add checksum column
- `adapters/storage-sqlite/sqlite-project-snapshot-adapter.ts` - Update `saveSnapshot` to calculate and store checksums (imports from integrity adapter)

3. **Future integration** (not in this plan):

- Presentation layer UI for displaying integrity reports
- Migration script to backfill checksums for existing snapshots

## Testing Considerations

- Unit tests for checksum calculation
- Unit tests for each integrity check type (mock corrupted data)
- Integration tests: Create snapshots with known corruption, verify detection
- Test orphaned snapshot scenarios (delete project, verify detection)