// SQLite adapter for persisting Translation Memory entries in the CAT/TMS.
// This adapter handles all database operations while keeping core-domain pure.
//
// Architecture constraints:
// - All domain logic remains in core-domain; this adapter only handles persistence.
// - Writes are atomic (single transaction per operation).
// - Reads enforce mandatory client filtering at SQL level.
// - No ID or timestamp generation; all values provided by callers.
// - TM entries are immutable: INSERT only, no UPDATE/DELETE in adapter.
//
// FAILURE SCENARIO & DATA LOSS PREVENTION:
//
// Scenario 1: Duplicate entry insertion (same client + source text)
// How prevented: Composite primary key constraint on (client_id, source_text)
// enforces uniqueness. INSERT fails with constraint violation; caller must handle.
//
// Scenario 2: Cross-client entry leakage in queries
// How prevented: WHERE client_id = ? is mandatory in all read queries.
// Adapter never returns entries without explicit client filtering.
//
// Scenario 3: Partial write (entry inserted but integrity check fails)
// How prevented: Atomic transaction for insertTMEntry. Either entry fully
// inserted or fully rolled back; partial writes impossible.

import type {
  ClientId,
  ProjectId,
  SnapshotId,
} from '../../core-domain/state/domain-entities';
import type { TMEntry } from '../../core-domain/tm/tm-types';

// Database connection type (abstracted to allow different SQLite drivers).
// Reuses the interface from sqlite-project-snapshot-adapter.ts.
// Methods:
// - run(sql, params): Execute a statement, return void
// - get<T>(sql, params): Execute a query, return a single row or undefined
// - all<T>(sql, params): Execute a query, return an array of all matching rows
// - transaction<T>(fn): Execute a function within a transaction
export interface Database {
  run(sql: string, ...params: unknown[]): void;
  get<T = unknown>(sql: string, ...params: unknown[]): T | undefined;
  all<T = unknown>(sql: string, ...params: unknown[]): T[];
  transaction<T>(fn: () => T): T;
}

// Internal row type for deserialising SQLite records into TMEntry.
// This matches the schema in schema-tm-entries.sql exactly.
interface TMEntryRow {
  readonly client_id: string;
  readonly source_text: string;
  readonly target_text: string;
  readonly project_id: string;
  readonly snapshot_id: string;
  readonly created_at_epoch_ms: number;
}

// Helper to convert SQLite row to domain TMEntry type.
// This ensures all branded types are properly cast from database values.
function rowToTMEntry(row: TMEntryRow): TMEntry {
  return {
    sourceText: row.source_text,
    targetText: row.target_text,
    clientId: row.client_id as ClientId,
    projectId: row.project_id as ProjectId,
    snapshotId: row.snapshot_id as SnapshotId,
    createdAt: row.created_at_epoch_ms,
  };
}

// insertTMEntry persists a new TM entry to the database.
// This function is atomic: it runs in a single transaction that either fully
// succeeds (entry inserted) or fully rolls back if constraint violated.
//
// Transaction boundaries:
// 1. BEGIN TRANSACTION
// 2. INSERT INTO tm_entries (all fields)
// 3. COMMIT (or ROLLBACK on constraint violation)
//
// The function does not generate IDs or timestamps; all values are provided by
// the caller (from core-domain or application layer).
//
// Constraint violation (duplicate source text for same client): If an entry with
// the same client_id and source_text already exists, INSERT fails with a PRIMARY
// KEY constraint violation. Caller is responsible for handling duplicates:
// - Reject the duplicate (expected behaviour for immutable TM)
// - Log a warning
// - Or explicitly manage TM evolution (remove old, add new)
export function insertTMEntry(db: Database, entry: TMEntry): void {
  // Execute in a single transaction to ensure atomicity.
  db.transaction(() => {
    // Insert the TM entry with all required provenance fields.
    // Composite primary key (client_id, source_text) enforces uniqueness:
    // each client has exactly one translation per source text.
    db.run(
      `INSERT INTO tm_entries (
        client_id, source_text, target_text, project_id, snapshot_id,
        created_at_epoch_ms
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      entry.clientId,
      entry.sourceText,
      entry.targetText,
      entry.projectId,
      entry.snapshotId,
      entry.createdAt,
    );
  });
}

// insertTMEntryBatch persists multiple TM entries to the database, allowing partial success.
// Unlike insertTMEntry (all-or-nothing), batch insert processes each entry individually,
// enabling UI to display: "5 inserted, 195 skipped (duplicates), 0 failed".
//
// Transaction boundaries:
// - Each entry runs in its own transaction (individual attempt)
// - Duplicate entries (PRIMARY KEY constraint) are caught and marked 'skipped'
// - Other errors are caught and marked 'failed'
// - Successfully inserted entries are marked 'inserted'
//
// Result structure allows UI to:
// - Display explicit counts: "195 already in TM, 5 new entries added"
// - Retry only failed entries if needed
// - Offer "Update existing?" workflow for skipped entries
//
// Return value: BatchInsertResult with three categories
// - inserted: entries successfully written to database
// - skipped: entries rejected due to duplicate constraint
// - failed: entries rejected for other reasons (will log error details)
export type BatchInsertResult = {
  readonly inserted: readonly TMEntry[];
  readonly skipped: readonly TMEntry[];
  readonly failed: readonly TMEntry[];
};

export function insertTMEntryBatch(
  db: Database,
  entries: readonly TMEntry[],
): BatchInsertResult {
  const inserted: TMEntry[] = [];
  const skipped: TMEntry[] = [];
  const failed: TMEntry[] = [];

  // Process each entry individually to allow partial success.
  for (const entry of entries) {
    try {
      // Attempt to insert in individual transaction.
      db.transaction(() => {
        db.run(
          `INSERT INTO tm_entries (
            client_id, source_text, target_text, project_id, snapshot_id,
            created_at_epoch_ms
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          entry.clientId,
          entry.sourceText,
          entry.targetText,
          entry.projectId,
          entry.snapshotId,
          entry.createdAt,
        );
      });

      // Insert succeeded; add to inserted list.
      inserted.push(entry);
    } catch (error) {
      // Check if this is a duplicate constraint violation.
      // SQLite raises SQLITE_CONSTRAINT on PRIMARY KEY violation.
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('UNIQUE constraint failed') || errorMessage.includes('PRIMARY KEY')) {
        // This is expected for duplicate entries; mark as skipped.
        skipped.push(entry);
      } else {
        // This is an unexpected error; mark as failed.
        failed.push(entry);
      }
    }
  }

  return {
    inserted: inserted as readonly TMEntry[],
    skipped: skipped as readonly TMEntry[],
    failed: failed as readonly TMEntry[],
  };
}

// queryTMExactMatch retrieves a TM entry for an exact source text match within
// a specific client's TM. Returns the matched entry or undefined if no match found.
//
// Transaction boundaries:
// - Read-only transaction (implicit in SQLite for SELECT statements).
// - Single SELECT with WHERE client_id = ? AND source_text = ?
// - No write, so rollback not needed.
//
// Client filtering is mandatory: WHERE client_id = ? is enforced at SQL level.
// This prevents cross-client leakage; entries from other clients cannot be returned.
//
// Match type: Exact only. Source text is matched case-sensitively and whitespace-aware.
// SQLite string comparison is case-sensitive by default (unless COLLATE NOCASE used).
// This aligns with deterministic TM semantics: same query → same result.
//
// Return value: TMEntry | undefined
// - TMEntry: Exact match found; includes sourceText, targetText, and provenance
// - undefined: No entry with this client_id and source_text exists
export function queryTMExactMatch(
  db: Database,
  clientId: ClientId,
  sourceText: string,
): TMEntry | undefined {
  // Query with mandatory client filtering at SQL level.
  // Composite index (client_id, source_text) enables efficient lookup.
  const row = db.get<TMEntryRow>(
    `SELECT client_id, source_text, target_text, project_id, snapshot_id,
            created_at_epoch_ms
     FROM tm_entries
     WHERE client_id = ? AND source_text = ?
     LIMIT 1`,
    clientId,
    sourceText,
  );

  // If no row found, return undefined.
  if (row === undefined) {
    return undefined;
  }

  // Convert SQLite row to domain TMEntry type.
  return rowToTMEntry(row);
}

