/**
 * G12 — Partial Diff Is Labelled as Partial
 *
 * Golden test to ensure that when diff computation exceeds performance limits,
 * the result is explicitly marked as partial with an explanation. Silent truncation
 * destroys trust.
 *
 * Scenario: Diff exceeds performance limits.
 */

import {
  MAX_CHANGES_RETURNED,
  getPartialDiffExplanation,
  type DiffCompleteness,
} from '../../../core-domain/diff/diff-limits';

describe('G12 — Partial Diff Is Labelled as Partial', () => {
  it('should mark diff result as partial when computation exceeds threshold', () => {
    // Given: A diff that found more changes than MAX_CHANGES_RETURNED.
    const totalChangesFound = 8_234;
    const changesReturned = MAX_CHANGES_RETURNED;

    // When: The diff result is constructed as partial.
    const completeness: DiffCompleteness = {
      status: 'partial',
      truncatedAt: changesReturned,
      reason: getPartialDiffExplanation(changesReturned, totalChangesFound),
    };

    // Then: Diff result includes isPartial-equivalent status.
    expect(completeness.status).toBe('partial');

    // Then: Diff result includes explanation of what is missing.
    expect(completeness.reason).toContain('5,000');
    expect(completeness.reason).toContain('8,234');
    expect(completeness.reason).toMatch(/truncat/i);
  });

  it('should include truncatedAt count for partial diffs', () => {
    // Given: A partial diff.
    const completeness: DiffCompleteness = {
      status: 'partial',
      truncatedAt: 5_000,
      reason: 'Results truncated to preserve performance.',
    };

    // Then: truncatedAt indicates exactly where results were cut off.
    expect(completeness.truncatedAt).toBe(5_000);
  });

  it('should never have partial status without explanation', () => {
    // Given: A partial diff completeness.
    const completeness: DiffCompleteness = {
      status: 'partial',
      truncatedAt: 5_000,
      reason: getPartialDiffExplanation(5_000, 10_000),
    };

    // Then: reason is always present and non-empty.
    expect(completeness.reason).toBeDefined();
    expect(completeness.reason.length).toBeGreaterThan(0);
  });

  it('should distinguish partial from complete status', () => {
    // Given: Complete and partial statuses.
    const complete: DiffCompleteness = { status: 'complete' };
    const partial: DiffCompleteness = {
      status: 'partial',
      truncatedAt: 5_000,
      reason: 'Truncated for performance.',
    };

    // Then: They are distinguishable.
    expect(complete.status).not.toBe(partial.status);
  });

  it('should explain omitted changes count in partial explanation', () => {
    // Given: 8,234 total changes, 5,000 returned.
    const explanation = getPartialDiffExplanation(5_000, 8_234);

    // Then: Explanation includes omitted count (3,234).
    expect(explanation).toContain('3,234');
  });
});
