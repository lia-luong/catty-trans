// Snapshot integrity verification for project snapshots in the CAT/TMS.
// This module performs comprehensive integrity checks on all snapshots for a project,
// detecting corruption, missing data, orphaned snapshots, and domain invariant violations.
// Never auto-repairs; always fails loudly with explicit error reporting.

import type { Database } from '../storage-sqlite/sqlite-project-snapshot-adapter';
import type { ProjectId, SnapshotId } from '../../core-domain/state/domain-entities';
import type { VersionedState } from '../../core-domain/history/versioning';
import type { ProjectState } from '../../core-domain/state/project-state';
import type { IntegrityReport, IntegrityIssue, IntegritySeverity } from './integrity-types';
import { calculateSnapshotChecksum } from './checksum-utils';

// Verify integrity of all snapshots for a given project.
// Performs comprehensive checks including checksum validation, payload existence,
// referential integrity, JSON parsing, domain invariants, and history graph consistency.
// Returns a complete report of all issues found; never auto-repairs or continues on unsafe state.
export function verifySnapshotIntegrity(
  db: Database,
  projectId: ProjectId,
  versionedState: VersionedState,
): IntegrityReport {
  const verifiedAtEpochMs = Date.now();
  const issues: IntegrityIssue[] = [];

  // Query all snapshot records for this project with their metadata.
  const snapshotRows = db.all<{
    id: SnapshotId;
    project_id: string;
    state_json: string | null;
    checksum: string | null;
  }>(
    `SELECT id, project_id, state_json, checksum
     FROM project_snapshots
     WHERE project_id = ?
     ORDER BY created_at_epoch_ms DESC`,
    projectId,
  );

  const totalSnapshots = snapshotRows.length;

  // If no snapshots exist, return a clean report (no issues, but also no snapshots to verify).
  if (totalSnapshots === 0) {
    return {
      projectId,
      verifiedAtEpochMs,
      totalSnapshots: 0,
      issues: [],
      isSafe: true,
    };
  }

  // Verify each snapshot individually.
  for (const row of snapshotRows) {
    const snapshotIssues = verifySingleSnapshotRow(
      db,
      projectId,
      row,
      versionedState,
    );
    issues.push(...snapshotIssues);
  }

  // Determine if the state is safe: no errors (warnings are allowed).
  const hasErrors = issues.some((issue) => issue.severity === 'error');
  const isSafe = !hasErrors;

  return {
    projectId,
    verifiedAtEpochMs,
    totalSnapshots,
    issues,
    isSafe,
  };
}

// Verify a single snapshot row for integrity issues.
// Returns an array of issues found (empty if snapshot is valid).
function verifySingleSnapshotRow(
  db: Database,
  projectId: ProjectId,
  row: {
    id: SnapshotId;
    project_id: string;
    state_json: string | null;
    checksum: string | null;
  },
  versionedState: VersionedState,
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const snapshotId = row.id;

  // Check 1: Orphaned snapshot (project doesn't exist).
  const projectExists = db.get<{ id: string }>(
    `SELECT id FROM projects WHERE id = ?`,
    row.project_id,
  );

  if (projectExists === undefined) {
    issues.push({
      snapshotId,
      issueType: 'orphaned_no_project',
      severity: 'error',
      message: `Snapshot "${snapshotId}" references non-existent project "${row.project_id}".`,
      details: { projectId: row.project_id },
    });
    // Continue checking other issues even if project is missing.
  }

  // Check 2: Missing payload (state_json is NULL or empty).
  if (row.state_json === null || row.state_json === '') {
    issues.push({
      snapshotId,
      issueType: 'missing_payload',
      severity: 'error',
      message: `Snapshot "${snapshotId}" is missing its data payload.`,
    });
    // Cannot continue validation without payload, so return early.
    return issues;
  }

  // Check 3: Checksum mismatch (if checksum exists).
  if (row.checksum !== null && row.checksum !== '') {
    const calculatedChecksum = calculateSnapshotChecksum(row.state_json);
    if (calculatedChecksum !== row.checksum) {
      issues.push({
        snapshotId,
        issueType: 'checksum_mismatch',
        severity: 'error',
        message: `Snapshot "${snapshotId}" checksum mismatch. Data may be corrupted.`,
        details: {
          expected: row.checksum,
          actual: calculatedChecksum,
        },
      });
      // Continue validation even with checksum mismatch to detect other issues.
    }
  }

  // Check 4: Invalid JSON (cannot parse state_json).
  let parsedState: ProjectState | null = null;
  try {
    parsedState = JSON.parse(row.state_json) as ProjectState;
  } catch (error) {
    issues.push({
      snapshotId,
      issueType: 'invalid_json',
      severity: 'error',
      message: `Snapshot "${snapshotId}" contains invalid JSON that cannot be parsed.`,
      details: { parseError: String(error) },
    });
    // Cannot continue domain validation without valid JSON, so return early.
    return issues;
  }

  // Check 5: Domain invariant violations (reuse validation logic from loadProjectState).
  if (parsedState !== null) {
    // Verify project ID matches.
    if (parsedState.project.id !== projectId) {
      issues.push({
        snapshotId,
        issueType: 'domain_invariant_violation',
        severity: 'error',
        message: `Snapshot "${snapshotId}" project ID mismatch. Expected "${projectId}", found "${parsedState.project.id}".`,
        details: {
          expected: projectId,
          actual: parsedState.project.id,
        },
      });
    }

    // Verify all segments belong to this project.
    for (const segment of parsedState.segments) {
      if (segment.projectId !== projectId) {
        issues.push({
          snapshotId,
          issueType: 'domain_invariant_violation',
          severity: 'error',
          message: `Snapshot "${snapshotId}" contains segment "${segment.id}" belonging to different project "${segment.projectId}".`,
          details: {
            segmentId: segment.id,
            wrongProjectId: segment.projectId,
          },
        });
      }
    }

    // Verify all targetSegments belong to this project and have valid targetLanguages.
    for (const targetSegment of parsedState.targetSegments) {
      if (targetSegment.projectId !== projectId) {
        issues.push({
          snapshotId,
          issueType: 'domain_invariant_violation',
          severity: 'error',
          message: `Snapshot "${snapshotId}" contains target segment "${targetSegment.id}" belonging to different project "${targetSegment.projectId}".`,
          details: {
            targetSegmentId: targetSegment.id,
            wrongProjectId: targetSegment.projectId,
          },
        });
      }

      // Verify targetLanguage is in project.targetLanguages.
      if (!parsedState.project.targetLanguages.includes(targetSegment.targetLanguage)) {
        issues.push({
          snapshotId,
          issueType: 'domain_invariant_violation',
          severity: 'error',
          message: `Snapshot "${snapshotId}" contains target segment with invalid target language "${targetSegment.targetLanguage}".`,
          details: {
            targetSegmentId: targetSegment.id,
            invalidLanguage: targetSegment.targetLanguage,
            validLanguages: parsedState.project.targetLanguages,
          },
        });
      }

      // Verify targetLanguage is not the source language.
      if (targetSegment.targetLanguage === parsedState.project.sourceLanguage) {
        issues.push({
          snapshotId,
          issueType: 'domain_invariant_violation',
          severity: 'error',
          message: `Snapshot "${snapshotId}" contains target segment where target language equals source language "${parsedState.project.sourceLanguage}".`,
          details: {
            targetSegmentId: targetSegment.id,
            invalidLanguage: targetSegment.targetLanguage,
          },
        });
      }
    }
  }

  // Check 6: Orphaned snapshot (not in history graph).
  if (!versionedState.history.snapshots.has(snapshotId)) {
    issues.push({
      snapshotId,
      issueType: 'orphaned_not_in_history',
      severity: 'warning', // Warning because snapshot might be intentionally excluded
      message: `Snapshot "${snapshotId}" exists in storage but is not present in the project's version history.`,
    });
  }

  return issues;
}

