/**
 * G5 — Ad-Hoc Projects Do Not Pollute TM
 *
 * Golden test to ensure that ad-hoc projects do not automatically pollute
 * the TM. This prevents "helpful" defaults that cause long-term damage.
 *
 * Scenario: A rush job finishes late at night.
 *
 * TODO: Implement when TM promotion feature is added to core-domain.
 * This test requires:
 * - Project ad-hoc flag/status
 * - TM promotion logic with ad-hoc handling
 * - Override mechanism with logging
 */

describe.skip('G5 — Ad-Hoc Projects Do Not Pollute TM', () => {
  it('should deny TM promotion by default for ad-hoc projects', () => {
    // Given:
    // - Project marked as ad-hoc
    // - Completed segments

    // When:
    // - TM promotion is attempted

    // Then:
    // - Promotion denied by default
    // - Override required and logged

    // Implementation pending: TM promotion feature with ad-hoc handling
  });
});

