// Human-readable error message formatting for integrity issues.
// This module converts technical integrity issue types into user-friendly
// messages that explain what went wrong and why the system cannot proceed safely.

import type { IntegrityIssue } from './integrity-types';

// Format an integrity issue into a human-readable error message.
// The message explains the problem in non-technical terms while remaining
// specific enough for users to understand the severity and affected snapshot.
export function formatIntegrityMessage(issue: IntegrityIssue): string {
  switch (issue.issueType) {
    case 'checksum_mismatch':
      return `Snapshot "${issue.snapshotId}" has been corrupted. The stored data does not match its integrity checksum. This indicates the snapshot data may have been damaged.`;

    case 'missing_payload':
      return `Snapshot "${issue.snapshotId}" is missing its data payload. The snapshot record exists but contains no state data.`;

    case 'orphaned_no_project':
      return `Snapshot "${issue.snapshotId}" references project "${issue.details?.projectId}" which no longer exists. The snapshot is orphaned and cannot be restored.`;

    case 'orphaned_not_in_history':
      return `Snapshot "${issue.snapshotId}" exists in storage but is not present in the project's version history. This indicates a mismatch between storage and domain state.`;

    case 'invalid_json':
      return `Snapshot "${issue.snapshotId}" contains invalid JSON data that cannot be parsed. The snapshot data is corrupted and cannot be restored.`;

    case 'domain_invariant_violation':
      return `Snapshot "${issue.snapshotId}" violates domain rules. The parsed data does not conform to expected project structure (e.g., segments belong to wrong project, invalid target languages).`;

    default:
      // Exhaustiveness check: if a new issue type is added, TypeScript will error here.
      const _exhaustive: never = issue.issueType;
      return `Snapshot "${issue.snapshotId}" has an unknown integrity issue.`;
  }
}

