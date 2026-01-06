// Helpers for comparing domain state structures in golden tests.
// While Jest's deep equality is usually enough, these helpers make intent
// explicit when we need to assert that two ProjectState values represent the
// same logical state, regardless of reference identity.

import type { ProjectState } from '../../core-domain/state/project-state';

// Compare two ProjectState values structurally. This is used in golden tests
// to prove that rollback restores an exact state and that snapshots preserve
// historical truth without being affected by later changes.
export function areProjectStatesStructurallyEqual(
  a: ProjectState,
  b: ProjectState,
): boolean {
  // For now we delegate to JSON serialisation, which is sufficient for the
  // current immutable, acyclic state structures. If the domain adds richer
  // types later, this helper can be upgraded without touching the tests.
  return JSON.stringify(a) === JSON.stringify(b);
}

// Convenience assertion that makes failure messages explicit in the context
// of versioning and rollback tests.
export function expectProjectStatesToBeEqual(
  actual: ProjectState,
  expected: ProjectState,
): void {
  if (!areProjectStatesStructurallyEqual(actual, expected)) {
    // eslint-disable-next-line jest/no-standalone-expect
    expect(actual).toEqual(expected);
  }
}


