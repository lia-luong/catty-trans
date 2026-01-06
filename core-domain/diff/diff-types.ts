// Change detection and diff computation types for the CAT/TMS core domain.
// This module defines pure types and function signatures for computing diffs
// between project states.
//
// Architecture constraint: This module must NEVER import from adapters, UI, or
// runtime layers. All file I/O, export formatting, and side effects belong in
// adapters that call these pure functions.

import type { ProjectState } from '../state/project-state';
import type { SegmentId } from '../state/domain-entities';
import type { TargetSegmentStatus } from '../state/translation-types';

// A single change detected between two project states.
export type DiffEntry = {
  // The segment ID this change affects.
  readonly segmentId: SegmentId;

  // The type of change detected.
  readonly changeType: 'created' | 'modified' | 'deleted' | 'unchanged';

  // Source text (always present for context).
  readonly sourceText: string;

  // Target segment state before the change (if applicable).
  readonly before?: {
    readonly translatedText: string;
    readonly status: TargetSegmentStatus;
    readonly targetLanguage: string;
  };

  // Target segment state after the change (if applicable).
  readonly after?: {
    readonly translatedText: string;
    readonly status: TargetSegmentStatus;
    readonly targetLanguage: string;
  };
};

// Complete diff result comparing two project states.
export type DiffResult = {
  // The "from" state (baseline for comparison).
  readonly fromState: ProjectState;

  // The "to" state (target for comparison).
  readonly toState: ProjectState;

  // All changes detected between the two states.
  readonly changes: ReadonlyArray<DiffEntry>;

  // Summary statistics.
  readonly summary: {
    readonly created: number;
    readonly modified: number;
    readonly deleted: number;
    readonly unchanged: number;
  };
};

// Diff computation function signature (to be implemented).
// This is a pure function: given two project states, returns a diff structure.
// No file I/O, no side effects, fully deterministic.
//
// Example usage:
//   const fromState = loadProjectStateFromAdapter(db, snapshotId1); // Adapter: side effect
//   const toState = loadProjectStateFromAdapter(db, snapshotId2); // Adapter: side effect
//   const diff = computeDiff(fromState, toState); // Domain: pure function
export function computeDiff(
  fromState: ProjectState,
  toState: ProjectState,
): DiffResult {
  // TODO: Implement pure diff computation algorithm
  // Must compare two ProjectState objects and detect all changes
  // Must be deterministic: same inputs always produce same output
  // Must not perform any IO, file access, or side effects
  throw new Error('Not yet implemented');
}

// Filter diff entries by change type (to be implemented).
// Pure function that filters a diff result's changes.
export function filterDiffByChangeType(
  diff: DiffResult,
  changeTypes: ReadonlyArray<DiffEntry['changeType']>,
): ReadonlyArray<DiffEntry> {
  // TODO: Implement filtering logic
  // Must be pure and deterministic
  throw new Error('Not yet implemented');
}

// Explain what changed in human-readable format (to be implemented).
// Pure function that generates explainable descriptions of changes.
export function explainDiff(diff: DiffResult): ReadonlyArray<string> {
  // TODO: Implement explanation generation
  // Must be pure and deterministic
  // Must provide clear, human-readable explanations of what changed
  throw new Error('Not yet implemented');
}

