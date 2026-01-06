# Catty Trans

A local-first Computer-Assisted Translation (CAT) and Translation Management System (TMS) designed specifically for solo professional translators. Catty Trans prioritises data sovereignty, offline functionality, and client isolation to address the workflow overhead and trust failures common in agency-centric CAT tools.

## Product Overview

Catty Trans solves three core problems faced by solo translators:

- **Agency-centric overhead**: Eliminates mandatory multi-user workflow steps that add no value to single-user projects
- **Cloud dependency**: Provides full offline functionality for TM lookups, terminology checks, and file operations
- **Opaque data handling**: Offers transparent versioning, rollback capabilities, and strict client isolation to prevent cross-contamination

The system is built with a pure domain core that enforces business rules deterministically, while adapters handle all side effects (storage, file I/O, UI) in outer layers.

## Tech Stack

- **Language**: TypeScript
- **Desktop Framework**: Electron
- **UI Framework**: React
- **Database**: SQLite (with FTS5 for fuzzy matching)
- **Architecture**: Layered architecture with strict domain boundaries

## Repository Structure

```
/core-domain
  /state          # Pure state models and transition functions
  /history        # Versioning and snapshot logic
  /tm             # Translation Memory domain logic (fuzzy matching, lookup algorithms)
  /diff           # Change detection and diff computation
  /guards         # Business rule validation and invariant checks

/adapters
  /storage-sqlite # SQLite persistence layer (repositories, migrations)
  /integrity      # Data integrity checks and validation adapters
  /sync-local     # Local file system sync and backup operations

/desktop
  /electron-main  # Electron main process (window management, IPC)
  /electron-preload # Preload scripts for secure IPC bridge
  /ui             # React UI components and application services

/tests
  /golden         # Golden file tests for deterministic outputs
  /integration    # End-to-end integration tests
```

### Architecture Principles

- **`core-domain` purity**: Contains only pure TypeScript with no side effects (no filesystem, database, network, or UI dependencies)
- **Unidirectional dependencies**: Adapters and UI depend on `core-domain`, never the reverse
- **Immutable state**: All state transitions return new state objects; existing state is never mutated
- **Deterministic functions**: Given the same input state and command, transitions always produce the same output

## Documentation

See the [`docs/`](./docs/) folder for:
- **Product Requirements Document** (`prd-catty-trans.md`): Detailed problem definition, user personas, and feature specifications
- **Technical Decomposition** (`tech-decomposition.md`): System architecture, database schemas, and implementation details
- **Roadmap** (`roadmap.md`): Phase-by-phase development plan with deliverables and success criteria

## Getting Started

_Development setup instructions will be added as the project progresses._
