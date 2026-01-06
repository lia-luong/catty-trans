/**
 * G11 — TM-Driven Changes Are Distinguishable
 *
 * Golden test to ensure that changes caused by TM suggestions are explicitly
 * marked and distinguishable from manual edits. This prevents "magic" automation
 * behaviour that breaks trust.
 *
 * Scenario: TM suggestion is accepted.
 */

import type { ProjectId, SegmentId, SnapshotId } from '../../../core-domain/state/domain-entities';
import { diffSegment, type SegmentDiffInput } from '../../../core-domain/diff/diff-segment';

// Branded type helpers for test fixtures.
function asSegmentId(value: string): SegmentId {
  return value as unknown as SegmentId;
}

function asProjectId(value: string): ProjectId {
  return value as unknown as ProjectId;
}

function asSnapshotId(value: string): SnapshotId {
  return value as unknown as SnapshotId;
}

describe('G11 — TM-Driven Changes Are Distinguishable', () => {
  it('should mark TM involvement explicitly and reference TMEntry provenance', () => {
    // Given: A segment change caused by accepting a TM match.
    const segmentId = asSegmentId('segment-tm-test');
    const sourceText = 'Welcome to our service.';

    const before: SegmentDiffInput = {
      translatedText: '',
      status: 'draft',
      targetLanguage: 'es-ES',
    };

    const after: SegmentDiffInput = {
      translatedText: 'Bienvenido a nuestro servicio.',
      status: 'translated',
      targetLanguage: 'es-ES',
      tmProvenance: {
        projectId: asProjectId('marketing-project-2024'),
        snapshotId: asSnapshotId('snapshot-approved-v2'),
      },
    };

    // When: diffSegment computes the change.
    const diff = diffSegment(segmentId, sourceText, before, after);

    // Then: Diff marks TM involvement explicitly.
    expect(diff.cause).toBe('tm_insert');
    expect(diff.changeType).toBe('modified');

    // Then: TMEntry provenance is referenced via the after state.
    const afterWithProvenance = diff.after as SegmentDiffInput;
    expect(afterWithProvenance.tmProvenance).toBeDefined();
    expect(afterWithProvenance.tmProvenance?.projectId).toBe(
      asProjectId('marketing-project-2024'),
    );
    expect(afterWithProvenance.tmProvenance?.snapshotId).toBe(
      asSnapshotId('snapshot-approved-v2'),
    );
  });

  it('should not mark TM involvement when provenance is absent', () => {
    // Given: A segment change without TM provenance (manual edit).
    const segmentId = asSegmentId('segment-manual');
    const sourceText = 'Welcome to our service.';

    const before: SegmentDiffInput = {
      translatedText: '',
      status: 'draft',
      targetLanguage: 'es-ES',
    };

    const after: SegmentDiffInput = {
      translatedText: 'Bienvenido a nuestro servicio.',
      status: 'translated',
      targetLanguage: 'es-ES',
      // No tmProvenance: this was typed manually.
    };

    // When: diffSegment computes the change.
    const diff = diffSegment(segmentId, sourceText, before, after);

    // Then: Diff does NOT mark TM involvement.
    expect(diff.cause).toBe('unknown');
    expect(diff.cause).not.toBe('tm_insert');
  });
});
