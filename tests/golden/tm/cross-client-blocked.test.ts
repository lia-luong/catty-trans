/**
 * G4 — Cross-Client TM Promotion Is Blocked
 *
 * Golden test to ensure that segments from one client cannot be promoted to
 * another client's TM. This is a critical IP protection mechanism, not just a bug.
 *
 * Scenario: A segment from Client A is reused in Client B.
 *
 * Why this must never break:
 * - This is an IP leak, not a bug
 * - Client confidentiality and NDA compliance depend on this rule
 * - Terminology from one client appearing in another client's TM is a breach
 */

import type { ClientId } from '../../../core-domain/state/domain-entities';
import { canPromoteSegment } from '../../../core-domain/tm/promotion-guard';
import {
  makeProject,
  makeSegment,
  makeTargetSegment,
  makePromotionContext,
} from '../../helpers/test-fixtures';

// Brand-casting helper for test IDs.
function asBrand<T>(value: string): T {
  return value as unknown as T;
}

describe('G4 — Cross-Client TM Promotion Is Blocked', () => {
  it('should block promotion when targetClientId differs from project clientId', () => {
    // Given: A project belonging to Client A (Acme Corp)
    const clientAId = asBrand<ClientId>('client-acme');
    const clientBId = asBrand<ClientId>('client-globex');

    const project = makeProject({ clientId: clientAId });
    const segment = makeSegment(project);

    // Target segment with actual translation content (required for promotion)
    const targetSegment = makeTargetSegment(project, segment, {
      translatedText: 'Bonjour le monde.',
      status: 'translated',
    });

    // Context specifies target TM belongs to Client B (Globex Inc)
    const context = makePromotionContext(project, segment, {
      targetClientId: clientBId,
    });

    // When: canPromoteSegment is evaluated
    const decision = canPromoteSegment(targetSegment, context);

    // Then: Promotion is blocked with no override possible
    expect(decision.allowed).toBe(false);
    expect(decision.requiresExplicitOverride).toBe(false);

    // Reason must explicitly reference cross-client risk for auditability
    expect(decision.reason.toLowerCase()).toContain('cross-client');
  });

  it('should allow promotion when targetClientId matches project clientId', () => {
    // Given: A project and target TM both belonging to the same client
    const clientId = asBrand<ClientId>('client-acme');

    const project = makeProject({ clientId });
    const segment = makeSegment(project);
    const targetSegment = makeTargetSegment(project, segment, {
      translatedText: 'Bonjour le monde.',
      status: 'translated',
    });

    // Context specifies target TM belongs to the same client
    const context = makePromotionContext(project, segment, {
      targetClientId: clientId,
    });

    // When: canPromoteSegment is evaluated
    const decision = canPromoteSegment(targetSegment, context);

    // Then: Promotion is allowed (same client, no cross-client risk)
    expect(decision.allowed).toBe(true);
  });

  it('should allow promotion when targetClientId is not specified', () => {
    // Given: A project with no explicit target TM client specified
    // (implies promotion to same client's TM by default)
    const project = makeProject();
    const segment = makeSegment(project);
    const targetSegment = makeTargetSegment(project, segment, {
      translatedText: 'Bonjour le monde.',
      status: 'translated',
    });

    // Context without targetClientId (default behaviour)
    const context = makePromotionContext(project, segment);

    // When: canPromoteSegment is evaluated
    const decision = canPromoteSegment(targetSegment, context);

    // Then: Promotion is allowed (no cross-client check when target not specified)
    expect(decision.allowed).toBe(true);
  });
});
