// Versioning system for ProjectState in the CAT/TMS core domain.
// This module lives under `history` to make it clear that it owns how project
// state evolves over time (snapshots, branches, rollback), while remaining
// pure and independent from any storage or UI concerns.
//
// FAILURE SCENARIO & DATA LOSS PREVENTION:
//
// Scenario: Two users work offline, both commit snapshots from the same parent,
// creating conflicting branches. Later, one user attempts to rollback to a
// snapshot that exists in their local history but not in the merged history.
//
// How the design prevents data loss:
//
// 1. Branching preservation: When commitSnapshot detects that the current state
//    doesn't match any existing snapshot, it creates a new root branch rather
//    than forcing a merge. Both branches remain in the history graph, preserving
//    all work from both users.
//
// 2. Rollback safety: rollbackToSnapshot explicitly checks if the requested
//    snapshot exists in the history graph. If not found, it returns the original
//    VersionedState unchanged rather than throwing an error or returning undefined.
//    This prevents accidental data loss from invalid snapshot IDs.
//
// 3. Immutable snapshots: Once created, snapshots are never modified. Even if
//    rollback occurs, the original snapshot remains in the history graph,
//    allowing users to navigate between branches without losing any committed state.
//
// 4. History graph integrity: The parentMap maintains relationships between
//    snapshots, enabling traversal of all branches. No branch is ever deleted or
//    merged away, ensuring that conflicting histories remain accessible.
//
// Example: User A commits snapshot S1, User B commits snapshot S2 from the same
// parent P. Both S1 and S2 exist in the merged history. If User A rolls back to
// S1, their currentState is restored exactly, and S2 remains in history for
// User B to access. No data is lost.

import type { SnapshotId } from '../state/domain-entities';
import type { ProjectState, TranslationChange } from '../state/project-state';
import { applyTranslationChange } from '../state/project-state';

// A Snapshot captures the complete ProjectState at a specific point in time.
// Unlike ProjectSnapshot (which only captures Project + Segment[]), this
// includes targetSegments to enable full state restoration for versioning.
export type Snapshot = {
  // Unique identifier for this snapshot in the versioning system.
  // Invariant: unique across all snapshots and never reused.
  readonly id: SnapshotId;

  // The complete project state captured at the time this snapshot was created.
  // Invariant: immutable once created; all nested objects are readonly.
  readonly state: ProjectState;

  // Optional human-facing label describing when or why this snapshot was taken,
  // e.g. "Before QA review" or "After client feedback".
  // Invariant: when present, non-empty after trimming; not used as a storage key.
  readonly label?: string;

  // Milliseconds since Unix epoch when this snapshot was created.
  // Invariant: immutable once set; represents logical time, not a scheduling primitive.
  readonly createdAtEpochMs: number;
};

// HistoryGraph tracks all snapshots and their parent-child relationships,
// enabling rollback and preserving branching histories (conflicting versions).
// The graph structure allows multiple snapshots to share the same parent,
// representing divergent edit paths that are never merged.
export type HistoryGraph = {
  // Map from snapshot ID to the snapshot itself.
  // Invariant: every snapshot referenced in parentMap must exist in this map.
  readonly snapshots: ReadonlyMap<SnapshotId, Snapshot>;

  // Map from child snapshot ID to its parent snapshot ID.
  // Invariant: if snapshotId -> parentId exists, both must be in snapshots map.
  // Multiple children can share the same parent (branching is allowed).
  // A snapshot with no parent is a root (initial state).
  readonly parentMap: ReadonlyMap<SnapshotId, SnapshotId>;
};

// VersionedState combines the current ProjectState with its versioning history.
// This aggregate enables both current-state operations and historical rollback.
export type VersionedState = {
  // The current project state (the "working copy").
  readonly currentState: ProjectState;

  // The complete history graph tracking all snapshots and their relationships.
  // Invariant: currentState may or may not correspond to a snapshot in history;
  // uncommitted changes exist in currentState but not yet in history.
  readonly history: HistoryGraph;
};

// commitSnapshot applies a translation change to the current state, creates a
// new snapshot of the resulting state, and adds it to the history graph.
// The function is pure: it returns a new VersionedState without mutating inputs.
// Callers must provide snapshotId and createdAtEpochMs; the function does not
// generate IDs or access system time to maintain purity.
export function commitSnapshot(
  versioned: VersionedState,
  change: TranslationChange,
  snapshotId: SnapshotId,
  createdAtEpochMs: number,
  label?: string,
): VersionedState {
  // Apply the translation change to get the new current state.
  const newCurrentState = applyTranslationChange(
    versioned.currentState,
    change,
  );

  // If the change had no effect (e.g., invalid project or archived status),
  // return the original versioned state unchanged.
  if (newCurrentState === versioned.currentState) {
    return versioned;
  }

  // Create a new immutable snapshot capturing the new state.
  const newSnapshot: Snapshot = {
    id: snapshotId,
    state: newCurrentState,
    label,
    createdAtEpochMs,
  };

  // Build new snapshots map by adding the new snapshot.
  const newSnapshots = new Map(versioned.history.snapshots);
  newSnapshots.set(snapshotId, newSnapshot);

  // Determine the parent snapshot ID: if there's a snapshot matching the
  // current state, use it as parent; otherwise, this is a new root branch.
  // This allows branching when the current state doesn't match any existing snapshot.
  const parentSnapshotId = findMatchingSnapshot(
    versioned.history,
    versioned.currentState,
  );

  // Build new parent map, adding the parent relationship if one exists.
  const newParentMap = new Map(versioned.history.parentMap);
  if (parentSnapshotId !== null) {
    newParentMap.set(snapshotId, parentSnapshotId);
  }

  // Return new VersionedState with updated current state and history.
  return {
    currentState: newCurrentState,
    history: {
      snapshots: newSnapshots,
      parentMap: newParentMap,
    },
  };
}

// rollbackToSnapshot restores the exact ProjectState from a specific snapshot,
// returning a new VersionedState where currentState matches the snapshot's state.
// The history graph is preserved unchanged; rollback does not create new snapshots.
export function rollbackToSnapshot(
  versioned: VersionedState,
  snapshotId: SnapshotId,
): VersionedState {
  // Find the requested snapshot in the history.
  const snapshot = versioned.history.snapshots.get(snapshotId);

  // If the snapshot doesn't exist, return the original state unchanged.
  // This prevents data loss by refusing to rollback to non-existent snapshots.
  if (snapshot === undefined) {
    return versioned;
  }

  // Return a new VersionedState with currentState restored to the snapshot's state.
  // The history graph remains unchanged, preserving all branches and relationships.
  return {
    currentState: snapshot.state,
    history: versioned.history,
  };
}

// findMatchingSnapshot searches the history graph for a snapshot whose state
// exactly matches the given ProjectState. This is used to determine parent
// relationships when committing new snapshots.
// Returns null if no matching snapshot exists (indicating a new branch).
function findMatchingSnapshot(
  history: HistoryGraph,
  state: ProjectState,
): SnapshotId | null {
  // Deep equality check: compare project, segments, and targetSegments.
  // This is a simple structural comparison; for production, consider a more
  // efficient equality function if performance becomes a concern.
  for (const [id, snapshot] of history.snapshots) {
    if (areStatesEqual(snapshot.state, state)) {
      return id;
    }
  }

  return null;
}

// areStatesEqual performs a deep structural comparison of two ProjectState objects.
// This ensures that parent relationships are based on exact state matches, not
// reference equality, which is critical for preserving branching histories.
function areStatesEqual(a: ProjectState, b: ProjectState): boolean {
  // Compare project IDs (projects themselves are compared by id for efficiency).
  if (a.project.id !== b.project.id) {
    return false;
  }

  // Compare segments arrays by length and then by id and content.
  if (a.segments.length !== b.segments.length) {
    return false;
  }

  for (let i = 0; i < a.segments.length; i++) {
    const segA = a.segments[i];
    const segB = b.segments[i];
    if (
      segA.id !== segB.id ||
      segA.sourceText !== segB.sourceText ||
      segA.isLocked !== segB.isLocked
    ) {
      return false;
    }
  }

  // Compare targetSegments arrays by length and then by id, text, and status.
  if (a.targetSegments.length !== b.targetSegments.length) {
    return false;
  }

  // Create maps for efficient lookup of target segments by (segmentId, targetLanguage).
  const targetMapA = new Map<string, typeof a.targetSegments[0]>();
  const targetMapB = new Map<string, typeof b.targetSegments[0]>();

  for (const target of a.targetSegments) {
    const key = `${target.segmentId}:${target.targetLanguage}`;
    targetMapA.set(key, target);
  }

  for (const target of b.targetSegments) {
    const key = `${target.segmentId}:${target.targetLanguage}`;
    targetMapB.set(key, target);
  }

  // Compare all target segments.
  for (const [key, targetA] of targetMapA) {
    const targetB = targetMapB.get(key);
    if (
      targetB === undefined ||
      targetA.id !== targetB.id ||
      targetA.translatedText !== targetB.translatedText ||
      targetA.status !== targetB.status
    ) {
      return false;
    }
  }

  return true;
}
