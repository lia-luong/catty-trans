## Catty Trans Documentation

This folder contains the core product and engineering documentation for the Catty Trans app, a local-first CAT/TMS for solo professional translators.

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

- **`adr/` – Architectural Decision Records**  
  - Audience: engineering.  
  - Content: documented architectural decisions, rationale, and consequences.  
  - When to read: when implementing features that touch on documented decisions, or when proposing architectural changes.

- **`adapter-domain-boundary.md` – Adapter-Domain Boundary Guide**  
  - Audience: engineering (especially new developers).  
  - Content: clear examples of the architectural boundary between pure domain logic and side-effect adapters.  
  - When to read: before implementing features in `core-domain` or `adapters` to understand where code belongs.

### Suggested Reading Paths

- **New collaborators (product/engineering)**: `prd-catty-trans.md` → `tech-decomposition.md` → `roadmap.md`.
- **Engineers joining mid-stream**: skim `prd-catty-trans.md` (problem + key requirements) → read `tech-decomposition.md` in depth → check current phase in `roadmap.md`.
- **Planning / sequencing discussions**: focus on `roadmap.md`, referencing `prd-catty-trans.md` and `tech-decomposition.md` as needed for context.

### Conventions

- All docs include a short front matter block (`description`, `product-name`, `related-docs`) to make cross-linking and discovery easier.  
- When adding new docs to this folder, follow the same front matter pattern and update this `README.md` with a short description and recommended audience.
