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

## 2026-01-08

- **docs(architecture)**: Conducted comprehensive architectural review identifying domain purity, immutability guarantees, and potential risks. Documented architectural decision records (ADR) for state equality optimization strategy and purity requirements for planned TM/diff/guards modules.
- **feat(core-domain)**: Created placeholder modules with pure type definitions and function signatures for Translation Memory (`/tm`), diff computation (`/diff`), and validation guards (`/guards`). These modules establish architectural boundaries before implementation, ensuring future code remains pure with no side effects.
- **test(architecture)**: Added golden tests for TM, diff, and guards modules to prevent accidental introduction of I/O, database access, or side effects into domain logic. Tests automatically enforce architectural purity when these modules are implemented.
- **docs(boundary)**: Created comprehensive adapter-domain boundary guide with clear examples showing correct patterns (domain = pure functions, adapters = side effects) and common mistakes to avoid. This documentation prevents architectural erosion during feature development.
- **docs(readme)**: Updated README to mark planned modules (TM, diff, guards) as "not yet implemented" and added explicit note that these must remain pure when built.

## 2026-01-07 (Continued) — Pre-UI Risk Mitigation

- **feat(tm/promotion-guard)**: Implemented duplicate entry detection in TM promotion workflow. Extended `PromotionContext` with optional `existingSourceTexts` set to enable domain-level duplicate checking, preventing silent database constraint violations during bulk promotion operations (common workflow: "ensure TM is complete"). Returns explicit `requiresExplicitOverride: true` to allow UI workflows like "Update existing?" or "Skip duplicate?".
- **test(tm)**: Created Golden Test G11 validating TM duplicate handling across six scenarios: duplicate detection with existing entries, successful non-duplicate promotion, backwards compatibility without `existingSourceTexts`, empty set handling, override distinction from other rules, and rule priority (duplicate check before ad-hoc).
- **feat(diff/segment)**: Implemented `explainChangeCause()` function providing user-friendly explanations for change causes (`tm_insert`, `manual_edit`, `unknown`). Critical: ensures "unknown" cause is never described with error terminology, preventing user confusion that absent provenance tracking is a system failure.
- **test(diff)**: Extended Golden Test G10 validating `explainChangeCause()` returns non-empty, jargon-free strings for all change cause values and explicitly avoids error terminology for "unknown" cause.
- **feat(diff/computation)**: Implemented `computeDiff()` pure function comparing two `ProjectState` objects and generating linguistic diffs. Handles feasibility limits (refuses projects > 10K segments), implements change truncation at 5K changes with explicit partial status, and always communicates completeness to prevent silent data loss. Also implemented `filterDiffByChangeType()` helper for UI-driven filtering and `explainDiff()` for human-readable change summaries with per-type grouping.
- **docs(prd)**: Added "Provenance Tracking" subsection to PRD Section 4.4 documenting when provenance is captured (TM operations) vs. not captured (manual typing, offline work), clarifying that "No provenance captured" is honest absence of tracking data, not a system error.
- **docs(adr)**: Created ADR 002 documenting state equality performance trade-offs. Chose O(n) structural comparison for MVP with performance budget (< 100ms for typical projects) and deferred optimisation until profiling shows bottleneck. Documents alternatives considered (hash-based, version counters, incremental diffs) and review triggers for revisiting decision.
- **docs(review)**: Published comprehensive codebase review identifying no architectural violations but documenting three fragile areas: state equality performance (deferred optimisation with clear review triggers), TM duplicate handling (now mitigated), and user understanding of "unknown cause" (now addressed with explanations).
- **docs(assessment)**: Published pre-UI risk assessment identifying three critical risks with proposed mitigations (TM duplication silent failures, diff engine scaling limits, user misunderstanding of "unknown cause") and explicit "do not build yet" list (fuzzy matching, diff merge, auto-suggestions, validation rules, TM versioning).
