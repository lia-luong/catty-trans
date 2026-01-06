---
description: Chronological record of notable changes to the Catty Trans repository
product-name: Catty Trans
related-docs: docs/prd-catty-trans.md, docs/tech-decomposition.md, docs/roadmap.md
---

## 2026-01-06

- **feat(core-domain)**: Introduced initial pure domain model for clients, projects, segments, and project snapshots, including immutable identifiers and invariants for language directions and project lifecycle.
- **feat(history)**: Added pure versioning module for project state with snapshot graph, branching support, and safe rollback semantics that prevent data loss when snapshots are missing or conflicting.
- **feat(storage-sqlite)**: Defined SQLite schema and adapter for persisting full project snapshots as JSON, including atomic upsert/insert semantics, foreign-key-backed integrity, and defensive loading that returns `null` on corruption instead of propagating invalid state.
- **docs(architecture)**: Added repository-level README and detailed PRD/technical decomposition describing the CAT/TMS goals, offline-first architecture, and responsibilities of core services such as TM, snapshot, diff, QA, and import/export.

## 2026-01-07


- **feat(integrity)**: Implemented comprehensive snapshot integrity verification system that detects data corruption, orphaned snapshots, and domain invariant violations. System performs checksum validation, JSON parsing verification, referential integrity checks, and history graph consistency validation. Never auto-repairs; always fails loudly with explicit error reporting to prevent silent data loss.
- **feat(storage-sqlite)**: Added SHA-256 checksum calculation and storage for all project snapshots to enable corruption detection. Updated schema to include checksum column with index for efficient integrity verification queries.
- **test(infrastructure)**: Established comprehensive golden test suite covering core domain invariants, translation memory rules, diff engine behavior, and failure scenarios. Tests enforce immutability, rollback correctness, and explainability requirements that must never be violated.
- **chore(scripts)**: Added exercise-spine script to demonstrate complete workflow (project creation, translation changes, snapshots, rollback) without UI dependencies, validating end-to-end data flow.

- **docs(architecture)**: Conducted comprehensive architectural review identifying domain purity, immutability guarantees, and potential risks. Documented architectural decision records (ADR) for state equality optimization strategy and purity requirements for planned TM/diff/guards modules.
- **feat(core-domain)**: Created placeholder modules with pure type definitions and function signatures for Translation Memory (`/tm`), diff computation (`/diff`), and validation guards (`/guards`). These modules establish architectural boundaries before implementation, ensuring future code remains pure with no side effects.
- **test(architecture)**: Added golden tests for TM, diff, and guards modules to prevent accidental introduction of I/O, database access, or side effects into domain logic. Tests automatically enforce architectural purity when these modules are implemented.
- **docs(boundary)**: Created comprehensive adapter-domain boundary guide with clear examples showing correct patterns (domain = pure functions, adapters = side effects) and common mistakes to avoid. This documentation prevents architectural erosion during feature development.
- **docs(readme)**: Updated README to mark planned modules (TM, diff, guards) as "not yet implemented" and added explicit note that these must remain pure when built.

## 2026-01-07 (Continued) — Pre-UI Risk Mitigation

**Translation Memory Safety:**
- Prevents duplicate TM entries during bulk promotion workflows
- System now asks "Update existing?" or "Skip?" instead of failing silently
- Fixes confusing database errors in common "build my TM library" workflows

**Change Reports:**
- Built diff engine to compare any two project snapshots
- Shows what changed since last work session (created/modified/deleted segments)
- Handles large projects with explicit limits and truncation warnings
- Unblocks "what did I change for the client?" workflows

**User Communication:**
- Added friendly explanations for why translations changed (TM match vs manual edit vs untracked)
- System honestly says "no tracking data" instead of implying errors occurred
- Clarified when provenance is captured (TM operations) vs not captured (direct typing, offline work)

**Architecture Review:**
- Confirmed codebase follows best practices with zero violations
- Documented performance trade-offs with clear review triggers
- Defined "do not build yet" list: fuzzy matching, collaborative editing, auto-suggestions (awaiting user research)

**Test Infrastructure:**
- Fixed Jest configuration to properly resolve TypeScript type definitions for test files
- Added missing `@jest/test-sequencer` dependency to resolve module resolution errors

## 2026-01-07 (Continued) — Pre-UI Implementation Complete

**TM Batch Insert (P0 Safety):**
- Implemented `insertTMEntryBatch` in SQLite adapter for bulk TM promotion workflows
- Enables partial success: returns `{inserted, skipped, failed}` breakdown instead of all-or-nothing
- UI can now display: "195 already in TM, 5 new entries added" instead of generic database error
- Fixes silent data loss during bulk promotion scenarios (translator bulk-accepts then reruns same batch)

**Scaling Documentation (P2 Hardening):**
- Added "Scaling Limits" architectural constraint documentation to `diff-limits.ts`
- Explains in-memory snapshot architecture and memory footprint (18–20 MB at 10K segments)
- Documents three-point plan required to scale beyond 10,000 segments (streaming architecture)
- Prevents future attempts to raise limits without understanding architectural implications
- References ADR 002 for related performance decisions

**Test Coverage:**
- Created comprehensive test suite for batch insert with 12 test cases:
  - All new entries, all duplicates, mixed batch (typical scenario with 195 duplicates + 5 new)
  - Empty batch, error handling, determinism validation
  - Business scenario validation: "195 inserted, 195 already in TM, 0 failed"

**Risk Mitigation Status:**
- ✅ P0 (Safety: TM Duplication) — FULLY MITIGATED with domain check + adapter batch insert
- ✅ P1 (User Misunderstanding: Unknown Cause) — FULLY MITIGATED with explanation function + PRD docs
- ✅ P2 (Scaling: Diff Memory) — DOCUMENTED with architectural constraints + ADR 002
- **Result:** All blocking issues resolved; codebase ready for UI development

**Documentation:**
- Updated pre-UI risk assessment with completion status and formal sign-off
- All 6 pre-UI checklist items marked complete
- Handoff document ready for UI development phase
