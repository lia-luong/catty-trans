/**
 * G5 — Ad-Hoc Projects Do Not Pollute TM
 *
 * Golden test to ensure that ad-hoc projects do not automatically pollute
 * the TM. This prevents "helpful" defaults that cause long-term damage.
 *
 * Scenario: A rush job finishes late at night.
 *
 * Why this must never break:
 * - "Helpful" defaults that auto-promote rush work cause long-term TM pollution
 * - Ad-hoc translations may have lower quality standards or client-specific phrasing
 * - Translator must explicitly confirm quality before ad-hoc work enters TM
 */

import { canPromoteSegment } from '../../../core-domain/tm/promotion-guard';
import {
  makeProject,
  makeSegment,
  makeTargetSegment,
  makePromotionContext,
} from '../../helpers/test-fixtures';

describe('G5 — Ad-Hoc Projects Do Not Pollute TM', () => {
  it('should deny TM promotion by default for ad-hoc projects', () => {
    // Given: A project marked as ad-hoc (rush job, one-off work)
    const project = makeProject();
    const segment = makeSegment(project);

    // Completed segment with actual translation
    const targetSegment = makeTargetSegment(project, segment, {
      translatedText: 'Bonjour le monde.',
      status: 'translated',
    });

    // Context marks this as an ad-hoc project
    const context = makePromotionContext(project, segment, {
      isAdHoc: true,
    });

    // When: TM promotion is attempted
    const decision = canPromoteSegment(targetSegment, context);

    // Then: Promotion is denied by default
    expect(decision.allowed).toBe(false);

    // Override is required (not an absolute block like cross-client)
    expect(decision.requiresExplicitOverride).toBe(true);

    // Reason must mention ad-hoc for auditability
    expect(decision.reason.toLowerCase()).toContain('ad-hoc');
  });

  it('should allow TM promotion for non-ad-hoc projects', () => {
    // Given: A regular project (not ad-hoc)
    const project = makeProject();
    const segment = makeSegment(project);
    const targetSegment = makeTargetSegment(project, segment, {
      translatedText: 'Bonjour le monde.',
      status: 'translated',
    });

    // Context with isAdHoc: false (default)
    const context = makePromotionContext(project, segment, {
      isAdHoc: false,
    });

    // When: TM promotion is attempted
    const decision = canPromoteSegment(targetSegment, context);

    // Then: Promotion is allowed for regular projects
    expect(decision.allowed).toBe(true);
    expect(decision.requiresExplicitOverride).toBe(false);
  });

  it('should distinguish ad-hoc block from other blocks by requiresExplicitOverride', () => {
    // Given: An ad-hoc project with valid content
    const project = makeProject();
    const segment = makeSegment(project);
    const targetSegment = makeTargetSegment(project, segment, {
      translatedText: 'Bonjour le monde.',
      status: 'translated',
    });

    const context = makePromotionContext(project, segment, {
      isAdHoc: true,
    });

    // When: canPromoteSegment is evaluated
    const decision = canPromoteSegment(targetSegment, context);

    // Then: Ad-hoc block is overridable (unlike cross-client or missing snapshot)
    // This allows translators to explicitly confirm quality when needed
    expect(decision.allowed).toBe(false);
    expect(decision.requiresExplicitOverride).toBe(true);
  });
});
