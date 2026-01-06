---
name: Align TM Database Schema with Domain Types
overview: Update the `tm_units` table schema in tech-decomposition.md to structurally enforce client isolation and provenance tracking by adding explicit columns for clientId, projectId, and snapshotId, moving these out of JSON metadata.
todos:
  - id: update-tm-units-schema
    content: Update tm_units table schema in tech-decomposition.md to add client_id, project_id, snapshot_id columns
    status: completed
  - id: update-indexes
    content: Add indexes for client_id, project_id, and snapshot_id to support provenance queries
    status: completed
    dependencies:
      - update-tm-units-schema
  - id: update-metadata-comment
    content: Clarify metadata JSON field comment to indicate it is for optional notes, not provenance
    status: completed
    dependencies:
      - update-tm-units-schema
  - id: add-migration-notes
    content: Document migration requirements for existing tm_units tables to extract provenance from JSON
    status: completed
    dependencies:
      - update-tm-units-schema
---

# Align TM Database Schema with Domain Types

## Problem Analysis

The current `tm_units` table schema in `docs/tech-decomposition.md` (lines 125-133) has structural gaps compared to the new TMEntry domain type requirements:**Current Schema Issues:**

1. `clientId` is only implicit via database name `tm_{client_id}.db`, not a column
2. `projectId` and `snapshotId` are buried in JSON `metadata`, not first-class columns
3. `usage_count` is a persistence optimization, not domain data
4. `source_hash` is an index optimization, not domain data
5. Provenance tracking (projectId, snapshotId) cannot be queried/indexed efficiently

**New Domain Requirements:**

- TMEntry must include: `sourceText`, `targetText`, `clientId`, `projectId`, `snapshotId`, `createdAt`
- Structural client isolation (not just database-level)
- Immutable entries with explicit provenance

## Proposed Schema Changes

### Update `tm_units` Table Schema

**Location:** `docs/tech-decomposition.md` lines 124-133**Changes:**

1. Add `client_id TEXT NOT NULL` column (structural enforcement, even though DB is per-client)
2. Add `project_id TEXT NOT NULL` column (provenance tracking)
3. Add `snapshot_id TEXT NOT NULL` column (provenance tracking)
4. Keep `created_at INTEGER NOT NULL` (maps to `createdAt` in domain)
5. Keep `metadata JSON` but clarify it's for optional translator notes, not provenance
6. Keep `source_hash` and `usage_count` but document them as adapter-level optimizations

**New Schema:**

```sql
-- TM units (translation units)
CREATE TABLE tm_units (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL, -- Structural client isolation; matches database name
  project_id TEXT NOT NULL, -- Provenance: which project created this entry
  snapshot_id TEXT NOT NULL, -- Provenance: which snapshot this entry came from
  source_text TEXT NOT NULL,
  target_text TEXT NOT NULL,
  created_at INTEGER NOT NULL, -- Epoch milliseconds; explicit creation timestamp
  source_hash TEXT NOT NULL, -- Adapter optimization: SHA-256 for exact match lookup
  usage_count INTEGER NOT NULL DEFAULT 1, -- Adapter optimization: query performance
  metadata JSON -- Optional translator notes; NOT for provenance data
);
```

**New Indexes:**

```sql
CREATE UNIQUE INDEX idx_tm_source_hash ON tm_units(source_hash);
CREATE INDEX idx_tm_client_project ON tm_units(client_id, project_id);
CREATE INDEX idx_tm_snapshot ON tm_units(snapshot_id);
```

**Rationale:**

- `client_id` column enables cross-database queries if needed and structural type safety
- `project_id` and `snapshot_id` as columns enable efficient provenance queries and audit trails
- Separating provenance from metadata JSON makes the schema self-documenting
- Indexes support common query patterns (lookup by project, audit by snapshot)

### Update Related Documentation

**Location:** `docs/tech-decomposition.md` line 132**Change:** Update the comment on `metadata` JSON to clarify it's for optional notes, not provenance:

```sql
metadata JSON -- Optional translator notes, custom tags, or workflow flags; provenance (project_id, snapshot_id) stored as columns above
```



### Migration Notes

**Add to documentation:**

- Existing `tm_units` tables will need a migration to extract `project_id` and `snapshot_id` from JSON metadata
- `client_id` can be derived from the database filename pattern `tm_{client_id}.db`
- Migration script should validate that all entries have provenance data before schema change

## Files to Modify

1. `docs/tech-decomposition.md` - Update `tm_units` table schema (lines 124-156)