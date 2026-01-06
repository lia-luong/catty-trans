/**
 * G2 — Rollback Is Exact, Not Approximate
 *
 * Golden test to ensure that rollback operations restore exact state without
 * any residual metadata, flags, or counters from later states. This prevents
 * "almost rollback" implementations that could hide side effects.
 *
 * Scenario: A translator rolls back after a mistake.
 */

import { rollbackToSnapshot } from '../../../core-domain/history/versioning';
import type { VersionedState, SnapshotId } from '../../../core-domain/history/versioning';
import { createVersionedState, createTranslationChange } from '../../helpers/test-fixtures';
import { areStatesEqual } from '../../helpers/state-equality';

describe('G2 — Rollback Is Exact, Not Approximate', () => {
  it('should restore exact state from snapshot S1 after changes leading to S2 and S3', () => {
    // Given: State at Snapshot S1
    const initialState = createVersionedState({
      projectName: 'Test Project',
      sourceLanguage: 'en' as const,
      targetLanguages: ['fr' as const],
    });

    // Create S1 by committing an initial translation
    const change1 = createTranslationChange({
      projectId: initialState.currentState.project.id,
      segmentId: initialState.currentState.segments[0].id,
      targetLanguage: 'fr' as const,
      newText: 'Bonjour',
      newStatus: 'translated' as const,
    });

    const snapshotId1: SnapshotId = 'snapshot-1' as SnapshotId;
    const versionedWithS1 = {
      ...initialState,
      currentState: change1.projectId === initialState.currentState.project.id
        ? {
            ...initialState.currentState,
            targetSegments: [
              ...initialState.currentState.targetSegments,
              {
                id: change1.targetSegmentId,
                projectId: initialState.currentState.project.id,
                segmentId: change1.segmentId,
                targetLanguage: change1.targetLanguage,
                translatedText: change1.newText,
                status: change1.newStatus,
              },
            ],
          }
        : initialState.currentState,
      history: {
        snapshots: new Map([
          [
            snapshotId1,
            {
              id: snapshotId1,
              state: {
                ...initialState.currentState,
                targetSegments: [
                  ...initialState.currentState.targetSegments,
                  {
                    id: change1.targetSegmentId,
                    projectId: initialState.currentState.project.id,
                    segmentId: change1.segmentId,
                    targetLanguage: change1.targetLanguage,
                    translatedText: change1.newText,
                    status: change1.newStatus,
                  },
                ],
              },
              createdAtEpochMs: 1000,
            },
          ],
        ]),
        parentMap: new Map(),
      },
    };

    // Capture the exact state from S1 for later comparison
    const s1State = versionedWithS1.history.snapshots.get(snapshotId1)!.state;

    // Create S2 by making another change
    const change2 = createTranslationChange({
      projectId: versionedWithS1.currentState.project.id,
      segmentId: versionedWithS1.currentState.segments[0].id,
      targetLanguage: 'fr' as const,
      newText: 'Bonjour le monde',
      newStatus: 'approved' as const,
    });

    const snapshotId2: SnapshotId = 'snapshot-2' as SnapshotId;
    const versionedWithS2 = {
      ...versionedWithS1,
      currentState: {
        ...versionedWithS1.currentState,
        targetSegments: versionedWithS1.currentState.targetSegments.map((ts) =>
          ts.segmentId === change2.segmentId &&
          ts.targetLanguage === change2.targetLanguage
            ? {
                ...ts,
                translatedText: change2.newText,
                status: change2.newStatus,
              }
            : ts,
        ),
      },
      history: {
        snapshots: new Map([
          ...versionedWithS1.history.snapshots,
          [
            snapshotId2,
            {
              id: snapshotId2,
              state: {
                ...versionedWithS1.currentState,
                targetSegments: versionedWithS1.currentState.targetSegments.map((ts) =>
                  ts.segmentId === change2.segmentId &&
                  ts.targetLanguage === change2.targetLanguage
                    ? {
                        ...ts,
                        translatedText: change2.newText,
                        status: change2.newStatus,
                      }
                    : ts,
                ),
              },
              createdAtEpochMs: 2000,
            },
          ],
        ]),
        parentMap: new Map([[snapshotId2, snapshotId1]]),
      },
    };

    // Create S3 by making yet another change
    const change3 = createTranslationChange({
      projectId: versionedWithS2.currentState.project.id,
      segmentId: versionedWithS2.currentState.segments[0].id,
      targetLanguage: 'fr' as const,
      newText: 'Salut',
      newStatus: 'draft' as const,
    });

    const snapshotId3: SnapshotId = 'snapshot-3' as SnapshotId;
    const versionedWithS3 = {
      ...versionedWithS2,
      currentState: {
        ...versionedWithS2.currentState,
        targetSegments: versionedWithS2.currentState.targetSegments.map((ts) =>
          ts.segmentId === change3.segmentId &&
          ts.targetLanguage === change3.targetLanguage
            ? {
                ...ts,
                translatedText: change3.newText,
                status: change3.newStatus,
              }
            : ts,
        ),
      },
      history: {
        snapshots: new Map([
          ...versionedWithS2.history.snapshots,
          [
            snapshotId3,
            {
              id: snapshotId3,
              state: {
                ...versionedWithS2.currentState,
                targetSegments: versionedWithS2.currentState.targetSegments.map((ts) =>
                  ts.segmentId === change3.segmentId &&
                  ts.targetLanguage === change3.targetLanguage
                    ? {
                        ...ts,
                        translatedText: change3.newText,
                        status: change3.newStatus,
                      }
                    : ts,
                ),
              },
              createdAtEpochMs: 3000,
            },
          ],
        ]),
        parentMap: new Map([
          ...versionedWithS2.history.parentMap,
          [snapshotId3, snapshotId2],
        ]),
      },
    };

    // When: Rollback to S1 is executed
    const rolledBack = rollbackToSnapshot(versionedWithS3, snapshotId1);

    // Then: Resulting state equals S1 exactly
    expect(areStatesEqual(rolledBack.currentState, s1State)).toBe(true);

    // Verify no residual metadata from later states
    // Check that target segments match exactly (no extra segments from S2 or S3)
    expect(rolledBack.currentState.targetSegments.length).toBe(
      s1State.targetSegments.length,
    );

    // Verify the exact text and status from S1, not from S2 or S3
    const rolledBackTargetSegment = rolledBack.currentState.targetSegments.find(
      (ts) => ts.segmentId === change1.segmentId,
    );
    expect(rolledBackTargetSegment?.translatedText).toBe('Bonjour');
    expect(rolledBackTargetSegment?.status).toBe('translated');

    // Verify no flags or counters from later states
    // The state should be structurally identical, not just "similar"
    expect(JSON.stringify(rolledBack.currentState)).toBe(JSON.stringify(s1State));
  });

  it('should preserve history graph unchanged during rollback', () => {
    // Given: VersionedState with multiple snapshots
    const initialState = createVersionedState({
      projectName: 'Test Project',
      sourceLanguage: 'en' as const,
      targetLanguages: ['fr' as const],
    });

    const snapshotId1: SnapshotId = 'snapshot-1' as SnapshotId;
    const snapshotId2: SnapshotId = 'snapshot-2' as SnapshotId;

    const versionedState: VersionedState = {
      currentState: initialState.currentState,
      history: {
        snapshots: new Map([
          [
            snapshotId1,
            {
              id: snapshotId1,
              state: initialState.currentState,
              createdAtEpochMs: 1000,
            },
          ],
          [
            snapshotId2,
            {
              id: snapshotId2,
              state: initialState.currentState,
              createdAtEpochMs: 2000,
            },
          ],
        ]),
        parentMap: new Map([[snapshotId2, snapshotId1]]),
      },
    };

    // When: Rollback to S1
    const rolledBack = rollbackToSnapshot(versionedState, snapshotId1);

    // Then: History graph is preserved (not modified)
    expect(rolledBack.history.snapshots.size).toBe(versionedState.history.snapshots.size);
    expect(rolledBack.history.parentMap.size).toBe(versionedState.history.parentMap.size);
    expect(rolledBack.history.snapshots.has(snapshotId1)).toBe(true);
    expect(rolledBack.history.snapshots.has(snapshotId2)).toBe(true);
  });
});

