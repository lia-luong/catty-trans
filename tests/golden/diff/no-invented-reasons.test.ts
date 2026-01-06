/**
 * G10 — Diff Does Not Invent Reasons
 *
 * Golden test to ensure that diff operations do not guess or invent reasons
 * for changes when provenance is unclear. Guessing breaks trust faster than silence.
 *
 * Scenario: Change provenance is unclear.
 *
 * TODO: Implement when diff engine is added to core-domain.
 * This test requires:
 * - diffSegment function with provenance tracking
 * - Logic to distinguish between known and unknown change sources
 */

describe.skip('G10 — Diff Does Not Invent Reasons', () => {
  it('should state "manual edit" or "unknown" when change provenance is unclear', () => {
    // Given:
    // - Segment changed
    // - No TM or terminology involvement

    // Then:
    // - Diff must state "manual edit" or "unknown"
    // - Must not guess TM influence

    // Implementation pending: Diff engine with honest provenance reporting
  });
});

