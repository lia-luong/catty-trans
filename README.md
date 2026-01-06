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
  /state          # Pure state models and transition functions (COMPLETE)
  /history        # Versioning and snapshot logic (COMPLETE)
  /tm             # Translation Memory domain logic: promotion rules, client isolation (COMPLETE)
  /diff           # Change detection and diff computation (COMPLETE)
  /guards         # Business rule validation and invariant checks (COMPLETE)

/adapters
  /storage-sqlite # SQLite persistence layer: project snapshots, TM entries, integrity checks (COMPLETE)
  /integrity      # Data integrity verification: checksums, corruption detection (COMPLETE)

/desktop
  /electron-main  # Electron main process (window management, IPC) (PLANNED)
  /electron-preload # Preload scripts for secure IPC bridge (PLANNED)
  /ui             # React UI components and application services (PLANNED)

/scripts
  /exercise-spine # End-to-end workflow demonstration script (COMPLETE)
  /db-wrapper     # Database connection utilities (COMPLETE)

/tests
  /golden         # Golden tests enforcing core domain invariants (COMPLETE)
    /architecture # Tests for architectural boundaries: no IO in core-domain (COMPLETE)
    /core-domain  # Tests for state immutability and rollback correctness (COMPLETE)
    /diff         # Tests for change detection and explainability (COMPLETE)
    /failure      # Tests for error handling and corruption detection (COMPLETE)
    /meta         # Tests for system-level properties (COMPLETE)
    /tm           # Tests for Translation Memory isolation and immutability (COMPLETE)
    /tm-query     # Tests for TM query determinism and provenance (COMPLETE)
  /adapters       # Tests for adapter functionality and batch operations (COMPLETE)
  /helpers        # Test utilities and fixtures (COMPLETE)
  /integration    # End-to-end integration tests (PLANNED)
```

### Architecture Principles

- **`core-domain` purity**: Contains only pure TypeScript with no side effects (no filesystem, database, network, or UI dependencies)
- **Unidirectional dependencies**: Adapters and UI depend on `core-domain`, never the reverse
- **Immutable state**: All state transitions return new state objects; existing state is never mutated
- **Deterministic functions**: Given the same input state and command, transitions always produce the same output
- **Data integrity**: All snapshots are protected with SHA-256 checksums and comprehensive integrity verification to detect corruption

**Important**: All core-domain modules are now implemented and tested. The foundation is architecturally sound and ready for UI development. Adapters enforce data integrity, immutability, and determinism at all layers.

## Documentation

See the [`docs/`](./docs/) folder for:

- **Product Requirements Document** (`prd-catty-trans.md`): Detailed problem definition, user personas, and feature specifications
- **Technical Decomposition** (`tech-decomposition.md`): System architecture, database schemas, and implementation details
- **Roadmap** (`roadmap.md`): Phase-by-phase development plan with deliverables and success criteria
- **Golden Tests** (`all-golden-tests.md`): Comprehensive specification of golden tests that enforce critical domain invariants
- **CHANGELOG** (`CHANGELOG.md`): Chronological record of notable changes and implementations
- **Pre-UI Risk Assessment** (`pre-ui-risk-assessment.md`): Risk analysis and mitigation for safety, UX, and scaling
- **Implementation Summary** (`implementation-summary-2026-01-07.md`): Detailed completion report for P0/P1/P2 tasks
- **Architectural Decision Records** (`adr/`): Technical decisions including state equality performance optimization
- **Adapter-Domain Boundary** (`adapter-domain-boundary.md`): Patterns for maintaining architectural purity

## Development Status

### Completed (Ready for UI Development)

**Core Domain (Pure TypeScript)**
- ✅ State management: Project snapshots, segment translations, language pairs
- ✅ Versioning: Snapshot history, rollback with exact state restoration
- ✅ Translation Memory: Promotion rules, client isolation, duplicate detection, batch operations
- ✅ Diff Engine: Change detection, causation tracking, limits enforcement
- ✅ Guards: Business rule validation, invariant enforcement

**Adapters & Persistence**
- ✅ SQLite adapter: Full schema with integrity constraints
- ✅ Snapshot storage: Atomic operations with SHA-256 checksums
- ✅ Integrity verification: Corruption detection, referential integrity checks
- ✅ Batch operations: TM batch insert with partial success support

**Testing & Validation**
- ✅ 40+ golden tests enforcing domain invariants
- ✅ Architectural boundary tests (no side effects in core-domain)
- ✅ Immutability and rollback correctness validated
- ✅ Comprehensive test coverage for all adapter operations

**Pre-UI Risk Mitigation** (2026-01-07)
- ✅ **P0 Safety**: TM duplication prevention with explicit error handling
- ✅ **P1 UX**: Change cause explanations (manual vs TM vs unknown) with user-friendly wording
- ✅ **P2 Scaling**: Architectural limits documented with upgrade path for future streaming

### Planned (UI Development Phase)

- ⏳ Electron desktop application with IPC communication
- ⏳ React UI with segment editor, TM lookup interface, change review
- ⏳ File import/export adapters (XLIFF, TMX, CSV)
- ⏳ Project management UI (create, open, settings)
- ⏳ Versioning UI (snapshot browser, rollback controls)

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
