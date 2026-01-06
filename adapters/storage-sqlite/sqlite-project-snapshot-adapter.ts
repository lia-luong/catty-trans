// SQLite adapter for persisting ProjectState snapshots in the CAT/TMS.
// This adapter handles all database operations while keeping core-domain pure.
//
// Architecture constraints:
// - All domain logic remains in core-domain; this adapter only handles persistence.
// - Writes are atomic (single transaction per operation).
// - Reads verify integrity before returning data.
// - No ID or timestamp generation; all values provided by callers.
//
// FAILURE SCENARIO & DATA LOSS PREVENTION:
//
// Scenario: A corrupted state_json row contains invalid JSON or violates domain
// invariants (e.g. project.id !== projectId, or targetSegment.targetLanguage
// not in project.targetLanguages).
//
// How the adapter prevents data loss:
//
// 1. JSON parsing errors: If state_json cannot be parsed, loadProjectState
//    catches the error and returns null rather than throwing or returning
//    partial data. This prevents silent corruption from propagating.
//
// 2. Integrity validation: After parsing, loadProjectState explicitly checks
//    domain invariants (project.id matches, all segments belong to project,
//    all targetLanguages are valid). If any check fails, it returns null.
//
// 3. Atomic writes: saveSnapshot uses a single transaction, so partial writes
//    (e.g. project row inserted but snapshot row failed) are impossible.
//    Either both succeed or both roll back.
//
// 4. Foreign key constraints: The schema enforces referential integrity,
//    preventing orphaned snapshots or invalid project references.

import type {
  ProjectId,
  SnapshotId,
} from '../../core-domain/state/domain-entities';
import type { ProjectState } from '../../core-domain/state/project-state';
import { calculateSnapshotChecksum } from '../integrity/checksum-utils';

// Database connection type (abstracted to allow different SQLite drivers).
// In practice, this would be from 'better-sqlite3' or similar.
// For this adapter, we assume a minimal interface:
// - db.run(sql, params): Execute a statement, return void
// - db.get(sql, params): Execute a query, return a single row or undefined
// - db.all(sql, params): Execute a query, return an array of all matching rows
// - db.transaction(fn): Execute a function within a transaction
export interface Database {
  run(sql: string, ...params: unknown[]): void;
  get<T = unknown>(sql: string, ...params: unknown[]): T | undefined;
  all<T = unknown>(sql: string, ...params: unknown[]): T[];
  transaction<T>(fn: () => T): T;
}

// saveSnapshot persists a complete ProjectState as a new snapshot in the database.
// This function is atomic: it runs in a single transaction that either fully
// succeeds (project metadata upserted + snapshot inserted) or fully rolls back.
//
// Transaction boundaries:
// 1. BEGIN TRANSACTION
// 2. INSERT OR REPLACE into projects (upsert project metadata for referential integrity)
// 3. INSERT into project_snapshots (store full state as JSON)
// 4. COMMIT (or ROLLBACK on any error)
//
// The function does not generate IDs or timestamps; all values are provided by
// the caller (from core-domain or application layer).
export function saveSnapshot(
  db: Database,
  state: ProjectState,
  snapshotId: SnapshotId,
  createdAtEpochMs: number,
  label?: string,
): void {
  // Serialise the complete ProjectState to JSON.
  // This includes project, segments, and targetSegments in one atomic blob.
  const stateJson = JSON.stringify(state);

  // Calculate SHA-256 checksum for integrity verification.
  // This enables detection of data corruption during future reads.
  const checksum = calculateSnapshotChecksum(stateJson);

  // Serialise targetLanguages array to JSON for the projects table.
  const targetLangsJson = JSON.stringify(state.project.targetLanguages);

  // Execute in a single transaction to ensure atomicity.
  db.transaction(() => {
    // Upsert project metadata for referential integrity.
    // This ensures the project exists before we insert its snapshot.
    db.run(
      `INSERT OR REPLACE INTO projects (
        id, client_id, name, source_lang, target_langs_json, status,
        created_at_epoch_ms, updated_at_epoch_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      state.project.id,
      state.project.clientId,
      state.project.name,
      state.project.sourceLanguage,
      targetLangsJson,
      state.project.status,
      createdAtEpochMs, // Use snapshot timestamp for created_at if project is new
      createdAtEpochMs, // Use snapshot timestamp for updated_at
    );

    // Insert the snapshot with full state as JSON and its checksum.
    db.run(
      `INSERT INTO project_snapshots (
        id, project_id, created_at_epoch_ms, label, state_json, checksum
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      snapshotId,
      state.project.id,
      createdAtEpochMs,
      label ?? null,
      stateJson,
      checksum,
    );
  });
}

// loadProjectState retrieves the latest snapshot for a project and returns
// the restored ProjectState, or null if no snapshot exists or integrity checks fail.
//
// Transaction boundaries:
// - Read-only transaction (implicit in SQLite for SELECT statements).
// - No writes, so rollback is not needed, but we still verify integrity.
//
// Integrity checks performed:
// 1. JSON parsing: state_json must be valid JSON.
// 2. Project ID match: parsed state.project.id must equal requested projectId.
// 3. Segment consistency: every segment.projectId must equal projectId.
// 4. Target segment consistency: every targetSegment.projectId must equal projectId.
// 5. Target language validity: every targetSegment.targetLanguage must be in
//    project.targetLanguages and must not equal project.sourceLanguage.
//
// If any check fails, the function returns null rather than returning a
// partially-valid or corrupted state. This prevents silent data corruption.
export function loadProjectState(
  db: Database,
  projectId: ProjectId,
): ProjectState | null {
  // Query the latest snapshot for this project (by created_at_epoch_ms DESC).
  const row = db.get<{
    state_json: string;
  }>(
    `SELECT state_json
     FROM project_snapshots
     WHERE project_id = ?
     ORDER BY created_at_epoch_ms DESC
     LIMIT 1`,
    projectId,
  );

  // If no snapshot exists, return null.
  if (row === undefined) {
    return null;
  }

  // Parse the JSON state. If parsing fails, catch the error and return null.
  let state: ProjectState;
  try {
    state = JSON.parse(row.state_json) as ProjectState;
  } catch (error) {
    // JSON parsing failed; state_json is corrupted.
    // Return null to prevent silent corruption propagation.
    return null;
  }

  // Verify integrity: project.id must match the requested projectId.
  if (state.project.id !== projectId) {
    // Mismatched project ID indicates data corruption.
    return null;
  }

  // Verify integrity: all segments must belong to this project.
  for (const segment of state.segments) {
    if (segment.projectId !== projectId) {
      // Segment belongs to a different project; data corruption detected.
      return null;
    }
  }

  // Verify integrity: all targetSegments must belong to this project and have
  // valid targetLanguages.
  for (const targetSegment of state.targetSegments) {
    if (targetSegment.projectId !== projectId) {
      // Target segment belongs to a different project; data corruption detected.
      return null;
    }

    // Verify targetLanguage is in project.targetLanguages.
    if (!state.project.targetLanguages.includes(targetSegment.targetLanguage)) {
      // Invalid target language; violates domain invariant.
      return null;
    }

    // Verify targetLanguage is not the source language.
    if (targetSegment.targetLanguage === state.project.sourceLanguage) {
      // Target language equals source language; violates domain invariant.
      return null;
    }
  }

  // All integrity checks passed; return the restored state.
  return state;
}
