// Performance limits and degradation model for diff computation.
// This module defines explicit thresholds and a failure model that never silently
// truncates results. When limits are exceeded, diffs fail loudly with honest
// explanations, preserving user trust.
//
// Core principle: Partial diffs are always labelled. Silent truncation is forbidden.

// ============================================================================
// SCALING LIMITS — ARCHITECTURAL CONSTRAINTS
// ============================================================================
//
// The diff engine operates on in-memory snapshots. Both ProjectState objects
// (from/to) are fully loaded before comparison begins.
//
// Memory footprint estimate at MAX_SEGMENTS_PER_DIFF (10,000 segments):
//   ~18-20 MB peak memory usage
//   Formula: (segmentCount * 2 * ~150 bytes) + (changesCount * ~250 bytes)
//
// IMPORTANT: Raising MAX_SEGMENTS_PER_DIFF beyond 10,000 requires architectural
// changes:
//   1. Streaming/iterator-based diff algorithm
//   2. Cursor-based segment loading from adapter
//   3. Incremental change emission (yield batches)
//
// Estimated effort for streaming refactor: 2-3 weeks
// See: docs/adr/002-state-equality-performance.md
// ============================================================================

// Threshold constant: maximum number of segments in a project that diff will
// attempt to compute. Beyond this, diff computation is refused to prevent
// resource exhaustion and ensure results remain human-reviewable.
//
// Rationale: A diff on 10,000 segments is already at the edge of usability.
// Beyond this, users should split the project or compare smaller snapshots.
export const MAX_SEGMENTS_PER_DIFF = 10_000;

// Threshold constant: maximum number of individual changes that will be included
// in a diff result. When a diff would contain more changes, the result is
// truncated and labelled as partial.
//
// Rationale: Prevents memory bloat and ensures UI can render results. Encourages
// pagination for large changesets rather than attempting to display everything.
export const MAX_CHANGES_RETURNED = 5_000;

// Threshold constant: warns user early before approaching hard limit.
// If segment count exceeds this, the result includes a warning but computation
// proceeds. Allows users to understand project size without blocking diff.
//
// Rationale: 5,000 segments is halfway to the hard limit; early warning gives
// users time to consider their workflow.
export const WARN_SEGMENTS_THRESHOLD = 5_000;

// Describes the completeness state of a diff result.
// A discriminated union enables the diff engine to communicate whether
// the result is complete, partial, or not computed at all.
//
// Business intent: Users must always know if they're seeing incomplete data.
// "Partial" diffs are explicitly labelled. Refused diffs explain why and
// suggest alternatives.
export type DiffCompleteness =
  | {
      // Diff computation succeeded and all changes are included.
      readonly status: 'complete';
    }
  | {
      // Diff computation succeeded but results were truncated at a limit.
      // The result includes the first N changes; use totalChangesBeforeTruncation
      // to understand scope.
      readonly status: 'partial';

      // The exact count where changes were cut off.
      // Result includes changes[0..truncatedAt-1].
      readonly truncatedAt: number;

      // Human-readable explanation of why truncation occurred.
      // Examples: "Exceeded 5,000 change limit", "Computation timeout approached"
      readonly reason: string;
    }
  | {
      // Diff computation was not attempted because preconditions fail.
      // Examples: project exceeds segment threshold, invalid input.
      readonly status: 'refused';

      // Human-readable explanation of why diff was refused.
      // Should include actionable suggestion if possible.
      // Example: "Project has 15,000 segments, exceeding 10,000 limit. Consider comparing smaller snapshots."
      readonly reason: string;
    };

// Determines whether a diff computation is feasible based on segment count.
// Pure helper function for checking preconditions before attempting diff.
//
// Invariants:
// - Same inputs always produce same output
// - No side effects
// - Returns refused if segment count exceeds MAX_SEGMENTS_PER_DIFF
// - Returns complete status otherwise (actual feasibility checked at compute time)
export function checkDiffFeasibility(segmentCount: number): DiffCompleteness {
  // Hard limit: refuse if segment count exceeds maximum.
  if (segmentCount > MAX_SEGMENTS_PER_DIFF) {
    return {
      status: 'refused',
      reason: `Project has ${segmentCount.toLocaleString()} segments, exceeding the ${MAX_SEGMENTS_PER_DIFF.toLocaleString()} segment limit for diff computation. Consider comparing smaller snapshots or splitting the project.`,
    };
  }

  // All preconditions pass; diff is feasible.
  return {
    status: 'complete',
  };
}

// Determines if a segment count should trigger an early warning.
// Pure helper function for providing UX feedback before computation.
//
// Invariants:
// - Same inputs always produce same output
// - No side effects
// - Returns true if approaching (but not exceeding) the hard limit
export function shouldWarnAboutProjectSize(segmentCount: number): boolean {
  return segmentCount > WARN_SEGMENTS_THRESHOLD && segmentCount <= MAX_SEGMENTS_PER_DIFF;
}

// Computes a warning message for large projects.
// Pure function that generates user-facing text.
//
// Invariants:
// - Same inputs always produce same output
// - No side effects
export function getProjectSizeWarning(segmentCount: number): string {
  return `Large project: ${segmentCount.toLocaleString()} segments. Diff computation may be slow.`;
}

// Constructs a partial diff explanation message.
// Pure function for generating user-facing text about truncated results.
//
// Invariants:
// - Same inputs always produce same output
// - No side effects
// - Message explains both what is shown and what is omitted
export function getPartialDiffExplanation(
  changesReturned: number,
  totalChanges: number,
): string {
  const omitted = totalChanges - changesReturned;
  return `Showing ${changesReturned.toLocaleString()} of ${totalChanges.toLocaleString()} changes. Results truncated to preserve performance (${omitted.toLocaleString()} changes omitted).`;
}

