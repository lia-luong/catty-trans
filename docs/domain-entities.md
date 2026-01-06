
### High-level notes

- **Scope**: Minimal core entities for Projects, Clients, Segments, Snapshots only.
- **Out of scope by design**: persistence (DB ids, sync metadata, soft-deletes), UI concerns (labels for components, colours, sort orders), and speculative attributes not clearly needed to relate these four entities.

---

### `Client`

**Invariants**

- A `Client` is a *business party* that owns zero or more projects.
- `id` uniquely identifies a client across the whole system and is never reused.
- `displayName` is a human-facing name that:
  - is non-empty after trimming whitespace.
  - has no leading or trailing whitespace.
- `referenceCode`, when present:
  - is stable over time for a given client (not used for transient UI labels).
  - is unique *within* that client’s business context (e.g. if used, it must not collide between two real clients).

**Explicitly NOT allowed**

- No persistence details: no database primary keys, sync versions, `createdAt`, `updatedAt`, `deletedAt`, etc.
- No contact or billing data (emails, addresses, rates, tax ids).
- No UI-only metadata (favourite flags, pinning, UI colours, local sorting hints).


---

### `Project`

**Invariants**

- Every `Project` belongs to **exactly one** `Client` via `clientId`.
- `id` is globally unique and never reused for another project.
- `name`:
  - is non-empty after trimming.
  - has no leading or trailing whitespace.
- `sourceLanguage`:
  - is a valid `LanguageCode` for the project’s source.
- `targetLanguages`:
  - contains at least one entry (a project without targets is not a translation project).
  - contains no duplicates.
  - must not include `sourceLanguage`.
- `status`:
  - must always be one of a small, closed set of domain states.
  - once a project reaches `archived`, it is not allowed to return to an “active” status (this is a domain rule, not a persistence rule).

**Explicitly NOT allowed**

- No persistence metadata (`createdAt`, `updatedAt`, `version`, `syncState`, etc.).
- No assignment/scheduling details (who is translating, due dates, calendars).
- No pricing or financial data.
- No UI-only data (column order, filters, expanded/collapsed states).


---

### `Segment`

**Invariants**

- Every `Segment` belongs to **exactly one** `Project` via `projectId`.
- `id` is globally unique and never reused for another segment.
- `indexWithinProject`:
  - is a non-negative integer.
  - is unique within a given project (`projectId + indexWithinProject` is a unique pair).
  - reflects the order of segments in the project’s source content (monotonic, though not necessarily gapless after edits).
- `sourceText`:
  - is non-empty after trimming (segments are not allowed to be empty placeholders).
- `sourceLanguage`:
  - must be equal to the owning project’s `sourceLanguage`.
- `isLocked`:
  - `true` implies the segment’s translatable content is frozen against normal editing operations (only special workflows may change it).

**Explicitly NOT allowed**

- No UI decoration (highlight colours, inline comments for display, editor cursor positions).
- No persistence-related metadata (revision counters, audit logs, TM hit scores, etc.).
- No target-text content here that bakes in a specific translation memory or multi-lingual structure; those can be layered with separate domain types later.


---

### `Snapshot`

**Invariants**

- A `Snapshot` is always tied to **exactly one** `Project` via `projectId`.
- `id` is globally unique and never reused for another snapshot.
- `projectId` must match `projectState.id`.
- `label`, when present:
  - is non-empty after trimming.
  - is intended for human identification of the snapshot (e.g. “Before QA pass”), not as a key in persistence.
- `createdAtEpochMs`:
  - is a non-negative integer representing milliseconds since Unix epoch.
  - is immutable once set (snapshots are immutable records).
- `segmentsState`:
  - includes only segments that belong to the project (`segment.projectId === projectId` for all items).
  - reflects a coherent state at a single logical point in time (no mixing of segments from different revisions).
- A snapshot is **immutable**: once created, its captured `projectState` and `segmentsState` must never change.

**Explicitly NOT allowed**

- No storage or sync metadata (database primary keys, file URIs, device ids, CRDT clocks, sync vector clocks).
- No UI state (which segments were visible, scroll position, filters applied).
- No cross-project bundling: a snapshot never spans multiple projects.
