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
- **Desktop Framework**: Electron (planned)
- **UI Framework**: React (planned)
- **Database**: SQLite (with FTS5 for fuzzy matching)
- **Testing**: Jest with ts-jest
- **Architecture**: Layered architecture with strict domain boundaries

## Repository Structure

```text
/core-domain
  /state          # Pure state models and transition functions
  /history        # Versioning and snapshot logic
  /tm             # Translation Memory domain logic (fuzzy matching, lookup algorithms) [PLANNED - NOT YET IMPLEMENTED]
  /diff           # Change detection and diff computation [PLANNED - NOT YET IMPLEMENTED]
  /guards         # Business rule validation and invariant checks [PLANNED - NOT YET IMPLEMENTED]

/adapters
  /storage-sqlite # SQLite persistence layer (repositories, migrations)
  /integrity      # Data integrity checks, checksum verification, and validation adapters
  /sync-local     # Local file system sync and backup operations (planned)

/desktop
  /electron-main  # Electron main process (window management, IPC) (planned)
  /electron-preload # Preload scripts for secure IPC bridge (planned)
  /ui             # React UI components and application services (planned)

/scripts
  /exercise-spine # End-to-end workflow demonstration script
  /db-wrapper     # Database connection utilities

/tests
  /golden         # Golden tests enforcing core domain invariants, TM rules, and diff behavior
    /architecture # Tests for architectural boundaries (no IO in core-domain)
    /core-domain  # Tests for state immutability and rollback correctness
    /diff         # Tests for change detection and explainability
    /failure      # Tests for error handling and corruption detection
    /meta         # Tests for system-level properties (explainability)
    /tm           # Tests for Translation Memory isolation and immutability
    /tm-query     # Tests for TM query determinism and provenance
  /helpers        # Test utilities and fixtures
  /integration    # End-to-end integration tests (planned)
```

### Architecture Principles

- **`core-domain` purity**: Contains only pure TypeScript with no side effects (no filesystem, database, network, or UI dependencies)
- **Unidirectional dependencies**: Adapters and UI depend on `core-domain`, never the reverse
- **Immutable state**: All state transitions return new state objects; existing state is never mutated
- **Deterministic functions**: Given the same input state and command, transitions always produce the same output
- **Data integrity**: All snapshots are protected with SHA-256 checksums and comprehensive integrity verification to detect corruption

**Important**: Planned modules (`/tm`, `/diff`, `/guards`) must remain pure when implemented. They must contain only pure functions with no IO, database access, or side effects. All persistence and I/O operations belong in adapters.

## Documentation

See the [`docs/`](./docs/) folder for:

- **Product Requirements Document** (`prd-catty-trans.md`): Detailed problem definition, user personas, and feature specifications
- **Technical Decomposition** (`tech-decomposition.md`): System architecture, database schemas, and implementation details
- **Roadmap** (`roadmap.md`): Phase-by-phase development plan with deliverables and success criteria
- **Golden Tests** (`all-golden-tests.md`): Comprehensive specification of golden tests that enforce critical domain invariants
- **CHANGELOG** (`CHANGELOG.md`): Chronological record of notable changes

## Testing

The project uses Jest with a comprehensive golden test suite that enforces critical domain invariants:

- **Core domain purity**: Ensures no side effects leak into the domain layer
- **State immutability**: Verifies that state transitions never mutate existing objects
- **Rollback correctness**: Validates that rollback operations restore exact previous states
- **TM isolation**: Ensures translation memory entries are immutable and client-isolated
- **Integrity verification**: Tests corruption detection and data integrity checks

Run tests:

```bash
npm test
```

Exercise the complete workflow:

```bash
npm run exercise-spine
```

## Getting Started

### Prerequisites

- Node.js (v20 or later)
- npm

### Installation

```bash
npm install
```

### Development

Run the test suite:

```bash
npm test
```

Demonstrate the complete workflow (project creation, translations, snapshots, rollback):

```bash
npm run exercise-spine
```
