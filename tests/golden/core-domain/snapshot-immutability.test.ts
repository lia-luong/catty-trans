// G1 — Snapshot Immutability
// Business intent: once a snapshot is committed, it becomes an immutable record
// of project history. Later edits or additional snapshots must never alter the
// original snapshot’s stored state; otherwise rollback, audit, and trust all
// collapse.

import { applyTranslationChange } from '../../../core-domain/state/project-state';
import {
  commitSnapshot,
  type VersionedState,
} from '../../../core-domain/history/versioning';
import {
  makeProjectState,
  makeTranslationChange,
  makeVersionedState,
} from '../../helpers/test-fixtures';
import { areProjectStatesStructurallyEqual } from '../../helpers/state-equality';

describe('G1 — Snapshot Immutability', () => {
  test('committing later snapshots does not change earlier snapshot payloads', () => {
    // Given a project state and an initial committed snapshot S1.
    const initialState = makeProjectState();
    const versioned: VersionedState = makeVersionedState(initialState);

    const project = initialState.project;
    const segment = initialState.segments[0];
    const firstChange = makeTranslationChange({
      project,
      segment,
      text: 'Bonjour le monde.',
    });

    const afterS1 = commitSnapshot(
      versioned,
      firstChange,
      // In tests we use simple string ids; adapters are responsible for
      // generating collision-free identifiers in real usage.
      'snapshot-s1' as any,
      1,
      'After first translation',
    );

    const s1 = afterS1.history.snapshots.get(
      'snapshot-s1' as any,
    );
    if (!s1) {
      throw new Error('Expected snapshot S1 to be present in history');
    }

    const s1StateAtCreation = s1.state;
    const s1StateJsonAtCreation = JSON.stringify(s1StateAtCreation);

    // When further changes and snapshots (S2) are committed.
    const secondChange = makeTranslationChange({
      project,
      segment,
      text: 'Bonjour le monde, version 2.',
      status: 'approved',
    });

    const afterS2 = commitSnapshot(
      afterS1,
      secondChange,
      'snapshot-s2' as any,
      2,
      'After second translation',
    );

    const s1AfterS2 = afterS2.history.snapshots.get(
      'snapshot-s1' as any,
    );
    if (!s1AfterS2) {
      throw new Error('Expected snapshot S1 to remain in history after S2');
    }

    // Then S1’s stored state must remain byte-for-byte identical to the value
    // it held at creation time, even though newer state exists.
    const s1StateJsonAfterS2 = JSON.stringify(s1AfterS2.state);
    expect(s1StateJsonAfterS2).toBe(s1StateJsonAtCreation);

    // And the current working state can evolve independently without mutating
    // the historical snapshot (demonstrated via another pure state change).
    const thirdChange = makeTranslationChange({
      project,
      segment,
      text: 'Bonjour le monde, version 3.',
    });
    const afterThirdChangeState = applyTranslationChange(
      afterS2.currentState,
      thirdChange,
    );

    expect(
      areProjectStatesStructurallyEqual(
        s1AfterS2.state,
        afterThirdChangeState,
      ),
    ).toBe(false);
  });
});


