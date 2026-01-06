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

