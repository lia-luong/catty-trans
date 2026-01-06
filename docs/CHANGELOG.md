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

