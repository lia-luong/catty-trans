// Translation-related domain types for the CAT/TMS core domain.
// These types describe how target-language content is represented per segment,
// without encoding any persistence, UI, or runtime concerns.

import type { LanguageCode, ProjectId, SegmentId } from './domain-entities';

// Branded identifier for target segments to keep their id space distinct from
// projects, source segments, and other entities in the CAT/TMS.
export type TargetSegmentId = string & { readonly _tag: 'TargetSegmentId' };

// High-level lifecycle stages for a target segment's translation.
// These statuses are domain concepts (e.g. for workflow rules), not UI labels.
export type TargetSegmentStatus =
  | 'draft' // Text exists but may be incomplete or unverified.
  | 'translated' // Linguistically complete but not yet approved in workflow.
  | 'approved'; // Accepted as final for this project and language.

// A TargetSegment represents one target-language rendering of a single source
// segment within a given project. It intentionally does not contain any
// persistence metadata, UI flags, or integration-specific fields.
export type TargetSegment = {
  // Identifier for this specific target segment in the domain.
  // Invariant: unique across all target segments and never reused.
  readonly id: TargetSegmentId;

  // The project this target segment belongs to.
  // Invariant: must reference an existing Project.id.
  readonly projectId: ProjectId;

  // The source segment this target segment translates.
  // Invariant: must reference an existing Segment.id whose projectId equals this projectId.
  readonly segmentId: SegmentId;

  // The target language of the translatedText.
  // Invariants:
  // - Must be present in the owning project's targetLanguages.
  // - Must not equal the project's sourceLanguage.
  readonly targetLanguage: LanguageCode;

  // The translated content for this segment in the targetLanguage.
  // Invariant: an empty string represents "no translation yet"; callers decide
  // how to interpret or restrict this, but persistence/validation live elsewhere.
  readonly translatedText: string;

  // The workflow status of this translation for the given project and language.
  // Invariant: reflects a single, current state; historical changes belong in
  // separate audit or history structures outside this type.
  readonly status: TargetSegmentStatus;
};

