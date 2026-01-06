---
description: Phase-by-phase product development roadmap with clear goal, deliverables, success criteria and risks
product-name: Catty Trans
related-docs: docs/prd-catty-trans.md, docs/tech-decomposition.md
---
# Product Roadmap

## Phase 1: Core Translation Engine
**Goal**: Deliver minimally viable offline CAT tool for single-project workflow.

**Deliverables**:
- Project creation and management (CRUD operations)
- XLIFF 2.x import/export with basic tag preservation
- Segment editor with source/target columns
- TM lookup engine (fuzzy matching, 70–100% match bands)
- Basic QA checks (untranslated segments, number mismatches, tag consistency)
- SQLite-backed TM storage with <50ms lookup for 100K segments

**Success criteria**: Translator can import XLIFF, translate 1K-segment project offline using existing TM, export deliverable; zero data loss.

**Risks**: XLIFF tag handling edge cases; fuzzy matching algorithm performance.

---

## Phase 2: Client Isolation & Versioning
**Goal**: Add multi-project support with safety guarantees.

**Deliverables**:
- Client metadata system; enforce TM/TB isolation per client
- Auto-snapshotting at session close and before bulk operations
- Rollback UI (list snapshots, preview changes, restore)
- TM assignment warnings when cross-client reuse detected
- Project history viewer (timeline of snapshots with segment count deltas)

**Success criteria**: Translator manages 3 concurrent projects (different clients) with zero cross-contamination; successfully rolls back after bulk-accept mistake.

**Risks**: Snapshot storage size (mitigation: delta compression); TM-project version coupling decision required.

---

## Phase 3: Diffing & Auditability
**Goal**: Enable dispute resolution and change tracking.

**Deliverables**:
- Side-by-side diff view between any two snapshots
- Diff export to HTML/PDF (includes TM match scores at translation time)
- Segment-level change log (who changed what, when; single-user context)
- Filter diff by segment status (new, modified, unchanged, conflicted)

**Success criteria**: Translator generates change report in <2 minutes showing only modified segments after client revision request.

**Risks**: Performance with 1K+ segment diffs; HTML export formatting complexity.

---

### Phase 4: Termbase & Advanced QA
**Goal**: Add terminology management and context-aware QA.

**Deliverables**:
- TBX import/export; termbase editor
- Terminology lookup in editor (highlights terms, suggests translations)
- Advanced QA rules (terminology consistency, forbidden terms, regex patterns)
- Configurable QA profiles per client (e.g., Client A forbids "utilize", Client B requires British spelling)

**Success criteria**: Translator catches terminology inconsistency via QA before delivery; avoids client revision round.

**Risks**: TBX format edge cases; QA rule engine performance (must not slow editor responsiveness).

---

## Phase 5: Import/Export Expansion
**Goal**: Support common proprietary formats.

**Deliverables**:
- SDLXLIFF import/export (Trados compatibility)
- MemoQ MQXLIFF support
- TTX legacy format support
- TMX 1.4b import from other CAT tools
- CSV/TSV bilingual import for custom workflows

**Success criteria**: Translator migrates existing Trados project (SDLXLIFF + TMX) with zero manual conversion; continues work seamlessly.

**Risks**: Proprietary format documentation gaps; tag mapping inconsistencies.

---

## Phase 6: Optional Sync & CLI
**Goal**: Add backup and power-user features.

**Deliverables**:
- Unidirectional sync to Dropbox/Google Drive/WebDAV (manual trigger only)
- Conflict detection UI when remote version differs
- CLI for project operations (import, export, snapshot, diff generation)
- Batch processing scripts (e.g., extract terminology from all projects)

**Success criteria**: Technical translator (Raj persona) automates 50% of repetitive tasks via CLI; Sarah backs up projects weekly to Dropbox.

**Risks**: Cloud provider API changes; CLI documentation burden.

---

## Phase 7: Machine Translation Integration
**Goal**: Add optional MT without compromising offline-first principle.

**Deliverables**:
- Plug-in architecture for MT providers (Google Translate API, DeepL, local models)
- MT suggestions in editor (clearly marked, not auto-accepted)
- Offline MT via local models (e.g., Argos Translate, NLLB)
- MT usage tracking (for billing reconciliation)

**Success criteria**: Translator uses DeepL for low-priority segments online; switches to local MT offline without workflow disruption.

**Risks**: API rate limits; local MT quality perception; cost surprises.

---

## Post-v1.0: Expansion Candidates (Future)
**Considered but deferred**:
- Collaborative features (real-time editing, commenting); requires multi-user rearchitecture
- Mobile app (iOS/Android); screen size constraints for segment editing
- Web-based version; conflicts with offline-first guarantee
- Integrated invoicing; out-of-scope per PRD constraints
- Auto-TM discovery; risks cross-client contamination

**Decision criteria for inclusion**: Feature must serve >40% of users; must not compromise core constraints (offline-first, client isolation, data portability).

---