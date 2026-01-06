/**
 * G6 — TM Entries Are Immutable
 *
 * Golden test to ensure that TM entries remain unchanged once created,
 * preserving provenance and defensibility. Corrections create new entries.
 *
 * Scenario: TM grows over time.
 *
 * TODO: Implement when TM system is added to core-domain.
 * This test requires:
 * - TMEntry type definition
 * - TM storage/retrieval logic
 * - Immutability guarantees for TM entries
 */

describe.skip('G6 — TM Entries Are Immutable', () => {
  it('should preserve TMEntry content unchanged after later project edits', () => {
    // Given:
    // - TMEntry E1 created from Snapshot S1

    // When:
    // - Later project edits occur
    // - TM is queried

    // Then:
    // - E1 content remains unchanged
    // - Any correction produces a _new_ TMEntry

    // Implementation pending: TM system with immutable entries
  });
});

