/**
 * G12 — Manual Edit vs TM Insert Are Distinguishable
 *
 * Golden test to ensure the diff engine correctly distinguishes between manual
 * edits and TM-driven insertions based on explicit provenance evidence.
 *
 * Core principle: A diff must never guess at TM involvement. If provenance
 * exists, cause is 'tm_insert'. If not, cause is 'unknown'. Never infer.
 *
 * These tests validate the explainability contract: translators can prove
 * whether a change was TM-driven or manually entered, enabling defensibility
 * when clients dispute translations.
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

describe('G12 — Manual Edit vs TM Insert Are Distinguishable', () => {
  const segmentId = asSegmentId('segment-1');
  const sourceText = 'The product is ready.';

  describe('TM-driven changes', () => {
    it('should mark cause as tm_insert when after state has TM provenance', () => {
      // Given: A segment changed with explicit TM provenance on the after state.
      // Business context: Translator accepted a TM match suggestion.
      const before: SegmentDiffInput = {
        translatedText: '',
        status: 'draft',
        targetLanguage: 'fr-FR',
      };

      const after: SegmentDiffInput = {
        translatedText: 'Le produit est prêt.',
        status: 'translated',
        targetLanguage: 'fr-FR',
        tmProvenance: {
          projectId: asProjectId('previous-project'),
          snapshotId: asSnapshotId('snapshot-from-tm'),
        },
      };

      // When: diffSegment computes the change.
      const diff = diffSegment(segmentId, sourceText, before, after);

      // Then: cause is 'tm_insert' because provenance evidence exists.
      // This enables translator to prove they followed TM guidance.
      expect(diff.cause).toBe('tm_insert');
      expect(diff.changeType).toBe('modified');
      expect(diff.after?.translatedText).toBe('Le produit est prêt.');
    });

    it('should mark new translation as tm_insert when created via TM match', () => {
      // Given: A new translation created by accepting a TM suggestion.
      // Business context: Segment had no translation; translator used TM to populate it.
      const before = undefined;

      const after: SegmentDiffInput = {
        translatedText: 'Le produit est prêt.',
        status: 'translated',
        targetLanguage: 'fr-FR',
        tmProvenance: {
          projectId: asProjectId('source-project'),
          snapshotId: asSnapshotId('tm-snapshot'),
        },
      };

      // When: diffSegment computes the change.
      const diff = diffSegment(segmentId, sourceText, before, after);

      // Then: cause is 'tm_insert' for the creation, with provenance traceable.
      expect(diff.cause).toBe('tm_insert');
      expect(diff.changeType).toBe('created');
    });
  });

  describe('Manual edits (no TM provenance)', () => {
    it('should mark cause as unknown when no TM provenance exists', () => {
      // Given: A segment changed without any TM provenance.
      // Business context: Translator typed the translation manually.
      const before: SegmentDiffInput = {
        translatedText: '',
        status: 'draft',
        targetLanguage: 'fr-FR',
      };

      const after: SegmentDiffInput = {
        translatedText: 'Le produit est prêt.',
        status: 'translated',
        targetLanguage: 'fr-FR',
        // No tmProvenance: translator typed this manually.
      };

      // When: diffSegment computes the change.
      const diff = diffSegment(segmentId, sourceText, before, after);

      // Then: cause is 'unknown' because we cannot prove TM involvement.
      // The diff refuses to guess, protecting both translator and client.
      expect(diff.cause).toBe('unknown');
      expect(diff.changeType).toBe('modified');
    });

    it('should mark new translation as unknown when created without TM', () => {
      // Given: A new translation created by manual typing.
      const before = undefined;

      const after: SegmentDiffInput = {
        translatedText: 'Le produit est prêt.',
        status: 'translated',
        targetLanguage: 'fr-FR',
        // No tmProvenance.
      };

      // When: diffSegment computes the change.
      const diff = diffSegment(segmentId, sourceText, before, after);

      // Then: cause is 'unknown' for the creation (cannot prove TM involvement).
      expect(diff.cause).toBe('unknown');
      expect(diff.changeType).toBe('created');
    });
  });

  describe('Deletions always have unknown cause', () => {
    it('should mark deletion cause as unknown regardless of before state provenance', () => {
      // Given: A translation is deleted (after state is undefined).
      // Business context: Deletions are administrative; TM cannot cause them.
      const before: SegmentDiffInput = {
        translatedText: 'Le produit est prêt.',
        status: 'translated',
        targetLanguage: 'fr-FR',
        tmProvenance: {
          projectId: asProjectId('some-project'),
          snapshotId: asSnapshotId('some-snapshot'),
        },
      };

      const after = undefined;

      // When: diffSegment computes the change.
      const diff = diffSegment(segmentId, sourceText, before, after);

      // Then: cause is 'unknown' because deletions have no TM cause.
      expect(diff.cause).toBe('unknown');
      expect(diff.changeType).toBe('deleted');
    });
  });

  describe('Unchanged segments', () => {
    it('should mark unchanged segments with unknown cause', () => {
      // Given: A segment that did not change between states.
      const state: SegmentDiffInput = {
        translatedText: 'Le produit est prêt.',
        status: 'translated',
        targetLanguage: 'fr-FR',
      };

      // When: diffSegment compares identical before and after.
      const diff = diffSegment(segmentId, sourceText, state, state);

      // Then: changeType is 'unchanged', cause is 'unknown' (no change = no cause).
      expect(diff.changeType).toBe('unchanged');
      expect(diff.cause).toBe('unknown');
    });
  });

  describe('Dispute resolution scenario', () => {
    it('should enable translator to prove TM guidance was followed', () => {
      // Scenario: Client claims translator used wrong terminology.
      // Translator says they followed TM guidance from a previous approved project.
      //
      // Resolution: The diff shows cause === 'tm_insert' with provenance,
      // enabling translator to reference the exact snapshot and project
      // that contributed the TM entry.

      const before: SegmentDiffInput = {
        translatedText: '',
        status: 'draft',
        targetLanguage: 'fr-FR',
      };

      const after: SegmentDiffInput = {
        translatedText: 'Le produit est prêt.',
        status: 'translated',
        targetLanguage: 'fr-FR',
        tmProvenance: {
          projectId: asProjectId('client-approved-project-2023'),
          snapshotId: asSnapshotId('approved-snapshot-final'),
        },
      };

      const diff = diffSegment(segmentId, sourceText, before, after);

      // Translator can now prove:
      // 1. The change was TM-driven (cause === 'tm_insert')
      // 2. The TM entry came from 'client-approved-project-2023'
      // 3. The exact snapshot is 'approved-snapshot-final'
      expect(diff.cause).toBe('tm_insert');
      expect(diff.after?.translatedText).toBe('Le produit est prêt.');

      // The provenance is preserved in the after state for audit.
      const afterWithProvenance = diff.after as SegmentDiffInput;
      expect(afterWithProvenance.tmProvenance?.projectId).toBe(
        asProjectId('client-approved-project-2023'),
      );
      expect(afterWithProvenance.tmProvenance?.snapshotId).toBe(
        asSnapshotId('approved-snapshot-final'),
      );
    });

    it('should protect both parties when provenance is missing', () => {
      // Scenario: Client claims translator used wrong terminology.
      // No TM provenance was captured at translation time.
      //
      // Resolution: The diff shows cause === 'unknown'. Neither party
      // can prove TM involvement. The diff is honest rather than speculative.

      const before: SegmentDiffInput = {
        translatedText: '',
        status: 'draft',
        targetLanguage: 'fr-FR',
      };

      const after: SegmentDiffInput = {
        translatedText: 'Le produit est prêt.',
        status: 'translated',
        targetLanguage: 'fr-FR',
        // No tmProvenance captured.
      };

      const diff = diffSegment(segmentId, sourceText, before, after);

      // The diff refuses to guess TM involvement.
      // This protects the translator from false accusations of ignoring TM,
      // and protects the client from false claims of TM guidance.
      expect(diff.cause).toBe('unknown');
    });
  });

  describe('Determinism guarantee', () => {
    it('should produce identical output for identical inputs', () => {
      // Given: Identical inputs.
      const before: SegmentDiffInput = {
        translatedText: 'Draft text',
        status: 'draft',
        targetLanguage: 'de-DE',
      };

      const after: SegmentDiffInput = {
        translatedText: 'Final text',
        status: 'translated',
        targetLanguage: 'de-DE',
        tmProvenance: {
          projectId: asProjectId('p1'),
          snapshotId: asSnapshotId('s1'),
        },
      };

      // When: diffSegment is called multiple times.
      const diff1 = diffSegment(segmentId, sourceText, before, after);
      const diff2 = diffSegment(segmentId, sourceText, before, after);
      const diff3 = diffSegment(segmentId, sourceText, before, after);

      // Then: All results are identical (deterministic).
      expect(diff1).toEqual(diff2);
      expect(diff2).toEqual(diff3);
    });
  });
});

