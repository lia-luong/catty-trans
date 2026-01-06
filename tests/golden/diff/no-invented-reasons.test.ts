/**
 * G10 — Diff Does Not Invent Reasons
 *
 * Golden test to ensure that diff operations do not guess or invent reasons
 * for changes when provenance is unclear. Guessing breaks trust faster than silence.
 *
 * Scenario: Change provenance is unclear.
 */

import type { ProjectId, SegmentId, SnapshotId } from '../../../core-domain/state/domain-entities';
import { diffSegment, explainChangeCause, type SegmentDiffInput } from '../../../core-domain/diff/diff-segment';

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

describe('G10 — Diff Does Not Invent Reasons', () => {
  it('should state "unknown" when change provenance is unclear', () => {
    // Given: A segment changed without any TM or terminology involvement.
    const segmentId = asSegmentId('segment-no-provenance');
    const sourceText = 'Click here to continue.';

    const before: SegmentDiffInput = {
      translatedText: '',
      status: 'draft',
      targetLanguage: 'de-DE',
    };

    const after: SegmentDiffInput = {
      translatedText: 'Klicken Sie hier, um fortzufahren.',
      status: 'translated',
      targetLanguage: 'de-DE',
      // No tmProvenance: we don't know how this translation was produced.
    };

    // When: diffSegment computes the change.
    const diff = diffSegment(segmentId, sourceText, before, after);

    // Then: Diff must state 'unknown', not guess TM influence.
    expect(diff.cause).toBe('unknown');
    expect(diff.cause).not.toBe('tm_insert');
    expect(diff.cause).not.toBe('manual_edit');
  });

  it('should never infer TM involvement from translation content similarity', () => {
    // Given: A translation that looks like it could have come from TM
    // (e.g. matches a common phrase), but has no provenance.
    const segmentId = asSegmentId('segment-looks-like-tm');
    const sourceText = 'Thank you for your purchase.';

    const before: SegmentDiffInput = {
      translatedText: '',
      status: 'draft',
      targetLanguage: 'fr-FR',
    };

    // This translation is identical to what might exist in TM, but
    // no provenance was captured. The diff must not infer TM involvement.
    const after: SegmentDiffInput = {
      translatedText: 'Merci pour votre achat.',
      status: 'translated',
      targetLanguage: 'fr-FR',
      // No tmProvenance, even though the text might match a TM entry.
    };

    // When: diffSegment computes the change.
    const diff = diffSegment(segmentId, sourceText, before, after);

    // Then: Diff must NOT guess TM involvement based on content.
    // Only explicit provenance can prove TM-driven changes.
    expect(diff.cause).toBe('unknown');
  });

  it('should preserve honesty even when before state had TM provenance', () => {
    // Given: The before state was TM-driven, but the after state has no provenance.
    // This could happen if a translator overwrote a TM suggestion manually.
    const segmentId = asSegmentId('segment-overwritten');
    const sourceText = 'Your order has shipped.';

    const before: SegmentDiffInput = {
      translatedText: 'Votre commande a été expédiée.',
      status: 'translated',
      targetLanguage: 'fr-FR',
      tmProvenance: {
        projectId: asProjectId('old-project'),
        snapshotId: asSnapshotId('old-snapshot'),
      },
    };

    // Translator manually changed the translation (no TM provenance on after).
    const after: SegmentDiffInput = {
      translatedText: 'Votre commande est en route.',
      status: 'translated',
      targetLanguage: 'fr-FR',
      // No tmProvenance: this edit was manual.
    };

    // When: diffSegment computes the change.
    const diff = diffSegment(segmentId, sourceText, before, after);

    // Then: Diff correctly identifies this as a change with unknown cause.
    // The fact that the previous state was TM-driven is irrelevant to the
    // current change's cause.
    expect(diff.cause).toBe('unknown');
    expect(diff.changeType).toBe('modified');
  });

  it('should provide user-friendly explanation for all ChangeCause values', () => {
    // Test that explainChangeCause returns non-empty, jargon-free strings
    const tmInsertExplanation = explainChangeCause('tm_insert');
    expect(tmInsertExplanation.length).toBeGreaterThan(0);
    expect(tmInsertExplanation.toLowerCase()).toContain('tm');

    const manualEditExplanation = explainChangeCause('manual_edit');
    expect(manualEditExplanation.length).toBeGreaterThan(0);
    expect(manualEditExplanation.toLowerCase()).toContain('manual');

    const unknownExplanation = explainChangeCause('unknown');
    expect(unknownExplanation.length).toBeGreaterThan(0);
    
    // Critical: "unknown" explanation must NOT use error terminology
    expect(unknownExplanation.toLowerCase()).not.toContain('error');
    expect(unknownExplanation.toLowerCase()).not.toContain('failed');
    expect(unknownExplanation.toLowerCase()).not.toContain('missing');
    expect(unknownExplanation.toLowerCase()).not.toContain('corrupted');
    
    // Should mention provenance (the actual reason for "unknown")
    expect(unknownExplanation.toLowerCase()).toContain('provenance');
  });
});
