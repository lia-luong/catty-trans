// Aggregate state for a single translation project in the CAT/TMS core domain.
// This type ties together the project metadata, its source segments, and the
// per-language target segments, without introducing any persistence, UI, or
// runtime-specific concerns. It lives in the `state` subtree to keep all
// core state models and transitions grouped in one place.

import type { LanguageCode, Project, Segment } from './domain-entities';
import type {
  TargetSegment,
  TargetSegmentId,
  TargetSegmentStatus,
} from './translation-types';

// ProjectState represents the in-memory domain state for one project, used as
// input and output for pure state-transition functions in core-domain.
export type ProjectState = {
  // The project metadata for this state.
  // Invariant: all segments and targetSegments in this structure must share
  // this project's id as their projectId.
  readonly project: Project;

  // The ordered collection of source segments for this project.
  // Invariants:
  // - Every segment.projectId === project.id.
  // - indexWithinProject values are unique per project.
  readonly segments: ReadonlyArray<Segment>;

  // The collection of target segments for this project across all target
  // languages.
  // Invariants:
  // - Every targetSegment.projectId === project.id.
  // - Every targetSegment.targetLanguage is included in project.targetLanguages.
  // - No targetSegment.targetLanguage equals project.sourceLanguage.
  readonly targetSegments: ReadonlyArray<TargetSegment>;
};

// TranslationChange describes a single, explicit update to a translation for
// one segment and one target language within a project. Callers are responsible
// for providing valid identifiers; this type deliberately avoids any id
// generation or persistence concerns.
export type TranslationChange = {
  // The project to which this change applies.
  // Invariant: must equal previousState.project.id when applied.
  readonly projectId: Project['id'];

  // The source segment being translated or updated.
  // Invariant: must reference a Segment.id present in previousState.segments
  // with matching projectId.
  readonly segmentId: Segment['id'];

  // The target language for this translation change.
  // Invariants when applied:
  // - Must be present in previousState.project.targetLanguages.
  // - Must not equal previousState.project.sourceLanguage.
  readonly targetLanguage: LanguageCode;

  // The identifier to use if a new TargetSegment must be created for this
  // (segmentId, targetLanguage) pair. When a TargetSegment already exists,
  // the existing id is preserved, and this field is ignored by the domain.
  // Invariant: callers must provide a stable id; the function will not create one.
  readonly targetSegmentId: TargetSegmentId;

  // The new translated text to store for this segment and language.
  readonly newText: string;

  // The new workflow status for this translation.
  readonly newStatus: TargetSegmentStatus;
};

// applyTranslationChange is the core-domain entry point for updating or
// creating a translation for a single segment and target language in a
// project. It is deliberately pure and deterministic: given the same previous
// state and change, it always returns the same new state and never mutates
// its inputs or performs any IO.
export function applyTranslationChange(
  previous: ProjectState,
  change: TranslationChange,
): ProjectState {
  // If the change does not belong to this project, leave state unchanged.
  if (change.projectId !== previous.project.id) {
    return previous;
  }

  // Disallow changes once a project is archived; archived work is immutable
  // from the domain's perspective.
  if (previous.project.status === 'archived') {
    return previous;
  }

  // Ensure the target language is valid for this project and not the source.
  const { sourceLanguage, targetLanguages } = previous.project;
  const isValidTargetLanguage =
    change.targetLanguage !== sourceLanguage &&
    targetLanguages.includes(change.targetLanguage);

  if (!isValidTargetLanguage) {
    return previous;
  }

  // Ensure the referenced source segment exists and belongs to this project.
  const segmentExists = previous.segments.some(
    (segment) =>
      segment.id === change.segmentId &&
      segment.projectId === previous.project.id,
  );

  if (!segmentExists) {
    return previous;
  }

  // Find an existing target segment for this (segmentId, targetLanguage) pair.
  const existingIndex = previous.targetSegments.findIndex(
    (target) =>
      target.segmentId === change.segmentId &&
      target.targetLanguage === change.targetLanguage &&
      target.projectId === previous.project.id,
  );

  // If a target segment already exists, update it immutably inside a new array.
  if (existingIndex >= 0) {
    const updatedTargetSegments = previous.targetSegments.map(
      (target, index) => {
        if (index !== existingIndex) {
          return target;
        }

        // Preserve id and structural invariants; only the translatedText and
        // status are changed in this operation.
        return {
          ...target,
          translatedText: change.newText,
          status: change.newStatus,
        };
      },
    );

    // Return a new ProjectState object to preserve immutability guarantees.
    return {
      ...previous,
      targetSegments: updatedTargetSegments,
    };
  }

  // Otherwise, create a new TargetSegment entry for this translation and append
  // it to a new array, leaving the original array untouched.
  const newTarget: TargetSegment = {
    id: change.targetSegmentId,
    projectId: previous.project.id,
    segmentId: change.segmentId,
    targetLanguage: change.targetLanguage,
    translatedText: change.newText,
    status: change.newStatus,
  };

  return {
    ...previous,
    targetSegments: [...previous.targetSegments, newTarget],
  };
}



