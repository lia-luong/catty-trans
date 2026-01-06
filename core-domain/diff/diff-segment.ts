// Pure diff computation for segment translation changes.
// This module implements explainable change detection that answers "what changed
// and why" without guessing at causation when provenance is unavailable.
//
// Architecture constraint: This module must NEVER import from adapters, UI, or
// runtime layers. All file I/O, export formatting, and side effects belong in
// adapters that call these pure functions.

import type { ProjectId, SegmentId, SnapshotId } from '../state/domain-entities';
import type { SegmentState, SegmentDiff, ChangeCause, ChangeType, TMAttribution } from './diff-types';

// Input for segment diff computation, extending SegmentState with optional TM provenance.
//
// Invariants:
// - All inherited SegmentState fields remain valid
// - tmProvenance is optional; absence means cause cannot be 'tm_insert'
// - When tmProvenance exists, projectId and snapshotId are required (not optional)
//
// Business intent: enables diff function to detect TM-driven changes only when
// explicit provenance exists. If provenance is missing, cause defaults to 'unknown'
// rather than inferring TM involvement.
export type SegmentDiffInput = SegmentState & {
  // If this state resulted from accepting a TM match, reference the TM entry's origin.
  // Presence of this field is evidence that the change was TM-driven.
  //
  // When undefined, the change cannot be attributed to TM; cause will be 'unknown'.
  readonly tmProvenance?: {
    // The project that created the TM entry.
    readonly projectId: ProjectId;

    // The snapshot the TM entry came from, enabling audit trails.
    readonly snapshotId: SnapshotId;
  };
};

// Pure function to detect and classify a segment's change between two states.
// Answers "what changed?" and "why?" without inventing provenance.
//
// Signature is optimised for clarity: each input is explicit rather than bundled.
// This makes the function's contract and responsibilities unmistakable.
//
// Invariants:
// - Same inputs always produce identical output (deterministic)
// - No side effects, I/O, or state mutation
// - changeType is 'unchanged' only when before and after are semantically identical
// - cause is 'unknown' unless tmProvenance explicitly provides evidence
// - If changeType is 'created', cause reflects whether creation was TM-driven
// - If changeType is 'deleted', cause is always 'unknown' (deletions have no TM cause)
//
// Business intent: enables translators to defend their work. A diff that says
// 'tm_insert' proves TM involvement; one that says 'unknown' is honest when
// provenance is unavailable. Both are preferable to guessing.
export function diffSegment(
  segmentId: SegmentId,
  sourceText: string,
  before: SegmentDiffInput | undefined,
  after: SegmentDiffInput | undefined,
): SegmentDiff {
  // Determine changeType first: the classification of what happened (created/modified/etc).
  const changeType = determineChangeType(before, after);

  // Determine cause: why the change happened (manual_edit/tm_insert/unknown).
  // Cause depends on both changeType and available provenance.
  const cause = determineCause(changeType, before, after);

  // Determine TM attribution if cause is 'tm_insert'.
  // Only populate attribution when there is explicit evidence of TM involvement.
  const tmAttribution = determineTMAttribution(cause, after);

  // Construct the diff result with all required context.
  return {
    segmentId,
    changeType,
    cause,
    before,
    after,
    sourceText,
    tmAttribution,
  };
}

// Classifies what kind of change occurred based on before/after states.
// Pure helper function to keep logic isolated and testable.
//
// Rules:
// - 'created': after exists, before does not
// - 'deleted': before exists, after does not
// - 'unchanged': both exist and are semantically identical
// - 'modified': both exist and differ
//
// Semantic equivalence is defined as: translatedText, status, and targetLanguage
// are all identical. tmProvenance does not affect semantic equivalence.
function determineChangeType(
  before: SegmentDiffInput | undefined,
  after: SegmentDiffInput | undefined,
): ChangeType {
  // Creation: new segment translation did not exist before.
  if (before === undefined && after !== undefined) {
    return 'created';
  }

  // Deletion: segment translation existed but was removed.
  if (before !== undefined && after === undefined) {
    return 'deleted';
  }

  // Both undefined: this is a programming error; never occurs in practice.
  if (before === undefined && after === undefined) {
    return 'unchanged';
  }

  // Both exist: compare semantic content to determine modified or unchanged.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const beforeValue = before!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const afterValue = after!;

  const isSemanticallySame =
    beforeValue.translatedText === afterValue.translatedText &&
    beforeValue.status === afterValue.status &&
    beforeValue.targetLanguage === afterValue.targetLanguage;

  return isSemanticallySame ? 'unchanged' : 'modified';
}

// Determines the cause of a change based on changeType and TM provenance evidence.
// Pure helper function to keep causation logic isolated and testable.
//
// Critical principle: cause is 'unknown' unless explicit TM provenance exists on
// the after state. Never infer TM involvement without evidence.
//
// Rules:
// - 'created' with after.tmProvenance → 'tm_insert'
// - 'created' without after.tmProvenance → 'unknown'
// - 'deleted' → 'unknown' (deletions never have TM cause)
// - 'modified' with after.tmProvenance → 'tm_insert'
// - 'modified' without after.tmProvenance → 'unknown'
// - 'unchanged' → 'unknown' (no cause for changes that didn't happen)
function determineCause(
  changeType: ChangeType,
  before: SegmentDiffInput | undefined,
  after: SegmentDiffInput | undefined,
): ChangeCause {
  // Deletions are administrative or manual; no TM involvement.
  if (changeType === 'deleted') {
    return 'unknown';
  }

  // Unchanged: no change occurred, so no cause to report.
  if (changeType === 'unchanged') {
    return 'unknown';
  }

  // Creation or modification: check if after state has TM provenance.
  // If it does, the change was TM-driven. If not, we don't know the cause.
  if (after !== undefined && after.tmProvenance !== undefined) {
    return 'tm_insert';
  }

  // No provenance: honest admission of unknown causation.
  return 'unknown';
}

// Determines TM attribution for a change if cause is 'tm_insert'.
// Pure helper function that translates input provenance to diff output.
//
// Critical principle: tmAttribution is present if and only if cause === 'tm_insert'.
// Never populate attribution without explicit evidence.
//
// Rules:
// - cause === 'tm_insert' and after.tmProvenance exists → populate TMAttribution
// - cause === 'tm_insert' but no provenance → should not happen (logic error)
// - cause !== 'tm_insert' → no attribution
function determineTMAttribution(
  cause: ChangeCause,
  after: SegmentDiffInput | undefined,
): TMAttribution | undefined {
  // Only populate attribution for TM-driven changes.
  if (cause !== 'tm_insert') {
    return undefined;
  }

  // For TM-driven changes, provenance must exist on the after state.
  if (after === undefined || after.tmProvenance === undefined) {
    // This should not happen: if cause is 'tm_insert', provenance must exist.
    // But we handle it defensively by returning undefined rather than guessing.
    return undefined;
  }

  // Extract provenance from the after state and expose it as attribution.
  return {
    sourceProjectId: after.tmProvenance.projectId,
    sourceSnapshotId: after.tmProvenance.snapshotId,
  };
}

// Provides a human-readable explanation of a ChangeCause value for display in UIs.
// This function translates technical enum values into user-friendly strings that
// help translators understand why a change occurred, without requiring knowledge
// of system internals.
//
// Business intent: Prevents user confusion when "unknown" appears in diff results.
// The "unknown" cause is honest (absence of provenance), not an error, but needs
// explanation to avoid being misinterpreted as a system failure.
//
// Invariants:
// - Returns non-empty string for all ChangeCause values
// - Does not use error terminology ("failed", "missing", "corrupted") for "unknown"
// - Provides actionable context where possible
//
// Example usage:
//   const cause: ChangeCause = 'unknown';
//   const explanation = explainChangeCause(cause);
//   // explanation: "No provenance captured (manual edit or TM without tracking)"
export function explainChangeCause(cause: ChangeCause): string {
  switch (cause) {
    case 'tm_insert':
      return 'Translation applied from TM match';
    case 'manual_edit':
      return 'Manually edited by translator';
    case 'unknown':
      return 'No provenance captured (manual edit or TM without tracking)';
  }
}

