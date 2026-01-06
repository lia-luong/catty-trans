// Integrity checking types for snapshot verification in the CAT/TMS.
// This module defines the structure for reporting integrity issues found
// during snapshot verification, enabling explicit failure handling without
// auto-repair or silent corruption propagation.

import type { ProjectId, SnapshotId } from '../../core-domain/state/domain-entities';

// Integrity issue severity levels.
// Errors block safe operation; warnings indicate potential issues but allow continuation.
export type IntegritySeverity = 'error' | 'warning';

// Specific integrity failure types detected during verification.
// Each type represents a distinct corruption or inconsistency scenario.
export type IntegrityIssueType =
  | 'checksum_mismatch' // state_json hash doesn't match stored checksum (data corruption)
  | 'missing_payload' // state_json is NULL or empty (incomplete snapshot)
  | 'orphaned_no_project' // snapshot references non-existent project (referential integrity failure)
  | 'orphaned_not_in_history' // snapshot not present in VersionedState history (domain inconsistency)
  | 'invalid_json' // state_json cannot be parsed (syntax corruption)
  | 'domain_invariant_violation'; // Parsed state violates domain rules (logical corruption)

// Individual integrity issue for a specific snapshot.
// Contains all information needed to understand and report the problem.
export type IntegrityIssue = {
  // The snapshot ID affected by this issue.
  readonly snapshotId: SnapshotId;

  // The type of integrity failure detected.
  readonly issueType: IntegrityIssueType;

  // Severity level: 'error' blocks safe operation, 'warning' allows continuation.
  readonly severity: IntegritySeverity;

  // Human-readable error message explaining the issue.
  // This is the primary message shown to users.
  readonly message: string;

  // Optional additional context for debugging or technical analysis.
  // Examples: expected vs actual checksum, project ID referenced, etc.
  readonly details?: Record<string, unknown>;
};

// Complete integrity report for a project's snapshots.
// Aggregates all issues found during verification and provides summary status.
export type IntegrityReport = {
  // The project ID that was verified.
  readonly projectId: ProjectId;

  // Timestamp when verification was performed (milliseconds since Unix epoch).
  readonly verifiedAtEpochMs: number;

  // Total number of snapshots checked for this project.
  readonly totalSnapshots: number;

  // All integrity issues found during verification.
  // Empty array indicates all snapshots passed verification.
  readonly issues: ReadonlyArray<IntegrityIssue>;

  // Safety status: true if no errors were found (warnings are allowed).
  // When false, the system must refuse to continue with unsafe state.
  readonly isSafe: boolean;
};

