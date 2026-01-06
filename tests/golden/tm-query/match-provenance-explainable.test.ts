/**
 * G8 — TM Match Provenance Is Explainable
 *
 * Golden test to ensure that TM match results include complete provenance
 * information. This enables defensibility when clients dispute wording.
 *
 * Scenario: Client disputes wording.
 *
 * TODO: Implement when TM query system is added to core-domain.
 * This test requires:
 * - TMMatchResult type with provenance fields
 * - TM query logic that includes provenance
 * - No "unknown source" placeholders
 */

describe.skip('G8 — TM Match Provenance Is Explainable', () => {
  it('should include complete provenance in TMMatchResult', () => {
    // Given:
    // - TMMatchResult returned

    // Then:
    // - Result includes:
    //   - Source project ID
    //   - Snapshot ID
    //   - Timestamp
    // - No "unknown source" placeholders unless explicitly flagged

    // Implementation pending: TM query system with provenance tracking
  });
});

