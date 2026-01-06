---
description: Product Requirements Document for Catty Trans app
related-docs: docs/roadmap.md, docs/tech-decomposition.md
product-name: Catty Trans
---

# Product Requirements Document: Catty Trans - A Local-First CAT/TMS for Solo Professional Translators

## 1. Problem Definition

### Core Failure Points in Existing Tools

**Agency-centric design imposing workflow overhead**
- Current CAT/TMS tools assume multi-user projects with approval chains, role hierarchies, and shared resource pools
- Solo translators face mandatory steps (project setup wizards, resource assignment, delivery protocols) that add no value to single-user workflows
- Result: 15–20 minutes of administrative overhead per small project; cognitive load from navigating irrelevant UI

**Cloud dependency breaking offline workflows**
- Most modern CAT tools require active internet for TM lookups, terminology checks, and file access
- Solo translators working from cafés, trains, or regions with unreliable connectivity lose access to their own work
- Specific failure: a translator on a 6-hour flight cannot access TMs from previous projects, forcing redundant translation of recurring content

**Opaque data handling causing trust failures**
- TM corruption events (observed in Trados, MemoQ, Memsource) present cryptic errors with no rollback path
- Terminology leakage: segments from Client A appearing in Client B's project due to shared TM pools
- File conflicts during concurrent work: "last save wins" logic silently overwrites translator's work with no diff or merge capability

### Agency-Centric vs Solo-Centric Contrast

| Dimension | Agency-Centric | Solo-Centric |
|-----------|----------------|--------------|
| **Resource ownership** | Shared TMs, centrally managed | Personal TMs, translator-controlled |
| **Workflow triggers** | Project manager assignment | Self-initiated based on delivery dates |
| **Risk model** | Optimise for consistency across translators | Optimise for client isolation and data sovereignty |
| **Failure handling** | Escalate to admin | Self-service rollback and inspection |

### Concrete Failure Scenarios

1. **TM corruption with no recovery path**: Translator running Trados encounters "database index corrupted" error mid-project. No built-in versioning; must restore from manual backup (if exists), losing 2 days of work. Client delivery missed.

2. **Terminology leakage across clients**: Translator reuses TM for new client without realising it contains NDAfied terms from previous client. Ships file; gets caught in QA review; faces breach-of-contract claim.

3. **Unrecoverable concurrent edits**: Translator works on Project A (offline), then opens Project B (syncs to cloud). Returns to Project A; cloud service has marked local copy as "conflicted" and auto-merged without diff. Result: 400 segments incorrectly reverted to outdated translations.

---

## 2. Target User Profile

### Primary Persona: Sarah, Full-Time Freelance Translator

- **Experience**: 5+ years professional translation (EN→FR, medical/legal)
- **Project mix**: 60% long-term agency contracts (pharma documentation), 40% direct client work (legal briefs, marketing copy)
- **Tooling literacy**: Comfortable with Trados, understands TM/TB concepts, has used Git for personal projects (website localisation)
- **Risk tolerance**:
  - Zero tolerance for IP leakage (works with patented drug formulas, confidential litigation)
  - Low tolerance for vendor lock-in (burned by discontinued tools)
  - Moderate tolerance for technical concepts if they map to translation work

**Key behaviours**:
- Juggles 3–5 active projects weekly
- Works offline 30% of time (commute, travel, co-working spaces with flaky Wi-Fi)
- Manually archives project files quarterly due to TM trust issues
- Maintains separate Trados TMs per client (12 TM files, 2–50K segments each)

### Secondary Persona: Raj, Part-Time Technical Translator

- Former software engineer, now translates API docs and UX copy (EN→HI)
- Expects Git-like behaviour by default
- Needs CLI access for automation (batch processing, terminology extraction scripts)
- Smaller project volume (10–15 jobs/year), but demands perfect reproducibility

---

## 3. Jobs-to-Be-Done

### Job 1: Isolate client work to prevent cross-contamination
**Situation**: Translator receives new project from Client B, has worked with Client A (competitor) on similar content.  
**Outcome**: System guarantees zero segments from Client A appear in Client B's project; translator can audit this guarantee before delivery.  
**Current failure**: Manual TM selection + hope; no verification mechanism.

### Job 2: Recover from mistakes without data loss
**Situation**: Translator bulk-accepts 200 MT suggestions, realises they introduced terminology inconsistencies.  
**Outcome**: Translator rolls back to state before bulk-accept, reviews changes one-by-one.  
**Current failure**: No rollback; must manually revert each segment using undo (if still in session) or restart from backup.

### Job 3: Work offline without functionality loss
**Situation**: Translator on 8-hour flight, needs to finish 3K-word document using TMs from 3 previous projects.  
**Outcome**: All TM lookups, terminology checks, QA runs, and file exports work identically offline and online.  
**Current failure**: Cloud CAT tools lose 60–80% functionality offline; local tools don't sync.

### Job 4: Context-switch between clients without cognitive overhead
**Situation**: Morning: work on Client A (medical), afternoon: Client B (legal), evening: Client A again.  
**Outcome**: System loads correct TM, termbase, and project settings automatically; no risk of applying wrong resources.  
**Current failure**: Manual file management; high error rate when switching rapidly.

### Job 5: Audit what changed and why
**Situation**: Agency flags 15 segments as "inconsistent with TM"; translator needs to prove they followed TM or justify deviations.  
**Outcome**: Translator exports diff showing exactly what changed, when, and what TM match was available at translation time.  
**Current failure**: No auditability; translator must reconstruct from memory or notes.

---

## 4. Functional Requirements

### 4.1 Project and Client Isolation

**What it does**:
- Each project exists in a discrete workspace with explicit TM/TB assignments
- TMs and termbases are never auto-shared across projects
- Client identifier is first-class metadata; system enforces that Client A resources never touch Client B files

**What it does not do**:
- Does not auto-detect client from file metadata (requires explicit declaration)
- Does not allow global TM pools (anti-pattern for solo workflow)

**Failure mode**: If translator attempts to reuse TM across clients, system blocks and surfaces prompt: "TM 'Pharma_ClientA' contains segments from Client A. Create new TM or explicitly confirm cross-client reuse (logged for audit)."

### 4.2 Local, Portable TM and Termbase Handling

**What it does**:
- TMs and TBs stored as plain-text diffable formats (TMX, TBX, or SQLite with schema versioning)
- All files stored in user-defined directory; no hidden databases
- Export to standard formats (TMX, XLIFF, TBX) available at any time

**What it does not do**:
- Does not use proprietary binary formats
- Does not require migration tools for data portability

**Failure mode**: TM file corruption surfaces immediately with diagnostic message: "TM 'Medical_2024' has 3 malformed entries (segments 4502, 4503, 4509). View corrupted data? [Rollback to last valid state | Attempt repair | Export for manual fix]."

### 4.3 Versioning Adapted to Translation Work

**What it does**:
- System auto-snapshots project state at meaningful checkpoints:
  - After each translation session (on close)
  - Before bulk operations (accept all MT, find/replace)
  - On explicit user request ("checkpoint before terminology review")
- Snapshots store: segment translations, TM assignments, project settings, change log
- Rollback restores exact project state; forward-roll available if rollback was mistake

**What it does not do**:
- Does not version source files (translator does not control these)
- Does not require commit messages (auto-generated based on operation type)

**Failure mode**: If rollback target is ambiguous (e.g., "restore to yesterday" but 3 sessions occurred), system lists all candidates with timestamps and segment count deltas: "3 snapshots from 2025-01-05: (1) 09:15, +120 segments, (2) 14:30, +85 segments, (3) 18:00, final delivery prep."

### 4.4 Diffing and Change Review

**What it does**:
- Generates side-by-side diffs between any two project states
- Highlights:
  - New translations
  - Modified translations (with before/after comparison)
  - TM match scores at time of translation
  - Segments where translator overrode TM suggestion
- Exports diff to shareable format (HTML report, PDF, XLIFF with change tracking)

**What it does not do**:
- Does not merge changes from multiple sources (no branching; linear history only)
- Does not track rationale for changes (translator can add notes manually)

**Failure mode**: If diff request spans large state change (e.g., 1000+ modified segments), system paginates and warns: "Diff contains 1,243 changes. Load first 100? [Load all | Filter by segment status | Export full report]."

**Provenance Tracking**:

Provenance indicates where a change came from (TM, manual edit, or unknown). The system captures provenance when:

- **Captured:** Accepting TM match via UI, bulk TM operations, any workflow where TM involvement is explicit
- **Not captured:** Manual typing, paste from clipboard, offline edits without TM, imported translations from external files

Change causes displayed in diffs:
- **"Translation applied from TM match"**: Segment was filled by accepting a TM suggestion
- **"Manually edited by translator"**: Explicit manual edit operation (future: tracked via editor actions)
- **"No provenance captured"**: Change occurred without tracking (manual edit or TM without provenance)

The "No provenance captured" cause is **not an error**. It represents honest absence of tracking data, which commonly occurs during manual translation workflows. This is preferable to guessing or inventing reasons for changes.

### 4.5 Offline-First Behaviour and Sync Rules

**What it does**:
- All core functionality (translation, TM lookup, QA, export) works with zero network
- Optional sync to remote storage (Dropbox, Google Drive, WebDAV) for backup; sync is unidirectional (local → remote) by default
- Network required only for: MT engine calls, online termbase lookups (if configured)

**What it does not do**:
- Does not auto-sync; translator triggers sync manually or on schedule
- Does not resolve conflicts automatically; if remote version differs, system surfaces conflict and asks for resolution

**Failure mode**: If translator attempts to open project synced from another device while local version has uncommitted changes, system blocks and prompts: "Project 'ClientB_Legal' has local changes and remote updates. [Prioritise local | Prioritise remote | View diff first]."

### 4.6 Import/Export Compatibility

**What it does**:
- Imports: XLIFF 1.2/2.x, TTX, SDLXLIFF, MemoQ MQXLIFF, plain bilingual formats (CSV, TSV)
- Exports: XLIFF 2.1, TMX 1.4b, TBX-Basic, plain text bilingual
- Preserves formatting tags during round-trip

**What it does not do**:
- Does not import proprietary TM formats without conversion (Trados SDLTM must be exported to TMX first)
- Does not guarantee perfect tag preservation for all edge cases; logs tag mismatches for review

**Failure mode**: If imported XLIFF contains unsupported inline codes, system extracts them as placeholders and logs warning: "15 segments contain unsupported tags (e.g., <ph id="x7">). Tags preserved as {1}, {2}... Review before delivery."

---

## 5. Workflow Model

### Scenario A: Long-Term Agency Contract (6-Month Pharma Documentation)

1. **Initiation**: Translator creates project "PharmaClient_Q1", assigns existing TM "Pharma_2023" (48K segments), termbase "Medical_EN_FR".
2. **First session**: Translates 500 segments, system auto-snapshots on close.
3. **Week 3**: Agency delivers updated source files. Translator imports; system detects 120 modified segments, shows diff of source changes, preserves existing translations for unchanged segments.
4. **Month 2**: Translator bulk-accepts MT for 300 low-priority segments (user manuals). System snapshots before bulk operation.
5. **QA discovery**: 20 MT segments have wrong terminology. Translator rolls back to pre-bulk-accept state, reviews MT suggestions manually.
6. **Delivery**: Translator exports final XLIFF, generates change report (diff from initial import → final state) for agency QA team.

**State changes**: 18 snapshots over 6 months; TM grows from 48K → 52K segments; no cross-client contamination despite concurrent projects.

**Safe vs dangerous reuse**: Reusing TM "Pharma_2023" for same client; safe because client isolation is maintained. Reusing for different pharma client; dangerous, system blocks without explicit override.

**Human override**: Translator manually marks 10 segments as "do not add to TM" (client-specific phrasing, non-reusable).

### Scenario B: One-Off Ad-Hoc Job (Legal Brief, 2-Day Turnaround)

1. **Initiation**: Translator creates project "Legal_ClientX_Brief", selects "no TM" (first time working with this client).
2. **Session 1**: Translates 1,200 words offline (on train). System snapshots on close.
3. **Session 2**: At home, continues translation. Runs built-in QA (checks for number mismatches, untranslated segments). Fixes 3 errors.
4. **Delivery**: Exports to XLIFF; client requests revision to 5 segments. Translator reopens project, makes changes, generates diff showing only 5 modified segments (proves rest of file unchanged).
5. **Post-delivery**: Translator saves TM from this project as "Legal_2025_ClientX" (800 segments) for potential future work.

**State changes**: 3 snapshots over 2 days; no TM reuse (new client); QA catch prevents delivery error.

**Safe vs dangerous reuse**: No reuse in initial job; future reuse of generated TM is safe if client confirmed recurring.

**Human override**: Translator overrides QA flag ("inconsistent capitalisation") for 2 legal terms; adds note: "Client style guide uses lowercase."

---

## 6. Non-Functional Requirements

### Data Ownership and Portability
- Translator owns all data; no proprietary lock-in
- Project directory contains all files in open formats; can be zipped and migrated to any tool supporting TMX/XLIFF
- No cloud account required for core functionality

### Offline Guarantees
- 100% feature parity offline vs online for: translation, TM lookup, terminology checks, QA, versioning, export
- Network required only for optional services (MT, online termbases)
- If network dependency is introduced (e.g., new MT provider), system must fail gracefully and log request for offline retry

### Performance Expectations
- TM lookup: <50ms for 100K-segment TM on mid-range laptop (2020+ hardware)
- Project load: <2 seconds for 5K-segment project with 3 attached TMs
- Diff generation: <5 seconds for 1K-segment comparison
- No performance degradation during offline operation

### Inspectability of System Decisions
- All automated decisions (TM match selection, terminology suggestions, QA flags) include rationale visible to translator
- Example: TM suggestion shows match score, source segment, previous translator note (if any)
- QA flags link to rule definition; translator can disable rules per-project

---

## 7. Constraints and Trade-Offs

### Out-of-Scope Features
- Real-time collaboration (multi-user editing); solo translator never needs this
- Machine translation training; MT providers handle this
- Invoicing/billing tools; translators use separate accounting software
- Translation marketplace integration; not a discovery platform

### Enterprise Capabilities Intentionally Excluded
- Approval workflows: solo translator is own QA
- Role-based access control: no other users
- Central TM server: all TMs are local

**Justification**: These add complexity without value for single-user workflows. Cloud-based alternatives serve agencies; this tool serves individuals.

### Simplicity Over Scale Trade-Offs

**Linear versioning only (no branching)**  
*Trade-off*: Cannot explore alternative translations in parallel branches.  
*Justification*: Solo translators work sequentially; branching adds cognitive load. If needed, translator duplicates project manually.

**Unidirectional sync (local → remote)**  
*Trade-off*: Cannot collaborate via shared remote storage.  
*Justification*: Solo workflow has single source of truth (translator's device). Bidirectional sync introduces conflict resolution complexity not justified by use case.

**Manual TM assignment per project**  
*Trade-off*: No auto-detection of "similar projects."  
*Justification*: Auto-detection risks accidental cross-client contamination; explicit control is safer. Saves 10 seconds per project setup, risks client breach; unacceptable trade.

---

## 8. Success Metrics

### Reduced Rework
- **Measure**: Percentage of projects where translator uses rollback feature; target <15% (means versioning catches mistakes early)
- **Anti-measure**: If >30%, investigate whether snapshots are too granular (slowing workflow)

### Faster Dispute Resolution
- **Measure**: Time to generate change report for client queries; target <2 minutes (vs 15–30 minutes manually reconstructing changes)
- **Proxy**: Adoption rate of diff export feature within first 3 months

### Lower Cognitive Load During Context-Switching
- **Measure**: Self-reported confidence that correct TM/TB is active; survey after 1 month; target >90% "always confident"
- **Anti-measure**: If <70%, investigate whether project metadata UI is unclear

### Data Sovereignty Confidence
- **Measure**: Percentage of translators who can locate and export their TM files without documentation; target >95%
- **Proxy**: Zero support requests related to "where is my data" within first quarter

---

## 9. Open Questions and Risks

### Assumptions Requiring Validation
- **Assumption**: Solo translators value Git-style versioning enough to learn new mental model.  
  **Risk**: If learning curve too steep, feature goes unused; mitigation needed via onboarding flow.
  
- **Assumption**: Local-first architecture acceptable despite lack of multi-device live sync.  
  **Risk**: If translators expect Dropbox-style "instant everywhere" behaviour, manual sync feels regressive; validate in user testing.

### Adoption Risks for Less Technical Translators
- Primary persona (Sarah) is technically capable; secondary persona (Raj) is highly technical
- Risk: Tool alienates translators who struggle with file system concepts or explicit TM management
- Mitigation: Provide "simplified mode" with sane defaults (auto-snapshot every session, single TM per client)

### Edge Cases Requiring Pre-Build Validation

1. **Massive TM performance**: Does SQLite handle 500K-segment TMs at target latency (<50ms lookup)?  
   **Validation**: Benchmark with real-world pharma/legal TMs.

2. **Corrupted XLIFF imports**: How often do agency-provided XLIFF files have malformed tags or encoding issues?  
   **Validation**: Collect 50 real XLIFF files from translators; test import robustness.

3. **Rollback across TM changes**: If translator rolls back project but TM was updated during rolled-back session, does TM also revert?  
   **Decision needed**: Should TM versioning be coupled to project versioning? Risks TM state diverging from project expectations.