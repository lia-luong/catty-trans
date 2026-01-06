/**
 * G11 — TM Duplicate Entry Handling
 *
 * Golden test to ensure that duplicate TM entries are detected at the domain
 * level and handled explicitly, preventing silent failures from database
 * constraint violations during bulk promotion workflows.
 *
 * Scenario: Translator bulk-promotes all segments after making edits to a few.
 *
 * Why this must never break:
 * - Bulk promotion is a standard workflow ("ensure TM is complete")
 * - Database constraint violations are opaque errors that don't guide users
 * - Explicit duplicate handling enables "Update existing?" or "Skip?" UI flows
 */

import { canPromoteSegment } from '../../../core-domain/tm/promotion-guard';
import {
  makeProject,
  makeSegment,
  makeTargetSegment,
  makePromotionContext,
} from '../../helpers/test-fixtures';

describe('G11 — TM Duplicate Entry Handling', () => {
  it('should deny promotion when source text already exists in TM', () => {
    // Given: A project with a completed translation
    const project = makeProject();
    const segment = makeSegment(project, {
      sourceText: 'Hello world',
    });
    const targetSegment = makeTargetSegment(project, segment, {
      translatedText: 'Bonjour le monde',
      status: 'translated',
    });

    // Context with existingSourceTexts indicating this source text is already in TM
    const existingSourceTexts = new Set(['Hello world']);
    const context = makePromotionContext(project, segment, {
      existingSourceTexts,
    });

    // When: TM promotion is attempted
    const decision = canPromoteSegment(targetSegment, context);

    // Then: Promotion is denied with explicit duplicate reason
    expect(decision.allowed).toBe(false);

    // Override is allowed (translator might want to update the existing entry)
    expect(decision.requiresExplicitOverride).toBe(true);

    // Reason must mention "already exists" for auditability
    expect(decision.reason.toLowerCase()).toContain('already exists');
    expect(decision.reason.toLowerCase()).toContain('tm entry');
  });

  it('should allow promotion when source text does not exist in TM', () => {
    // Given: A project with a completed translation
    const project = makeProject();
    const segment = makeSegment(project, {
      sourceText: 'New segment text',
    });
    const targetSegment = makeTargetSegment(project, segment, {
      translatedText: 'Nouveau texte de segment',
      status: 'translated',
    });

    // Context with existingSourceTexts NOT containing this source text
    const existingSourceTexts = new Set(['Hello world', 'Goodbye']);
    const context = makePromotionContext(project, segment, {
      existingSourceTexts,
    });

    // When: TM promotion is attempted
    const decision = canPromoteSegment(targetSegment, context);

    // Then: Promotion is allowed (source text is unique)
    expect(decision.allowed).toBe(true);
    expect(decision.requiresExplicitOverride).toBe(false);
  });

  it('should allow promotion when existingSourceTexts is not provided (backwards compatibility)', () => {
    // Given: A project with a completed translation
    const project = makeProject();
    const segment = makeSegment(project, {
      sourceText: 'Hello world',
    });
    const targetSegment = makeTargetSegment(project, segment, {
      translatedText: 'Bonjour le monde',
      status: 'translated',
    });

    // Context WITHOUT existingSourceTexts (backwards compatibility mode)
    const context = makePromotionContext(project, segment, {
      // existingSourceTexts omitted
    });

    // When: TM promotion is attempted
    const decision = canPromoteSegment(targetSegment, context);

    // Then: Promotion is allowed (duplicate check is skipped)
    expect(decision.allowed).toBe(true);
    expect(decision.requiresExplicitOverride).toBe(false);
  });

  it('should allow promotion when existingSourceTexts is empty set', () => {
    // Given: A project with a completed translation
    const project = makeProject();
    const segment = makeSegment(project);
    const targetSegment = makeTargetSegment(project, segment, {
      translatedText: 'Bonjour le monde',
      status: 'translated',
    });

    // Context with empty existingSourceTexts (TM has no entries yet)
    const existingSourceTexts = new Set<string>();
    const context = makePromotionContext(project, segment, {
      existingSourceTexts,
    });

    // When: TM promotion is attempted
    const decision = canPromoteSegment(targetSegment, context);

    // Then: Promotion is allowed (no duplicates exist)
    expect(decision.allowed).toBe(true);
  });

  it('should distinguish duplicate block from other blocks by requiresExplicitOverride', () => {
    // Given: Two scenarios - one with duplicate, one with archived project
    const project = makeProject();
    const archivedProject = makeProject({ status: 'archived' });
    const segment = makeSegment(project, {
      sourceText: 'Hello world',
    });
    const archivedSegment = makeSegment(archivedProject);

    const targetSegment = makeTargetSegment(project, segment, {
      translatedText: 'Bonjour le monde',
      status: 'translated',
    });
    const archivedTargetSegment = makeTargetSegment(archivedProject, archivedSegment, {
      translatedText: 'Test',
      status: 'translated',
    });

    // Scenario 1: Duplicate entry (overridable)
    const existingSourceTexts = new Set(['Hello world']);
    const duplicateContext = makePromotionContext(project, segment, {
      existingSourceTexts,
    });
    const duplicateDecision = canPromoteSegment(targetSegment, duplicateContext);

    // Scenario 2: Archived project (not overridable)
    const archivedContext = makePromotionContext(archivedProject, archivedSegment);
    const archivedDecision = canPromoteSegment(archivedTargetSegment, archivedContext);

    // Then: Duplicate block is overridable, archived block is not
    expect(duplicateDecision.allowed).toBe(false);
    expect(duplicateDecision.requiresExplicitOverride).toBe(true);

    expect(archivedDecision.allowed).toBe(false);
    expect(archivedDecision.requiresExplicitOverride).toBe(false);
  });

  it('should check duplicate before ad-hoc check (rule priority)', () => {
    // Given: An ad-hoc project with a duplicate source text
    const project = makeProject();
    const segment = makeSegment(project, {
      sourceText: 'Hello world',
    });
    const targetSegment = makeTargetSegment(project, segment, {
      translatedText: 'Bonjour le monde',
      status: 'translated',
    });

    // Context with BOTH isAdHoc and existingSourceTexts
    const existingSourceTexts = new Set(['Hello world']);
    const context = makePromotionContext(project, segment, {
      isAdHoc: true,
      existingSourceTexts,
    });

    // When: TM promotion is attempted
    const decision = canPromoteSegment(targetSegment, context);

    // Then: Duplicate check runs first and blocks promotion
    expect(decision.allowed).toBe(false);
    // Reason should mention duplicate, not ad-hoc
    expect(decision.reason.toLowerCase()).toContain('already exists');
    expect(decision.reason.toLowerCase()).not.toContain('ad-hoc');
    // Duplicate block is overridable; ad-hoc block would also be overridable,
    // but the duplicate check takes priority
    expect(decision.requiresExplicitOverride).toBe(true);
  });
});

