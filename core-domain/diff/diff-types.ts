// Linguistic diff types for the CAT/TMS core domain.
// This module defines pure types and function signatures for detecting semantic
// changes between project states. Diffs explain WHAT changed and WHY, not
// character-level edits.
//
// Core principle: A diff must always explain what happened, and never guess
// at causation when provenance is unclear.
//
// Architecture constraint: This module must NEVER import from adapters, UI, or
// runtime layers. All file I/O, export formatting, and side effects belong in
// adapters that call these pure functions.

import type { ProjectState } from '../state/project-state';
import type { ProjectId, SegmentId, SnapshotId } from '../state/domain-entities';
import type { TargetSegmentStatus } from '../state/translation-types';
import type { DiffCompleteness } from './diff-limits';
import { diffSegment, explainChangeCause } from './diff-segment';
import { 
  checkDiffFeasibility, 
  MAX_CHANGES_RETURNED,
  getPartialDiffExplanation,
} from './diff-limits';

// Type alias for change classification. Linguistic, not textual.
export type ChangeType = 'created' | 'modified' | 'deleted' | 'unchanged';

// Describes what caused a change. Never guesses TM involvement without evidence.
//
// Invariants:
// - 'manual_edit': Translator or admin explicitly changed the value
// - 'tm_insert': Change was caused by accepting a TM match suggestion
// - 'unknown': No provenance available; absence of evidence is not evidence of cause
//
// Business intent: enables audit trails and defensibility. When cause is unknown,
// honesty is better than speculation.
export type ChangeCause = 'manual_edit' | 'tm_insert' | 'unknown';

// Captures the target language translation state for a segment at a point in time.
// This is the before/after snapshot needed to explain what changed.
//
// Invariants:
// - translatedText can be empty string (representing "no translation yet")
// - status reflects current workflow state
// - targetLanguage identifies which translation this represents
//
// Business intent: enables diffs to explain the complete before/after context
// without character-level granularity (no insertions/deletions, only full text).
export type SegmentState = {
  // The target language translation for this segment.
  readonly translatedText: string;

  // Workflow status of the translation (draft, translated, approved).
  readonly status: TargetSegmentStatus;

  // Which language this translation is in.
  readonly targetLanguage: string;
};

// Branded identifier for terminology entries. Placeholder for future terminology
// domain; currently used only in type structure.
export type TermId = string & { readonly _tag: 'TermId' };

// Captures term state before/after change. Placeholder for future terminology
// domain implementation.
export type TermState = {
  // Placeholder: term-level metadata will be defined when terminology domain exists
  readonly _placeholder: never;
};

// Captures TM attribution when a segment change was caused by accepting a TM match.
// Enables translators to prove where a TM-driven translation came from.
//
// Invariants:
// - sourceProjectId must reference a valid project
// - sourceSnapshotId must reference a valid snapshot from the source project
// - Both fields are required when attribution is present (no partial attribution)
//
// Business intent: enables accountability and defensibility. When a translator
// accepts a TM match, the diff records exactly which project and snapshot
// contributed the entry, enabling audit trails and dispute resolution.
export type TMAttribution = {
  // The project that contributed the TM entry.
  // Enables tracking which project's approved work was reused.
  readonly sourceProjectId: ProjectId;

  // The snapshot the TM entry came from.
  // Enables precise audit trails: "this TM entry existed in this snapshot at this time".
  readonly sourceSnapshotId: SnapshotId;
};

// A single segment diff between two snapshots. Explains what changed to a segment
// and why, without inventing causation.
//
// Invariants:
// - changeType is 'unchanged' when before and after are identical
// - changeType is 'created' when before is undefined
// - changeType is 'deleted' when after is undefined
// - cause is never inferred; it is either known or 'unknown'
// - If before and after are both present, they must differ semantically
// - tmAttribution is present only when cause === 'tm_insert'
// - tmAttribution is never populated without explicit TM provenance evidence
//
// Business intent: enables translators to understand why a segment changed and
// prove to clients that changes were intentional or TM-driven, not accidental.
// TM attribution provides the complete audit trail for TM-driven changes.
export type SegmentDiff = {
  // The segment identifier this change affects.
  readonly segmentId: SegmentId;

  // What kind of change occurred: created, modified, deleted, or unchanged.
  readonly changeType: ChangeType;

  // Why this change occurred: manual edit, TM insert, or unknown provenance.
  readonly cause: ChangeCause;

  // Segment state before the change (undefined for created).
  readonly before?: SegmentState;

  // Segment state after the change (undefined for deleted).
  readonly after?: SegmentState;

  // Source text for context. Always present to enable explainability.
  readonly sourceText: string;

  // TM attribution when this change was caused by accepting a TM match.
  // Present only when cause === 'tm_insert'; undefined otherwise.
  //
  // When populated, provides the complete audit trail:
  // - sourceProjectId: which project contributed this TM entry
  // - sourceSnapshotId: which snapshot the TM entry came from
  //
  // Business intent: enables translators to prove TM involvement and defend
  // their work. Clients can verify that the TM entry came from their own
  // previously approved work.
  readonly tmAttribution?: TMAttribution;
};

// A single term diff between two snapshots. Placeholder for future terminology
// domain.
export type TermDiff = {
  // The term identifier this change affects.
  readonly termId: TermId;

  // What kind of change occurred.
  readonly changeType: ChangeType;

  // Why this change occurred.
  readonly cause: ChangeCause;

  // Term state before the change (undefined for created).
  readonly before?: TermState;

  // Term state after the change (undefined for deleted).
  readonly after?: TermState;
};

// Discriminated union: a diff unit is either a segment or a term change.
// The `kind` field enables safe type narrowing.
export type DiffUnit =
  | ({ readonly kind: 'segment' } & SegmentDiff)
  | ({ readonly kind: 'term' } & TermDiff);

// Summary statistics for diff results.
export type DiffSummary = {
  // Count of segments/terms newly created.
  readonly created: number;

  // Count of segments/terms modified.
  readonly modified: number;

  // Count of segments/terms deleted.
  readonly deleted: number;

  // Count of segments/terms unchanged.
  readonly unchanged: number;
};

// Complete diff result comparing two snapshots. References snapshots by ID,
// not full state, to maintain auditability without storing redundant state.
//
// Invariants:
// - fromSnapshotId and toSnapshotId must be distinct
// - changes contains all diffs between the two snapshots (up to MAX_CHANGES_RETURNED)
// - summary counts must match changes array lengths
// - All changes must belong to the same project
// - completeness status must match changes array length:
//   - 'complete': all changes are present
//   - 'partial': changes array is truncated; totalChangesBeforeTruncation is set
//   - 'refused': changes array is empty (computation was not attempted)
// - totalChangesBeforeTruncation is present only when completeness.status === 'partial'
//
// Business intent: explains everything that changed between two snapshots,
// with snapshot IDs enabling historical audit trails and "what was state at
// time X" queries. Always communicates completeness to prevent silent truncation.
export type DiffResult = {
  // The snapshot this diff starts from (baseline).
  readonly fromSnapshotId: SnapshotId;

  // The snapshot this diff compares to (target).
  readonly toSnapshotId: SnapshotId;

  // All changes detected between the two snapshots.
  // May be partial if completeness.status is 'partial'.
  readonly changes: ReadonlyArray<DiffUnit>;

  // Summary statistics about the changes.
  readonly summary: DiffSummary;

  // Completeness status describing whether this diff is complete, partial, or refused.
  // Never undefined; always communicates to users what they're seeing.
  //
  // Business intent: Ensures users always know if results are truncated or omitted.
  // Silent truncation is forbidden; all degradation is explicit.
  readonly completeness: DiffCompleteness;

  // Total number of changes detected before truncation (for partial diffs).
  // Present only when completeness.status === 'partial'.
  // Enables users to understand the true scope of what changed.
  //
  // Example: if totalChangesBeforeTruncation is 8,234 and changes.length is 5,000,
  // the diff returned the first 5,000 of 8,234 detected changes.
  readonly totalChangesBeforeTruncation?: number;
};

// Diff computation function signature (implementation).
// This is a pure function: given two project states, returns a linguistic diff.
// No file I/O, no side effects, fully deterministic.
//
// Example usage:
//   const fromState = loadProjectStateFromAdapter(db, snapshotId1); // Adapter: side effect
//   const toState = loadProjectStateFromAdapter(db, snapshotId2); // Adapter: side effect
//   const diff = computeDiff(fromState, toState, snapshotId1, snapshotId2); // Domain: pure
export function computeDiff(
  fromState: ProjectState,
  toState: ProjectState,
  fromSnapshotId: SnapshotId,
  toSnapshotId: SnapshotId,
): DiffResult {
  // Check feasibility based on segment count (use max of from/to states)
  const segmentCount = Math.max(fromState.segments.length, toState.segments.length);
  const feasibility = checkDiffFeasibility(segmentCount);
  
  // If diff is refused (exceeds limits), return empty result with refused status
  if (feasibility.status === 'refused') {
    return {
      fromSnapshotId,
      toSnapshotId,
      changes: [],
      summary: { created: 0, modified: 0, deleted: 0, unchanged: 0 },
      completeness: feasibility,
    };
  }
  
  // Build maps for efficient lookup of target segments by (segmentId, targetLanguage)
  const fromTargetMap = new Map<string, typeof fromState.targetSegments[0]>();
  const toTargetMap = new Map<string, typeof toState.targetSegments[0]>();
  
  for (const target of fromState.targetSegments) {
    const key = `${target.segmentId}:${target.targetLanguage}`;
    fromTargetMap.set(key, target);
  }
  
  for (const target of toState.targetSegments) {
    const key = `${target.segmentId}:${target.targetLanguage}`;
    toTargetMap.set(key, target);
  }
  
  // Build map of source segments for quick lookup (from toState, as it's the current)
  const sourceSegmentMap = new Map<string, typeof toState.segments[0]>();
  for (const segment of toState.segments) {
    sourceSegmentMap.set(segment.id, segment);
  }
  // Fallback to fromState segments if not in toState (for deleted segments)
  for (const segment of fromState.segments) {
    if (!sourceSegmentMap.has(segment.id)) {
      sourceSegmentMap.set(segment.id, segment);
    }
  }
  
  // Collect all unique (segmentId, targetLanguage) pairs from both states
  const allKeys = new Set<string>();
  for (const target of fromState.targetSegments) {
    allKeys.add(`${target.segmentId}:${target.targetLanguage}`);
  }
  for (const target of toState.targetSegments) {
    allKeys.add(`${target.segmentId}:${target.targetLanguage}`);
  }
  
  // Compute diff for each (segmentId, targetLanguage) pair
  const changes: DiffUnit[] = [];
  let created = 0;
  let modified = 0;
  let deleted = 0;
  let unchanged = 0;
  
  for (const key of allKeys) {
    const fromTarget = fromTargetMap.get(key);
    const toTarget = toTargetMap.get(key);
    
    // Extract segmentId from key
    const segmentId = key.split(':')[0];
    const sourceSegment = sourceSegmentMap.get(segmentId);
    
    // Skip if source segment doesn't exist (should not happen in practice)
    if (!sourceSegment) {
      continue;
    }
    
    // Convert TargetSegment to SegmentDiffInput
    const fromInput = fromTarget ? {
      translatedText: fromTarget.translatedText,
      status: fromTarget.status,
      targetLanguage: fromTarget.targetLanguage,
      // Note: TM provenance not tracked in current TargetSegment type
      // Future: add tmProvenance field to TargetSegment
    } : undefined;
    
    const toInput = toTarget ? {
      translatedText: toTarget.translatedText,
      status: toTarget.status,
      targetLanguage: toTarget.targetLanguage,
      // Note: TM provenance not tracked in current TargetSegment type
    } : undefined;
    
    // Compute segment-level diff
    const segmentDiff = diffSegment(
      segmentId as SegmentId,
      sourceSegment.sourceText,
      fromInput,
      toInput,
    );
    
    // Create DiffUnit and update counters
    const diffUnit: DiffUnit = {
      kind: 'segment',
      ...segmentDiff,
    };
    
    changes.push(diffUnit);
    
    // Update summary counters
    switch (segmentDiff.changeType) {
      case 'created':
        created++;
        break;
      case 'modified':
        modified++;
        break;
      case 'deleted':
        deleted++;
        break;
      case 'unchanged':
        unchanged++;
        break;
    }
    
    // Check if we've exceeded the maximum number of changes to return
    if (changes.length >= MAX_CHANGES_RETURNED) {
      break;
    }
  }
  
  // Determine completeness status
  const totalChanges = created + modified + deleted + unchanged;
  let completeness: DiffCompleteness;
  
  if (changes.length < totalChanges) {
    // Partial result: truncated at MAX_CHANGES_RETURNED
    completeness = {
      status: 'partial',
      truncatedAt: changes.length,
      reason: getPartialDiffExplanation(changes.length, totalChanges),
    };
  } else {
    // Complete result: all changes included
    completeness = {
      status: 'complete',
    };
  }
  
  return {
    fromSnapshotId,
    toSnapshotId,
    changes,
    summary: { created, modified, deleted, unchanged },
    completeness,
    totalChangesBeforeTruncation: changes.length < totalChanges ? totalChanges : undefined,
  };
}

// Filter diff units by change type (to be implemented).
// Pure function that filters a diff result's changes.
export function filterDiffByChangeType(
  diff: DiffResult,
  changeTypes: ReadonlyArray<ChangeType>,
): ReadonlyArray<DiffUnit> {
  // Convert changeTypes array to Set for O(1) lookup
  const changeTypeSet = new Set(changeTypes);
  
  // Filter changes array to only include matching change types
  // This is pure and deterministic: same inputs always produce same output
  return diff.changes.filter((unit) => changeTypeSet.has(unit.changeType));
}

// Explain what changed in human-readable format (to be implemented).
// Pure function that generates explainable descriptions of changes.
export function explainDiff(diff: DiffResult): ReadonlyArray<string> {
  const explanations: string[] = [];
  
  // Add summary line
  const { created, modified, deleted, unchanged } = diff.summary;
  const totalChanges = created + modified + deleted;
  
  if (totalChanges === 0) {
    explanations.push('No changes detected between snapshots.');
    return explanations;
  }
  
  explanations.push(
    `Total changes: ${totalChanges} (${created} created, ${modified} modified, ${deleted} deleted)`
  );
  
  // Add completeness status if partial or refused
  if (diff.completeness.status === 'partial') {
    explanations.push(`⚠️  ${diff.completeness.reason}`);
  } else if (diff.completeness.status === 'refused') {
    explanations.push(`❌ ${diff.completeness.reason}`);
    return explanations; // No changes to explain if refused
  }
  
  // Group changes by type for clearer explanation
  const createdChanges = diff.changes.filter((u) => u.changeType === 'created');
  const modifiedChanges = diff.changes.filter((u) => u.changeType === 'modified');
  const deletedChanges = diff.changes.filter((u) => u.changeType === 'deleted');
  
  // Explain created changes
  if (createdChanges.length > 0) {
    explanations.push('');
    explanations.push(`Created translations (${createdChanges.length}):`);
    for (const change of createdChanges.slice(0, 10)) { // Limit to first 10 for brevity
      if (change.kind === 'segment') {
        const causeExplanation = explainChangeCause(change.cause);
        explanations.push(
          `  • Segment "${change.sourceText.substring(0, 50)}${change.sourceText.length > 50 ? '...' : ''}" → "${change.after?.translatedText.substring(0, 50) ?? ''}${(change.after?.translatedText?.length ?? 0) > 50 ? '...' : ''}" (${causeExplanation})`
        );
      }
    }
    if (createdChanges.length > 10) {
      explanations.push(`  ... and ${createdChanges.length - 10} more`);
    }
  }
  
  // Explain modified changes
  if (modifiedChanges.length > 0) {
    explanations.push('');
    explanations.push(`Modified translations (${modifiedChanges.length}):`);
    for (const change of modifiedChanges.slice(0, 10)) {
      if (change.kind === 'segment') {
        const causeExplanation = explainChangeCause(change.cause);
        explanations.push(
          `  • Segment "${change.sourceText.substring(0, 50)}${change.sourceText.length > 50 ? '...' : ''}": "${change.before?.translatedText ?? ''}" → "${change.after?.translatedText ?? ''}" (${causeExplanation})`
        );
      }
    }
    if (modifiedChanges.length > 10) {
      explanations.push(`  ... and ${modifiedChanges.length - 10} more`);
    }
  }
  
  // Explain deleted changes
  if (deletedChanges.length > 0) {
    explanations.push('');
    explanations.push(`Deleted translations (${deletedChanges.length}):`);
    for (const change of deletedChanges.slice(0, 10)) {
      if (change.kind === 'segment') {
        explanations.push(
          `  • Segment "${change.sourceText.substring(0, 50)}${change.sourceText.length > 50 ? '...' : ''}": "${change.before?.translatedText ?? ''}" removed`
        );
      }
    }
    if (deletedChanges.length > 10) {
      explanations.push(`  ... and ${deletedChanges.length - 10} more`);
    }
  }
  
  return explanations;
}