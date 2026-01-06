-- SQLite schema for projects and project snapshots in the CAT/TMS adapter layer.
-- This schema stores domain entities (Project, ProjectState) as persisted data,
-- while keeping all business logic and invariants in core-domain.
--
-- Design decisions:
-- 1. Full-state JSON snapshots: Each snapshot stores the complete ProjectState
--    as JSON, not deltas. This prioritises correctness and simplicity over
--    storage efficiency for v1.
-- 2. Multiple target languages: Stored as JSON array in projects.target_langs_json
--    to match core-domain's ReadonlyArray<LanguageCode>.
-- 3. No UI/persistence metadata: This schema intentionally omits fields like
--    settings, sync metadata, or UI state that belong in outer layers.

-- Projects table stores basic project metadata.
-- Note: This table is primarily for referential integrity and quick lookups;
-- the full ProjectState (including segments and targetSegments) lives in snapshots.
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  -- JSON array of target language codes, e.g. '["fr", "de"]'
  -- Stored as JSON to match core-domain's ReadonlyArray<LanguageCode>
  target_langs_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'in_progress', 'completed', 'archived')),
  -- Timestamps for adapter-level tracking (not part of core-domain Project type)
  created_at_epoch_ms INTEGER NOT NULL,
  updated_at_epoch_ms INTEGER NOT NULL
);

-- Index for efficient lookups by client
CREATE INDEX idx_projects_client_id ON projects(client_id);

-- Index for status filtering
CREATE INDEX idx_projects_status ON projects(status);

-- Project snapshots table stores complete ProjectState as JSON.
-- Each row represents one immutable snapshot of a project's full state
-- (project metadata, segments, and targetSegments).
CREATE TABLE project_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  -- Milliseconds since Unix epoch when snapshot was created.
  -- Provided by caller (core-domain or application layer), not generated here.
  created_at_epoch_ms INTEGER NOT NULL,
  -- Optional human-facing label (e.g. "Before QA review")
  label TEXT,
  -- Complete ProjectState serialised as JSON.
  -- Contains: { project: Project, segments: Segment[], targetSegments: TargetSegment[] }
  state_json TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Index for efficient lookups of latest snapshot per project
CREATE INDEX idx_snapshots_project_created ON project_snapshots(project_id, created_at_epoch_ms DESC);

-- Index for snapshot ID lookups (used during rollback)
CREATE INDEX idx_snapshots_id ON project_snapshots(id);
