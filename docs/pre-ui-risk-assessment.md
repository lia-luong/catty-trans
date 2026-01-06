# Pre-UI Risk Assessment: TM and Diff Engines
**Catty Trans — Local-First CAT/TMS**  
**Document Status:** Pre-UI Review  
**Review Date:** 2026-01-07

---

## Executive Summary

This assessment identifies **three critical risks** in the TM and Diff engines that must be addressed before UI development begins. Each risk has been validated against the existing codebase, golden tests, and PRD requirements.

**Key Finding:** The domain logic is architecturally sound, but **missing runtime safeguards** in three areas could compromise the solo translator's trust model.

---

## Risk 1: Safety — TM Duplication Allows Silent Data Loss

### Problem Statement

The TM adapter enforces client isolation at insert-time via composite primary key `(client_id, source_text)`, but **does not provide explicit error handling** for duplicate entries. When a translator attempts to promote the same segment twice (common in iterative workflows), the constraint violation occurs at the SQLite layer with no domain-level guidance on resolution.

**Failure Scenario:**
1. Translator finishes Project A (PharmaClient), promotes 200 segments to TM
2. Client requests minor revision; translator updates 5 segments in Project A
3. Translator bulk-promotes all 200 segments again (standard workflow: "ensure TM is complete")
4. SQLite throws PRIMARY KEY constraint violation on 195 segments
5. **No TM entries are inserted** (transaction rolls back atomically)
6. UI receives generic database error; translator unsure if TM promotion succeeded or failed
7. Translator must manually verify which segments are in TM vs. which failed

**Evidence:**
- `adapters/storage-sqlite/sqlite-tm-adapter.ts:88-107` — `insertTMEntry` wraps INSERT in transaction, but throws constraint violation without domain-level recovery
- `core-domain/tm/promotion-guard.ts` — validates business rules (cross-client, ad-hoc), but **does not check for existing entries**
- PRD Section 4.2 — "TM file corruption surfaces immediately with diagnostic message" — constraint violations are NOT corruption, but current design treats them identically

**Why This Breaks Trust:**
- Bulk operations are standard in CAT workflows (Scenario A in PRD: "Translator bulk-accepts MT for 300 segments")
- Silent failure mode: translator believes TM is updated, but 195 entries are missing
- Forces manual auditing: "which segments are in TM?" — exactly the overhead the tool aims to eliminate

### Mitigation (Without Adding Features)

**1. Domain-Level Duplicate Detection**
- Add `queryTMEntryExists(clientId, sourceText): boolean` to adapter
- Extend `canPromoteSegment` to check for existing entry:
  - If exists: `{ allowed: false, reason: "Entry already exists in TM", requiresExplicitOverride: true }`
  - This allows UI to offer "Update existing?" or "Skip duplicate?" choices
- **No new functionality**: just surfacing existing constraint as a business rule

**2. Adapter-Level Batch Semantics**
- Add `insertTMEntryBatch(entries): { inserted: TMEntry[], skipped: TMEntry[], failed: TMEntry[] }`
- Transaction per entry (not per batch): allows partial success
- Returns explicit breakdown for UI to display: "195 already in TM, 5 new entries added"
- **No new functionality**: just structured error reporting

**3. Documentation Update**
- Document expected behaviour in `adapters/storage-sqlite/sqlite-tm-adapter.ts`:
  - "Duplicate inserts fail with PRIMARY KEY constraint; callers must check existence first"
- Add "Duplicate Entry Handling" section to `docs/adapter-domain-boundary.md`

**Effort:** 1-2 days (domain guard extension + adapter batch function + tests)

**Acceptance Criteria:**
- Golden test: "Promoting same segment twice returns explicit duplicate error (not generic SQL error)"
- Adapter test: "Batch insert with 100 duplicates + 5 new entries returns correct breakdown"

---

## Risk 2: Scaling — Diff Engine Has No Streaming or Pagination Path

### Problem Statement

The diff engine enforces hard limits (10,000 segments, 5,000 changes), but **returns results as in-memory arrays** with no path to streaming or pagination. When a translator works on a 9,500-segment project (within limits), the system loads **all ProjectState data into memory twice** (from/to states) before computing diffs.

**Failure Scenario:**
1. Translator working on large technical documentation project (8,000 segments)
2. Requests diff between initial import and current state (6,200 changes detected)
3. Adapter loads Snapshot 1 (8,000 segments × 2 languages × ~150 bytes/segment = ~2.4 MB JSON)
4. Adapter loads Snapshot 2 (same size)
5. Domain computes diff, allocates array for 6,200 `DiffUnit` objects (~1.5 MB)
6. **Total memory footprint: ~6.5 MB** (acceptable for this project)
7. Translator switches to larger project (9,999 segments, at hard limit): **~18 MB memory** just for diff computation
8. On lower-end hardware (4 GB RAM, multiple projects open): diff request causes UI lag or OOM

**Evidence:**
- `core-domain/diff/diff-types.ts:188-217` — `DiffResult.changes` is `ReadonlyArray<DiffUnit>` (full in-memory array)
- `core-domain/diff/diff-limits.ts:14-22` — `MAX_CHANGES_RETURNED = 5,000` enforced via truncation, not pagination
- `core-domain/diff/diff-types.ts:227-238` — `computeDiff` signature takes `ProjectState` (not iterator or stream)
- PRD Section 6 — "Diff generation: <5 seconds for 1K-segment comparison" — no mention of memory constraints

**Why This Breaks Scalability:**
- Hard limits prevent scaling beyond 10,000 segments, but **no path to incremental work**
- When UI implements "view next 100 changes", adapter must still load full diff into memory
- Zero benefit from SQLite indexes or cursor-based queries: domain operates on in-memory snapshots

**Current State (No Immediate Risk):**
- 10,000-segment limit is defensible for MVP (PRD Scenario A: 500-3,000 segments typical)
- Memory usage at limit (~20 MB) is acceptable on modern hardware
- Diff stress tests pass (golden test: `diff-limits-stress.test.ts`)

**Future Risk (When Scaling Requirements Change):**
- If limit is raised to 50,000 segments: memory footprint becomes unacceptable (~100 MB per diff)
- If UI implements "live diff" (recompute on every edit): repeated full-state loads cause lag

### Mitigation (Without Adding Features)

**1. Document Scaling Boundary**
- Add "Scaling Limits" section to `core-domain/diff/diff-limits.ts`:
  - "Diff engine operates on in-memory snapshots. Raising MAX_SEGMENTS_PER_DIFF beyond 10,000 requires architectural changes (streaming, cursor-based iteration)."
- Add "Future Work: Streaming Diffs" section to `docs/roadmap.md`:
  - Describe iterator-based diff algorithm (compute changes incrementally, yield batches)
  - Estimate effort: 2-3 weeks (domain refactor + adapter changes)

**2. Add Memory Budget Warning**
- Extend `checkDiffFeasibility` to estimate memory usage:
  - `estimatedMemoryMB = (segmentCount * 2 * avgSegmentSize) + (estimatedChanges * avgDiffUnitSize)`
  - If > 50 MB: warn user before computation ("This diff may use ~X MB memory. Continue?")
- **No new functionality**: just visibility into resource consumption

**3. Optimise Snapshot Serialisation**
- Review `ProjectState` serialisation in adapters (currently JSON via `JSON.stringify`)
- Consider binary format (MessagePack, Protocol Buffers) to reduce snapshot size by 30-50%
- **Effort:** 2-3 days (adapter changes + benchmarks); **benefit:** defers scaling limit by 1.5-2x

**Effort:** 1 day (documentation + memory warning)

**Acceptance Criteria:**
- Documentation: "Scaling Limits" section exists and describes in-memory constraint
- Test: "Diff computation with 9,999 segments logs memory usage estimate"

---

## Risk 3: User Misunderstanding — Diff "Cause Unknown" Misinterpreted as System Bug

### Problem Statement

The diff engine correctly implements "never invent causation" (Golden Test G10), returning `cause: 'unknown'` when TM provenance is unavailable. However, **no user-facing explanation** exists for what "unknown" means in the context of a CAT tool.

**Failure Scenario:**
1. Translator manually types translation for 50 segments (no TM involvement)
2. Requests diff to review changes before delivery
3. Diff shows: `cause: 'unknown'` for all 50 segments
4. Translator interprets "unknown" as:
   - **Option A (Correct):** "System doesn't know if this was manual or TM-driven because no provenance was captured"
   - **Option B (Incorrect):** "System failed to detect cause; this is a bug"
   - **Option C (Incorrect):** "This segment's history was corrupted or lost"
5. Translator files bug report: "All my changes show 'unknown cause' — is my TM broken?"
6. Support burden: explaining that "unknown" is honest absence of data, not a failure

**Evidence:**
- `core-domain/diff/diff-segment.ts:139-162` — `determineCause` returns `'unknown'` when no `tmProvenance` exists
- `core-domain/diff/diff-types.ts:30` — `ChangeCause` type includes `'unknown'` with comment: "No provenance available; absence of evidence is not evidence of cause"
- PRD Section 5 — "Scenario B: One-Off Ad-Hoc Job" — translator works offline, no mention of provenance tracking
- **No user-facing documentation** for what `ChangeCause.unknown` means in UI context

**Why This Breaks User Trust:**
- CAT tools historically hide implementation details; "unknown" feels like an error, not a feature
- Honest design choice (never guess) is **counter-intuitive** without explanation
- Translators expect TM-driven vs. manual distinction; "unknown" feels like missing functionality

**Current State (No Immediate Risk):**
- Domain logic is correct: Golden Test G10 validates honesty
- Type system documents intent: comments explain "absence of evidence"
- **Risk emerges at UI layer:** when `cause: 'unknown'` is rendered without context

### Mitigation (Without Adding Features)

**1. Extend `ChangeCause` with User-Facing Explanation**
- Add `explainChangeCause(cause: ChangeCause): string` to `core-domain/diff/diff-segment.ts`:
  ```typescript
  export function explainChangeCause(cause: ChangeCause): string {
    switch (cause) {
      case 'tm_insert':
        return 'Translation applied from TM match';
      case 'manual_edit':
        return 'Manually edited by translator';
      case 'unknown':
        return 'No provenance captured (manual edit or TM without tracking)';
    }
  }
  ```
- **No new functionality**: just human-readable strings for existing enum

**2. Add "Provenance Tracking" Section to PRD**
- Document when provenance is captured vs. not captured:
  - **Captured:** Accepting TM match via UI, bulk TM operations
  - **Not captured:** Manual typing, paste from clipboard, offline edits without TM
- Explain that `'unknown'` is expected for manual work, not a bug
- Add to PRD Section 4.4 ("Diffing and Change Review")

**3. Add Golden Test for Explanation Strings**
- Test: "explainChangeCause returns non-empty, jargon-free strings for all enum values"
- Test: "explainChangeCause('unknown') does not contain words: error, failed, missing, corrupted"

**Effort:** 0.5 days (explanation function + tests + PRD update)

**Acceptance Criteria:**
- Domain provides user-facing explanation for all `ChangeCause` values
- PRD documents when provenance is/is not captured
- Test validates explanation strings are user-friendly

---

## What Must NOT Be Built Yet

### 1. TM Fuzzy Matching (Explicitly Deferred)

**Why Not:**
- PRD Section 4 and `core-domain/tm/query-types.ts:19-30` explicitly define `TMMatchType = 'exact' | 'none'`
- Rationale: "eliminates probabilistic behaviour that could produce different results on repeated queries"
- Fuzzy matching requires:
  - Scoring algorithm (Levenshtein distance, token overlap, etc.)
  - Threshold configuration (what % is "good enough"?)
  - Ranking logic (when multiple fuzzy matches exist)
  - UI for explaining match scores to users
- **Risk:** Building this now introduces non-deterministic behaviour that breaks audit trail guarantees

**Decision:** Defer until TM exact-match workflow is validated by real users (6+ months post-launch)

---

### 2. Diff Merge/Conflict Resolution (Out of Scope)

**Why Not:**
- PRD Section 7 ("Constraints and Trade-Offs") explicitly excludes branching: "Linear versioning only (no branching)"
- Justification: "Solo translators work sequentially; branching adds cognitive load"
- Merge logic requires:
  - Three-way merge algorithm (base, local, remote)
  - Conflict markers in segment text
  - UI for manual conflict resolution
- **Risk:** Solo translator never needs this (single device, linear history); building it now adds complexity for zero value

**Decision:** Never build unless multi-device collaboration becomes a validated user need

---

### 3. TM Auto-Suggestion During Typing (Not in MVP)

**Why Not:**
- PRD Section 4.1 focuses on **explicit TM assignment** per project, not real-time lookups
- Auto-suggestion requires:
  - Keystroke-level TM queries (high performance requirement)
  - UI for inline suggestions (interrupts typing flow)
  - User preference management (some translators find this distracting)
- Current design supports: query TM when translator **explicitly requests** match (e.g., "Find TM matches for this segment")
- **Risk:** Building this now optimises for engagement, not for solo translator's trust model (PRD emphasises inspectability over automation)

**Decision:** Defer until explicit TM query workflow is validated (3-6 months post-launch)

---

### 4. Diff Export to Client-Specific Formats (Not in Core Domain)

**Why Not:**
- PRD Section 4.4 specifies export formats: "HTML report, PDF, XLIFF with change tracking"
- These are **adapter responsibilities** (file I/O, formatting), not domain logic
- Current domain provides: `DiffResult` structure with all changes + metadata
- Export formatting belongs in `adapters/export/` layer (not yet built)
- **Risk:** Building this in core-domain violates architectural purity (no I/O in domain)

**Decision:** Build adapters only after UI validates that `DiffResult` structure meets user needs

---

### 5. TM Entry Versioning/History (Complex, Low ROI)

**Why Not:**
- PRD Section 4.3 focuses on **project state versioning**, not TM versioning
- TM entries are immutable: `core-domain/tm/tm-types.ts:119` — "Entries are immutable once created"
- TM versioning requires:
  - Snapshot history per TM (separate from project snapshots)
  - Rollback for TM entries (revert to old translation for source text)
  - UI for browsing TM history
- **Risk:** Adds complexity with unclear value (translator rarely needs "what was the TM entry for X in 2024?")
- PRD Open Question (Section 9): "Should TM versioning be coupled to project versioning?" — unanswered

**Decision:** Defer until user research validates need (likely 12+ months post-launch)

---

## Summary: Risk-Ordered Priorities

| Risk | Severity | Effort | Priority | Mitigation Timeline |
|------|----------|--------|----------|---------------------|
| **Safety: TM Duplication** | **High** | 1-2 days | **P0** | Before UI work begins |
| **User Misunderstanding: "Unknown Cause"** | Medium | 0.5 days | **P1** | Before UI exposes diffs |
| **Scaling: Diff Memory** | Low (now), Medium (future) | 1 day | **P2** | Document now, defer refactor |

---

## Pre-UI Checklist

Before starting UI development, the following must be completed:

- [ ] **Risk 1 Mitigation:** `canPromoteSegment` checks for duplicate entries (Golden Test added)
- [ ] **Risk 1 Mitigation:** Adapter provides batch insert with structured error reporting
- [ ] **Risk 3 Mitigation:** `explainChangeCause` function exists and is tested
- [ ] **Risk 3 Mitigation:** PRD updated with provenance tracking documentation
- [ ] **Risk 2 Documentation:** "Scaling Limits" section added to `diff-limits.ts`
- [ ] **Do Not Build List:** Reviewed by product owner; all items confirmed as deferred

---

## Appendix: Validation Against Golden Tests

### Safety Risk (TM Duplication)
- **Covered by:** G4 (cross-client blocked), G5 (ad-hoc blocked) — but **no test for duplicate within same client**
- **Gap:** No golden test for "promote same segment twice within same client"
- **Recommendation:** Add `G11-tm-duplicate-handling.test.ts`

### Scaling Risk (Diff Memory)
- **Covered by:** `diff-limits-stress.test.ts` — validates hard limits, but not memory usage
- **Gap:** No test for memory footprint at scale
- **Recommendation:** Add benchmark test (not golden) measuring memory usage at 5K, 10K segments

### User Misunderstanding Risk (Unknown Cause)
- **Covered by:** G10 (no invented reasons) — validates correctness, but not explainability
- **Gap:** No test for user-facing explanations
- **Recommendation:** Add test for `explainChangeCause` to existing G10 test file

---

## Sign-Off

**Prepared by:** AI Code Review Agent  
**Review Date:** 2026-01-07  
**Next Review:** After Risk 1 and Risk 3 mitigations are implemented

**Approval Required From:**
- [ ] Product Owner (confirm "Do Not Build" list)
- [ ] Tech Lead (confirm mitigation effort estimates)
- [ ] UX Designer (review "unknown cause" explanation wording)

