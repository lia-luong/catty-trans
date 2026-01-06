---
name: SQLite TM Adapter
overview: "Implement SQLite persistence for TM entries following the existing adapter pattern: schema for immutable entries with mandatory client isolation, and adapter functions for insert and exact-match query."
todos:
  - id: create-tm-schema
    content: Create schema-tm-entries.sql with tm_entries table and indexes
    status: completed
  - id: create-tm-adapter
    content: Create sqlite-tm-adapter.ts with insertTMEntry and queryTMExactMatch functions
    status: completed
---

# SQLite TM Adapter Implementation

## Context

The existing adapter pattern in [`sqlite-project-snapshot-adapter.ts`](adapters/storage-sqlite/sqlite-project-snapshot-adapter.ts) demonstrates:

- `Database` interface with `run`, `get`, `all`, `transaction` methods
- Atomic writes via `db.transaction()`
- Integrity verification on reads
- No ID/timestamp generation (caller provides all values)

The TM domain types in [`tm-types.ts`](core-domain/tm/tm-types.ts) define `TMEntry` with:

- `sourceText`, `targetText` (the translation pair)
- `clientId` (mandatory client isolation)
- `projectId`, `snapshotId`, `createdAt` (provenance)

## Schema Design

```sql
-- TM entries are immutable: INSERT only, no UPDATE/DELETE in normal operation
CREATE TABLE tm_entries (
  -- Composite primary key: client + source text ensures uniqueness per client
  client_id TEXT NOT NULL,
  source_text TEXT NOT NULL,
  target_text TEXT NOT NULL,
  project_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  created_at_epoch_ms INTEGER NOT NULL,
  PRIMARY KEY (client_id, source_text)
);
```

Key decisions:

- **Composite primary key** `(client_id, source_text)`: Enforces one translation per source text per client (no duplicates)
- **No surrogate ID**: TM entries are identified by their natural key (client + source)
- **Immutable by convention**: Schema allows updates, but adapter never issues UPDATE

## Adapter Functions

### `insertTMEntry`

```javascript
Transaction boundaries:
1. BEGIN TRANSACTION
2. INSERT INTO tm_entries (all fields)
3. COMMIT (or ROLLBACK on constraint violation)
```

If entry already exists (same client + source), INSERT fails with constraint violation. This is intentional: TM entries are immutable.

### `queryTMExactMatch`

```javascript
Transaction boundaries:
- Read-only (implicit SQLite transaction)
- Single SELECT with WHERE client_id = ? AND source_text = ?
```

Returns `TMEntry | undefined`. ClientId filtering is mandatory and enforced at the SQL level.

## Files to Create/Modify

1. [`adapters/storage-sqlite/schema-tm-entries.sql`](adapters/storage-sqlite/schema-tm-entries.sql) — New schema file