## Catty Trans Documentation

This folder contains the core product and engineering documentation for the Catty Trans app, a local-first CAT/TMS for solo professional translators.

### Core Documentation

- **`prd-catty-trans.md` – Product Requirements Document (PRD)**  
  - Audience: product, UX, and engineering.  
  - Content: problem definition, target users, use cases, constraints, and detailed product requirements.  
  - When to read: start here to understand *why* Catty Trans exists and what the product must do.

- **`tech-decomposition.md` – Engineering Decomposition**  
  - Audience: engineering and technical stakeholders.  
  - Content: architecture, modules, data model, performance constraints, and implementation details.  
  - When to read: after the PRD, to see *how* the system will be structured to meet those requirements.

- **`roadmap.md` – Product Roadmap**  
  - Audience: product, engineering, and planning.  
  - Content: phased delivery plan, milestones, success criteria, and risks.  
  - When to read: after you understand the product and architecture, to see *when* and in what order we plan to deliver capabilities.

### Risk Mitigation & Implementation

- **`pre-ui-risk-assessment.md` – Pre-UI Risk Assessment** ✅ COMPLETE
  - Audience: tech lead, product owner, UX designer.
  - Content: identified risks (TM safety, UX clarity, scaling limits) with detailed mitigation strategies.
  - When to read: before UI development to understand architectural safeguards and limitations.
  - Status: All P0/P1/P2 risks mitigated; document signed off 2026-01-07.

- **`implementation-summary-2026-01-07.md` – Implementation Summary** ✅ COMPLETE
  - Audience: tech lead, engineering.
  - Content: detailed completion report for all risk mitigations (TM batch insert, change explanation, scaling docs).
  - When to read: to verify all pre-UI checklist items are complete.
  - Deliverables: 5 files modified/created, 500+ lines of code/tests, zero blocking issues.

- **`CHANGELOG.md` – Chronological Change Record**
  - Audience: all stakeholders.
  - Content: dated summary of notable changes, features completed, and architectural work.
  - When to read: to track project progress and understand what was delivered each day.

### Architectural Guidance

- **`adr/` – Architectural Decision Records**  
  - Audience: engineering.  
  - Content: documented architectural decisions, rationale, and consequences.  
  - When to read: when implementing features that touch on documented decisions, or when proposing architectural changes.
  - Current ADRs:
    - `001-state-equality-and-optimization.md` – State equality performance trade-offs
    - `002-state-equality-performance.md` – Extended analysis with performance budget

- **`adapter-domain-boundary.md` – Adapter-Domain Boundary Guide**  
  - Audience: engineering (especially new developers).  
  - Content: clear examples of the architectural boundary between pure domain logic and side-effect adapters.  
  - When to read: before implementing features in `core-domain` or `adapters` to understand where code belongs.

- **`domain-entities.md` – Core Domain Entity Specifications**
  - Audience: engineering.
  - Content: detailed specifications for key domain types (Project, Segment, ProjectState, TM, etc).
  - When to read: when working with core-domain to understand invariants and constraints.

- **`codebase-review-2026-01-07.md` – Comprehensive Codebase Review** ✅ COMPLETE
  - Audience: tech lead, product owner.
  - Content: deep architectural review validating purity, immutability, determinism, and test coverage.
  - Findings: 0 architectural violations; 40+ golden tests passing; ready for UI development.

### Suggested Reading Paths

**New collaborators (product/engineering):**
- Start: `prd-catty-trans.md` (problem + key requirements)
- Then: `tech-decomposition.md` (architecture + implementation)  
- Then: `roadmap.md` (delivery phases + priorities)
- Optional: `pre-ui-risk-assessment.md` (architectural safeguards)

**Engineers joining mid-stream (codebase is complete, UI development starting):**
- Skim: `prd-catty-trans.md` (problem + key requirements)
- Deep read: `tech-decomposition.md` (architecture + modules)
- Check: `roadmap.md` (next phase = UI development)
- Review: `pre-ui-risk-assessment.md` (what's been mitigated, what to watch for)
- Reference: `adr/` folder (architectural decisions already made)

**Planning / sequencing discussions:**
- Focus: `roadmap.md`
- Reference: `prd-catty-trans.md` (for context on user needs)
- Reference: `pre-ui-risk-assessment.md` (for constraints and trade-offs)

**Verifying architectural soundness:**
- Read: `codebase-review-2026-01-07.md` (comprehensive review findings)
- Reference: `implementation-summary-2026-01-07.md` (what's been built)
- Check: `adapter-domain-boundary.md` (design patterns)

### Conventions

- All docs include a short front matter block (`description`, `product-name`, `related-docs`) to make cross-linking and discovery easier.  
- When adding new docs to this folder, follow the same front matter pattern and update this `README.md` with a short description and recommended audience.
