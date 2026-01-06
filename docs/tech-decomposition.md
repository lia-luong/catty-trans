---
description: Engineering Decomposition with system architecture, database schemma, core modules, Performance Optimizations, Testing Strategy, Deployment & Packaging
product-name: Catty Trans
related-docs: docs/prd-catty-trans.md, docs/roadmap.md
---
## Engineering Decomposition (TypeScript + SQLite)

### 11.1 System Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Presentation Layer                  │
│        (Electron + React; desktop-native UI)        │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│              Application Services Layer             │
│  - ProjectService                                   │
│  - TMService (fuzzy matching, lookup)               │
│  - SnapshotService (versioning, rollback)           │
│  - DiffService (change detection)                   │
│  - QAService (rule engine)                          │
│  - ImportExportService (XLIFF/TMX/TBX parsers)      │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│                  Data Access Layer                  │
│  - ProjectRepository                                │
│  - TMRepository (with FTS5 indexing)                │
│  - SnapshotRepository                               │
│  - TermbaseRepository                               │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│                Persistence Layer                    │
│  SQLite databases:                                  │
│  - workspace.db (projects, clients, metadata)       │
│  - tm_{client_id}.db (per-client TM isolation)      │
│  - tb_{client_id}.db (per-client termbases)         │
│  - snapshots/{project_id}/*.snapshot (delta files)  │
└─────────────────────────────────────────────────────┘
```

**Architecture principles**:
- **Desktop-native**: Electron; no web server required
- **Service-oriented**: Each domain (TM, QA, versioning) in isolated service with clear contracts
- **Repository pattern**: Abstract SQLite operations; enables testing and future migrations
- **File-based storage**: All SQLite DBs in user-visible directory; snapshots as separate files for transparency

---

### 11.2 Database Schema

#### `workspace.db`

```sql
-- Clients table
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  metadata JSON -- contact info, NDA status, etc.
);

-- Projects table
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'active', 'archived', 'delivered'
  settings JSON, -- QA rules, MT preferences, etc.
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Project-TM assignments
CREATE TABLE project_tm_assignments (
  project_id TEXT NOT NULL,
  tm_id TEXT NOT NULL,
  priority INTEGER NOT NULL, -- lookup order
  mode TEXT NOT NULL, -- 'read', 'read-write'
  assigned_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, tm_id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Segments table (stores current working state)
CREATE TABLE segments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_text TEXT NOT NULL,
  target_text TEXT,
  status TEXT NOT NULL, -- 'untranslated', 'draft', 'confirmed', 'locked'
  tm_match_score INTEGER, -- 0-100
  tm_source_id TEXT, -- reference to TM segment if used
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_segments_project ON segments(project_id);
CREATE INDEX idx_segments_status ON segments(status);
```

#### `tm_{client_id}.db` (per-client isolation)

```sql
-- TM metadata
CREATE TABLE tm_metadata (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  segment_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- TM units (translation units)
CREATE TABLE tm_units (
  id TEXT PRIMARY KEY,
  source_text TEXT NOT NULL,
  target_text TEXT NOT NULL,
  source_hash TEXT NOT NULL, -- for exact match lookup
  created_at INTEGER NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  metadata JSON -- project origin, translator notes, etc.
);

CREATE UNIQUE INDEX idx_tm_source_hash ON tm_units(source_hash);

-- Full-text search index for fuzzy matching
CREATE VIRTUAL TABLE tm_units_fts USING fts5(
  source_text,
  content='tm_units',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER tm_units_ai AFTER INSERT ON tm_units BEGIN
  INSERT INTO tm_units_fts(rowid, source_text) VALUES (new.rowid, new.source_text);
END;

CREATE TRIGGER tm_units_ad AFTER DELETE ON tm_units BEGIN
  DELETE FROM tm_units_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER tm_units_au AFTER UPDATE ON tm_units BEGIN
  UPDATE tm_units_fts SET source_text = new.source_text WHERE rowid = new.rowid;
END;
```

#### `tb_{client_id}.db` (termbases)

```sql
CREATE TABLE terms (
  id TEXT PRIMARY KEY,
  source_term TEXT NOT NULL,
  target_term TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  domain TEXT, -- 'medical', 'legal', etc.
  forbidden BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_terms_source ON terms(source_term);
CREATE INDEX idx_terms_domain ON terms(domain);
```

#### Snapshot files (`snapshots/{project_id}/{timestamp}.snapshot`)

```json
{
  "snapshotId": "snap_20250106_143022",
  "projectId": "proj_abc123",
  "timestamp": 1736174422000,
  "triggerType": "session_close", // or "bulk_operation", "manual"
  "segmentCount": 1250,
  "changes": {
    "created": [
      {"id": "seg_001", "source": "...", "target": "...", "status": "confirmed"}
    ],
    "modified": [
      {"id": "seg_042", "before": {"target": "old translation"}, "after": {"target": "new translation"}}
    ],
    "deleted": ["seg_999"]
  },
  "tmAssignments": [
    {"tmId": "tm_pharma_2023", "priority": 1, "mode": "read-write"}
  ],
  "metadata": {
    "segmentsTranslated": 120,
    "segmentsConfirmed": 80,
    "averageTmScore": 85
  }
}
```

**Snapshot strategy**: Store deltas only (changes since previous snapshot); reconstruct any state by applying deltas sequentially. Limits storage growth for large projects.

---

### 11.3 Core Modules

#### Module 1: TMService (Translation Memory)

**Responsibilities**:
- Exact and fuzzy match lookup
- TM unit insertion and updates
- Cross-client contamination prevention

**Key algorithms**:
- **Exact match**: SHA-256 hash of normalised source text (case-folded, whitespace-normalised); O(1) lookup via `source_hash` index
- **Fuzzy match**: Levenshtein distance via SQLite FTS5 BM25 ranking; secondary pass with edit distance calculation; return matches ≥70%
- **Match scoring**: 100% (exact), 95–99% (case/punctuation diffs), 80–94% (minor edits), 70–79% (substantial diffs) in target where source has none
-  **Double spaces**: Flag `\s{2,}` in target
-  **Inconsistent capitalisation**: If same source segment translated differently (case-insensitive match), flag inconsistency


**TypeScript interface**:

```typescript
interface TMMatch {
  sourceText: string;
  targetText: string;
  score: number; // 0-100
  tmId: string;
  metadata: {
    projectOrigin?: string;
    usageCount: number;
    lastUsed: number;
  };
}

interface TMService {
  lookup(sourceText: string, clientId: string, languagePair: LanguagePair): Promise<TMMatch[]>;
  addUnit(source: string, target: string, tmId: string, metadata?: Record<string, unknown>): Promise<void>;
  validateCrossClientUsage(tmId: string, targetClientId: string): Promise<{ safe: boolean; warning?: string }>;
  exportToTMX(tmId: string, outputPath: string): Promise<void>;
  importFromTMX(tmxPath: string, clientId: string, tmName: string): Promise<string>; // returns new tmId
}
```

**Implementation notes**:
- `lookup()` queries all TMs assigned to project; merges results by score (highest first); deduplicates by target text
- `validateCrossClientUsage()` checks if TM's `client_id` matches target; returns warning if mismatch detected
- FTS5 search limited to 100 candidates; Levenshtein calculation expensive, so pre-filter by length diff (<30%)
- Rules run in parallel via worker threads (CPU-bound operations)
- Findings cached; invalidated on segment updates
- Dismissals logged per segment; translator can add notes ("client style guide requires this")

---

#### Module 2: SnapshotService (Versioning)

**Responsibilities**:
- Auto-snapshot at defined triggers
- Rollback to previous state
- Forward-roll if rollback was mistake
- Snapshot pruning (keep daily snapshots for 30 days, weekly after that)

**TypeScript interface**:

```typescript
interface Snapshot {
  id: string;
  projectId: string;
  timestamp: number;
  triggerType: 'session_close' | 'bulk_operation' | 'manual' | 'pre_import';
  segmentCount: number;
  changesSummary: {
    created: number;
    modified: number;
    deleted: number;
  };
}

interface SnapshotService {
  createSnapshot(projectId: string, triggerType: Snapshot['triggerType'], customLabel?: string): Promise<Snapshot>;
  listSnapshots(projectId: string, limit?: number): Promise<Snapshot[]>;
  rollback(projectId: string, snapshotId: string): Promise<void>;
  forwardRoll(projectId: string): Promise<void>; // undo most recent rollback
  getSnapshotDiff(snapshotA: string, snapshotB: string): Promise<SnapshotDiff>;
  pruneOldSnapshots(projectId: string, retentionPolicy: RetentionPolicy): Promise<number>; // returns count deleted
}

interface SnapshotDiff {
  from: Snapshot;
  to: Snapshot;
  segmentChanges: Array<{
    segmentId: string;
    changeType: 'created' | 'modified' | 'deleted' | 'unchanged';
    before?: SegmentState;
    after?: SegmentState;
  }>;
}
```

**Implementation notes**:
- Snapshots stored as JSON files; faster than SQLite for large diffs (no transaction overhead)
- Rollback: load snapshot, apply inverse changes to `segments` table; create new snapshot labelled "rollback from {timestamp}"
- Forward-roll: only available if last operation was rollback; reapplies rolled-back changes
- Pruning: configurable policy (e.g., "keep all for 30 days, then weekly, then monthly after 1 year")

---

#### Module 3: DiffService (Change Detection)

**Responsibilities**:
- Compare two project states (snapshots or live)
- Generate human-readable diff reports
- Export to HTML/PDF with formatting

**TypeScript interface**:

```typescript
interface DiffEntry {
  segmentId: string;
  sourceText: string;
  changeType: 'new' | 'modified' | 'deleted' | 'unchanged';
  before?: {
    targetText: string;
    status: SegmentStatus;
    tmMatchScore?: number;
  };
  after?: {
    targetText: string;
    status: SegmentStatus;
    tmMatchScore?: number;
  };
  timestamp: number;
}

interface DiffService {
  generateDiff(fromSnapshot: string, toSnapshot: string, filters?: DiffFilters): Promise<DiffEntry[]>;
  exportDiffToHTML(diff: DiffEntry[], outputPath: string, options?: ExportOptions): Promise<void>;
  exportDiffToPDF(diff: DiffEntry[], outputPath: string, options?: ExportOptions): Promise<void>;
  exportDiffToXLIFF(diff: DiffEntry[], outputPath: string): Promise<void>; // with track-changes markup
}

interface DiffFilters {
  includeUnchanged?: boolean; // default: false
  segmentStatus?: SegmentStatus[]; // filter by status
  changeTypeOnly?: Array<'new' | 'modified' | 'deleted'>;
  minScoreChange?: number; // only show if TM score changed by N points
}
```

**Implementation notes**:
- HTML export uses side-by-side layout; green highlights for additions, red for deletions, yellow for modifications
- PDF generation via Puppeteer (headless Chrome); renders HTML diff then prints
- XLIFF export embeds `<mrk>` tags per XLIFF 2.x change-tracking spec; compatible with Trados review workflow

---

#### Module 4: QAService (Quality Assurance)

**Responsibilities**:
- Run QA checks on demand or pre-export
- Configurable rules per project/client
- Surface findings with actionable explanations

**TypeScript interface**:

```typescript
interface QARule {
  id: string;
  name: string;
  category: 'consistency' | 'formatting' | 'terminology' | 'numbers' | 'tags';
  severity: 'error' | 'warning' | 'info';
  enabled: boolean;
  config?: Record<string, unknown>; // rule-specific params
}

interface QAFinding {
  segmentId: string;
  ruleId: string;
  severity: QARule['severity'];
  message: string;
  suggestion?: string;
  sourceContext: string; // surrounding text for context
  targetContext: string;
}

interface QAService {
  runChecks(projectId: string, ruleIds?: string[]): Promise<QAFinding[]>;
  getAvailableRules(): Promise<QARule[]>;
  updateProjectRules(projectId: string, rules: QARule[]): Promise<void>;
  dismissFinding(projectId: string, findingId: string, reason: string): Promise<void>; // translator override
}
```

**Built-in rules**:
1. **Untranslated segments**: `status !== 'confirmed' && targetText === null`
2. **Number mismatch**: Extract numbers from source/target; flag if counts differ or values mismatch
3. **Tag consistency**: Count `{1}`, `{2}` placeholders; ensure source count === target count
4. **Terminology consistency**: Check if termbase term appears in source but translation doesn't match TB entry
5. **Forbidden terms**: Flag if target contains terms from client's forbidden list
6. **Leading/trailing whitespace**: Detect `^\s+` or `\s+# Product Requirements Document: Local-First CAT/TMS for Solo Professional Translators



---

#### Module 5: ImportExportService (File Handling)

**Responsibilities**:
- Parse XLIFF, TMX, TBX, SDLXLIFF, MQXLIFF, TTX
- Generate export files with preserved formatting
- Handle malformed input gracefully

**TypeScript interface**:

```typescript
interface ImportResult {
  segmentCount: number;
  warnings: Array<{ segmentId?: string; message: string }>;
  errors: Array<{ line?: number; message: string }>;
}

interface ImportExportService {
  importXLIFF(filePath: string, projectId: string): Promise<ImportResult>;
  exportXLIFF(projectId: string, outputPath: string, version: '1.2' | '2.1'): Promise<void>;
  importTMX(filePath: string, clientId: string, tmName: string): Promise<ImportResult>;
  exportTMX(tmId: string, outputPath: string): Promise<void>;
  importSDLXLIFF(filePath: string, projectId: string): Promise<ImportResult>; // Trados format
  exportSDLXLIFF(projectId: string, outputPath: string): Promise<void>;
  // ... similar methods for MQXLIFF, TTX, TBX
}
```

**XLIFF parsing strategy**:
- Use `fast-xml-parser` (TypeScript-native, 4x faster than `xml2js`)
- Extract `<source>`, `<target>`, `<note>` elements; preserve `<mrk>`, `<g>`, `<x>` inline tags
- Convert inline tags to internal placeholder format: `<g id="1">text</g>` → `{1}text{/1}`
- Store original tag metadata in segment JSON for round-trip fidelity

**Error handling**:
- Malformed XML: catch parse errors, surface line number and excerpt
- Unsupported tags: log warnings but don't block import; replace with placeholders
- Encoding issues: detect charset via BOM or XML declaration; auto-convert to UTF-8

---

#### Module 6: ProjectService (Project Management)

**Responsibilities**:
- CRUD operations for projects, clients
- TM/TB assignment validation
- Session lifecycle management

**TypeScript interface**:

```typescript
interface Project {
  id: string;
  clientId: string;
  name: string;
  sourceLang: string;
  targetLang: string;
  status: 'active' | 'archived' | 'delivered';
  createdAt: number;
  updatedAt: number;
  settings: ProjectSettings;
}

interface ProjectSettings {
  qaRules: QARule[];
  mtProvider?: 'deepl' | 'google' | 'local';
  autoSnapshot: boolean;
  snapshotFrequency: 'session_close' | 'hourly' | 'manual';
}

interface ProjectService {
  createProject(clientId: string, name: string, langs: LanguagePair, settings?: ProjectSettings): Promise<Project>;
  getProject(projectId: string): Promise<Project>;
  listProjects(filters?: { clientId?: string; status?: Project['status'] }): Promise<Project[]>;
  updateProjectSettings(projectId: string, settings: Partial<ProjectSettings>): Promise<void>;
  archiveProject(projectId: string): Promise<void>;
  deleteProject(projectId: string, confirm: boolean): Promise<void>; // requires explicit confirm=true
  
  assignTM(projectId: string, tmId: string, mode: 'read' | 'read-write', priority: number): Promise<void>;
  unassignTM(projectId: string, tmId: string): Promise<void>;
  
  startSession(projectId: string): Promise<void>; // loads project state into memory
  endSession(projectId: string, autoSnapshot: boolean): Promise<void>; // persists changes, triggers snapshot
}
```

**Implementation notes**:
- `deleteProject()` requires `confirm: true` to prevent accidental data loss; shows modal with segment count and last activity timestamp
- `startSession()` preloads assigned TMs into memory cache (LRU cache with 500MB limit)
- `endSession()` flushes dirty segments to DB; if `autoSnapshot === true`, calls `SnapshotService.createSnapshot()`

---

### 11.4 Performance Optimizations

#### TM Lookup Caching
- In-memory LRU cache (via `lru-cache` package); 10K most-used source texts
- Cache hit rate target: >85% during active translation (same domain, recurring phrases)
- Invalidation: on TM unit addition/update

#### SQLite Configuration
```sql
PRAGMA journal_mode = WAL; -- write-ahead logging for concurrency
PRAGMA synchronous = NORMAL; -- balance safety/speed
PRAGMA cache_size = -64000; -- 64MB page cache
PRAGMA temp_store = MEMORY; -- temp tables in RAM
PRAGMA mmap_size = 268435456; -- 256MB memory-mapped I/O
```

**Justification**: WAL mode allows concurrent reads during writes (critical for TM lookup while saving segments); memory-mapped I/O reduces syscall overhead for large TMs.

#### Fuzzy Match Optimization
- Pre-filter FTS5 candidates by character length delta: `ABS(LENGTH(source) - LENGTH(query)) < 0.3 * LENGTH(query)`
- Parallel Levenshtein calculation via worker threads (4 workers on typical quad-core laptop)
- Early termination: if best match >95%, skip remaining candidates

**Benchmark target**: 100K-segment TM, 50-word source text → <50ms lookup (including fuzzy matches 70–100%)

#### Diff Generation Optimization
- Snapshot deltas stored in compressed JSONL (gzip level 6); 10:1 compression ratio for text-heavy diffs
- Lazy loading: load only first 100 diff entries initially; paginate on demand
- Parallelise HTML generation: render each segment diff in worker, merge results

---

### 11.5 Testing Strategy

#### Unit Tests (via Jest)
- **TMService**: Exact match, fuzzy match accuracy (test against known Levenshtein distances), cross-client contamination prevention
- **SnapshotService**: Rollback correctness (restore exact state), forward-roll, pruning logic
- **QAService**: Each rule's detection accuracy (provide known failing segments)
- **ImportExportService**: Round-trip fidelity (import XLIFF → export → re-import; assert no data loss)

**Coverage target**: >85% for service modules; 100% for critical paths (TM lookup, rollback, client isolation)

#### Integration Tests
- **Full workflow**: Create project → import XLIFF → translate 10 segments → snapshot → rollback → export → validate output matches expected
- **Concurrent projects**: Open 3 projects (different clients) → verify TM isolation → switch between projects → verify no cross-contamination
- **Large TM performance**: Generate 100K-segment synthetic TM → run 1000 lookups → assert <50ms p95 latency

#### End-to-End Tests (via Playwright or Spectron for Electron)
- **Offline operation**: Disable network → verify all features functional (import, translate, TM lookup, QA, export)
- **Snapshot recovery**: Simulate crash mid-translation → restart app → verify auto-recovery from last snapshot
- **Diff export**: Generate diff → export to HTML → validate rendered output in headless browser

---

### 11.6 Deployment & Packaging

#### Desktop App Packaging
- **Electron**: Cross-platform (Windows, macOS, Linux); bundle size ~120MB (includes Chromium, Node.js runtime)
- **Alternative (Tauri)**: Rust-based, smaller bundle (~40MB); uses OS webview; faster startup
- **Recommendation**: Start with Electron (faster development, better TypeScript ecosystem); migrate to Tauri if bundle size becomes issue

#### Auto-Update Mechanism
- Use `electron-updater` (GitHub Releases backend)
- Check for updates on app launch (non-blocking)
- Download in background; prompt user to restart when ready
- Rollback mechanism: keep previous version installed until new version validated (first 3 launches without crash)

#### Data Migration Strategy
- SQLite schema versioned via `PRAGMA user_version`
- On app launch, check schema version; run migrations if needed (e.g., `user_version = 1 → 2` adds `segments.notes` column)
- Migrations stored as `.sql` files in `migrations/` directory; applied sequentially

**Example migration**:
```sql
-- migrations/002_add_segment_notes.sql
ALTER TABLE segments ADD COLUMN notes TEXT;
UPDATE PRAGMA user_version = 2;
```

---

### 11.7 Open Technical Questions

#### Question 1: TM-Project Version Coupling
**Problem**: If translator rolls back project to Day 1, should TM also revert (losing segments added Days 2–5)?  
**Options**:
  - **Option A**: TMs are append-only; rollback doesn't affect TM (simpler, but project-TM state can diverge)
  - **Option B**: TM snapshots coupled to project snapshots (complex, but guarantees consistency)

**Recommendation**: Option A for v1.0; add "TM audit mode" where translator can see which TM units were added during rolled-back period and selectively purge.

#### Question 2: Fuzzy Match Algorithm
**Problem**: Levenshtein distance doesn't account for word reordering or synonym substitution (common in translation).  
**Options**:
  - **Option A**: Stick with Levenshtein (industry standard, well-understood)
  - **Option B**: Add TER (Translation Edit Rate) or BLEU-based scoring (more linguistically accurate, computationally expensive)

**Recommendation**: Option A for v1.0; collect user feedback on false negatives (missed useful matches); benchmark Option B performance before considering.

#### Question 3: Snapshot Storage Format
**Problem**: JSON snapshots human-readable but large (10MB for 5K-segment project with full text).  
**Options**:
  - **Option A**: Keep JSON, add gzip compression (reduces to ~1MB, still debuggable via `gunzip`)
  - **Option B**: Switch to binary format (Protocol Buffers, MessagePack) for efficiency
  - **Option C**: Store deltas only (requires sequential replay to reconstruct state)

**Recommendation**: Option A for v1.0 (transparency > efficiency); Option C for large projects (>10K segments) where full snapshots cause slowdowns.

---

### 11.8 Development Phases (Engineering Workstreams)

#### Phase 1: Foundation (Weeks 1–6)
**Workstream A**: Database setup (schema, migrations, test data generators)  
**Workstream B**: Core services scaffold (TMService, ProjectService interfaces only; stub implementations)  
**Workstream C**: Electron boilerplate (window management, IPC bridge, dev tooling)

**Deliverable**: Runnable app that creates projects, displays empty segment list; SQLite DBs created on disk.

---

#### Phase 2: Translation Engine (Weeks 7–12)
**Workstream A**: XLIFF parser (import/export) + tag preservation logic  
**Workstream B**: TMService implementation (exact match, fuzzy match, FTS5 integration)  
**Workstream C**: Segment editor UI (React component with source/target columns, inline tag display)

**Deliverable**: Translate 1K-segment XLIFF using TM; export back to valid XLIFF.

---

#### Phase 3: Versioning & Safety (Weeks 13–16)
**Workstream A**: SnapshotService (create, rollback, forward-roll)  
**Workstream B**: Client isolation enforcement (TM assignment validation)  
**Workstream C**: History viewer UI (timeline, snapshot metadata, restore buttons)

**Deliverable**: Multi-project workflow with rollback; cross-client contamination warnings.

---

#### Phase 4: QA & Diffing (Weeks 17–20)
**Workstream A**: QAService (implement 8 core rules)  
**Workstream B**: DiffService (diff generation, HTML/PDF export)  
**Workstream C**: QA panel UI (findings list, dismiss workflow, rule config)

**Deliverable**: Pre-export QA catches errors; diff report generated in <2 minutes.

---

#### Phase 5: Advanced Features (Weeks 21–28)
**Workstream A**: Termbase support (TBX import, term lookup in editor)  
**Workstream B**: Additional format support (SDLXLIFF, MQXLIFF, TTX)  
**Workstream C**: Sync module (Dropbox/Drive integration, conflict detection UI)

**Deliverable**: Full-featured v1.0; compatible with Trados/MemoQ workflows.

---

#### Phase 6: Polish & Launch Prep (Weeks 29–32)
**Workstream A**: Performance optimization (TM lookup benchmarks, UI responsiveness)