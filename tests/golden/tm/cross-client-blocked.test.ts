/**
 * G4 — Cross-Client TM Promotion Is Blocked
 *
 * Golden test to ensure that segments from one client cannot be promoted to
 * another client's TM. This is a critical IP protection mechanism, not just a bug.
 *
 * Scenario: A segment from Client A is reused in Client B.
 *
 * TODO: Implement when TM promotion feature is added to core-domain.
 * This test requires:
 * - TMEntry type definition
 * - canPromoteSegment function
 * - Client isolation logic
 */

describe.skip('G4 — Cross-Client TM Promotion Is Blocked', () => {
  it('should block promotion when TMEntry belongs to different client than project', () => {
    // Given:
    // - TMEntry belonging to Client A
    // - Project belonging to Client B

    // When:
    // - canPromoteSegment is evaluated

    // Then:
    // - allowed === false
    // - reason explicitly references cross-client risk

    // Implementation pending: TM promotion feature
  });
});

