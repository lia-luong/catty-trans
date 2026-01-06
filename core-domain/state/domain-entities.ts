// Core domain entities for the local-first CAT/TMS.
// This file intentionally contains only pure TypeScript types and business
// invariants; there are no persistence, UI, or runtime concerns here.

// These simple branded string types separate domain identifiers by intent,
// preventing accidental mix-ups between ids for clients, projects, segments,
// and snapshots in the CAT/TMS.
export type ClientId = string & { readonly _tag: 'ClientId' };
export type ProjectId = string & { readonly _tag: 'ProjectId' };
export type SegmentId = string & { readonly _tag: 'SegmentId' };
export type SnapshotId = string & { readonly _tag: 'SnapshotId' };

// Language codes are core domain data in a CAT/TMS (not persistence or UI);
// they allow us to express source/target directions without committing to any
// particular storage, UI, or integration format.
export type LanguageCode = string & { readonly _tag: 'LanguageCode' };

// A Client represents a business customer or internal account that owns projects.
// It is intentionally lean: only identity and a stable human-facing name.
export type Client = {
  // Stable domain identifier; unique across all clients and never reused.
  readonly id: ClientId;

  // Human-readable client name as used in contracts or project briefs.
  // Invariant: non-empty after trimming; must not have leading/trailing spaces.
  readonly displayName: string;

  // Optional stable reference used in client-facing workflows (e.g. legal or ERP codes).
  // Invariant: when present, should not change arbitrarily and must not collide
  // with another live client's reference in the same business context.
  readonly referenceCode?: string;
};

// ProjectStatus models the high-level lifecycle of a translation project.
// These statuses are domain concepts, not UI filters or system states.
export type ProjectStatus =
  | 'draft' // Project defined but not yet started for production use.
  | 'in_progress' // Translation work is actively happening.
  | 'completed' // All planned work is finished and accepted.
  | 'archived'; // Project is retained for reference only; no further changes allowed.

// A Project groups source material and segments under one client and language
// direction, without encoding assignment, billing, or storage details.
export type Project = {
  // Stable domain identifier for the project; unique system-wide.
  readonly id: ProjectId;

  // The client that owns this project.
  // Invariant: must reference an existing Client.id in the current domain state.
  readonly clientId: ClientId;

  // Human-readable project name, e.g. "Product Manual v2 – FR".
  // Invariant: non-empty after trimming; no leading/trailing whitespace.
  readonly name: string;

  // Project's source language; all segments in the project share this value.
  readonly sourceLanguage: LanguageCode;

  // One or more target languages for this project.
  // Invariants:
  // - Non-empty.
  // - No duplicates.
  // - Must not contain sourceLanguage.
  readonly targetLanguages: ReadonlyArray<LanguageCode>;

  // High-level lifecycle stage of the project.
  // Invariant: once 'archived', domain logic must not transition back to an
  // "active" state such as 'in_progress' or 'draft'.
  readonly status: ProjectStatus;
};

// A Segment represents a single unit of source content within a project
// (e.g. one sentence or heading), identified and ordered independently of UI.
export type Segment = {
  // Unique identifier for this segment across the entire system.
  readonly id: SegmentId;

  // The project this segment belongs to.
  // Invariant: must reference an existing Project.id.
  readonly projectId: ProjectId;

  // Position of this segment within the project’s ordered sequence.
  // Invariants:
  // - Integer >= 0.
  // - Unique per project (no two segments in one project share the same index).
  // - Monotonically ordered when segments are listed for that project.
  readonly indexWithinProject: number;

  // Source text content for this segment.
  // Invariant: non-empty after trimming; represents a single logical unit like
  // a sentence or heading, not arbitrary concatenations.
  readonly sourceText: string;

  // The language of the sourceText.
  // Invariant: must equal the parent project's sourceLanguage.
  readonly sourceLanguage: LanguageCode;

  // Indicates that this segment's content is frozen for normal editing flows.
  // Business intent: locked segments may be regulated content, approved legal
  // text, or imported from authoritative TMs that must not change casually.
  readonly isLocked: boolean;
};

// A ProjectSnapshot captures the state of a single project and its segments
// at a specific logical point in time, for features like undo, audit, or
// "view previous version", without exposing any persistence or UI details.
export type ProjectSnapshot = {
  // Unique identifier for this snapshot; does not duplicate any other id space.
  readonly id: SnapshotId;

  // The project whose state is captured in this snapshot.
  // Invariant: must equal projectState.id and match all segments' projectId.
  readonly projectId: ProjectId;

  // Optional human-facing label to describe the snapshot's purpose or timing,
  // e.g. "Before client review".
  // Invariant: when present, non-empty after trimming; not used as a storage key.
  readonly label?: string;

  // Milliseconds since Unix epoch when this snapshot was taken, as seen by
  // the creating runtime. This is treated as immutable event metadata, not
  // as a scheduling primitive.
  readonly createdAtEpochMs: number;

  // The captured project state at the time of the snapshot.
  // Invariant: projectState.id === projectId.
  readonly projectState: Project;

  // The captured set of segments belonging to the project at snapshot time.
  // Invariants:
  // - Every segment.projectId === projectId.
  // - Represents a self-consistent view of the segment set (no mixing of
  //   segments from multiple logical revisions).
  readonly segmentsState: ReadonlyArray<Segment>;
};

