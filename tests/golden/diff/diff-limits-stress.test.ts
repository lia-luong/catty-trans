/**
 * Stress Test — Diff Limits and Degradation with Large Segment Sets
 *
 * Validates that the diff system fails loudly and honestly when performance
 * limits are exceeded. Silent truncation is forbidden; all degradation must
 * be explicit and explained.
 *
 * These tests verify:
 * - Threshold constants are correctly defined
 * - checkDiffFeasibility refuses projects exceeding MAX_SEGMENTS_PER_DIFF
 * - Warning threshold triggers for large (but feasible) projects
 * - Partial diff explanations are human-readable and accurate
 */

import {
  MAX_SEGMENTS_PER_DIFF,
  MAX_CHANGES_RETURNED,
  WARN_SEGMENTS_THRESHOLD,
  checkDiffFeasibility,
  shouldWarnAboutProjectSize,
  getProjectSizeWarning,
  getPartialDiffExplanation,
  type DiffCompleteness,
} from '../../../core-domain/diff/diff-limits';

describe('Diff Limits — Threshold Constants', () => {
  it('should define MAX_SEGMENTS_PER_DIFF as 10,000', () => {
    // Threshold for refusing diff computation entirely.
    expect(MAX_SEGMENTS_PER_DIFF).toBe(10_000);
  });

  it('should define MAX_CHANGES_RETURNED as 5,000', () => {
    // Threshold for truncating results (partial diff).
    expect(MAX_CHANGES_RETURNED).toBe(5_000);
  });

  it('should define WARN_SEGMENTS_THRESHOLD as 5,000', () => {
    // Threshold for early warning before hard limit.
    expect(WARN_SEGMENTS_THRESHOLD).toBe(5_000);
  });

  it('should have warning threshold at 50% of hard limit', () => {
    // Design invariant: warning comes at halfway point.
    expect(WARN_SEGMENTS_THRESHOLD).toBe(MAX_SEGMENTS_PER_DIFF / 2);
  });

  it('should have changes limit at 50% of segment limit', () => {
    // Design invariant: changes limit equals warning threshold.
    expect(MAX_CHANGES_RETURNED).toBe(WARN_SEGMENTS_THRESHOLD);
  });
});

describe('Diff Limits — checkDiffFeasibility', () => {
  describe('Projects within limits', () => {
    it('should return complete status for small projects', () => {
      const result = checkDiffFeasibility(100);

      expect(result.status).toBe('complete');
    });

    it('should return complete status for medium projects', () => {
      const result = checkDiffFeasibility(5_000);

      expect(result.status).toBe('complete');
    });

    it('should return complete status at exactly MAX_SEGMENTS_PER_DIFF', () => {
      // Boundary test: exactly at the limit should be allowed.
      const result = checkDiffFeasibility(MAX_SEGMENTS_PER_DIFF);

      expect(result.status).toBe('complete');
    });

    it('should return complete status for projects with 1 segment', () => {
      const result = checkDiffFeasibility(1);

      expect(result.status).toBe('complete');
    });

    it('should return complete status for empty projects', () => {
      const result = checkDiffFeasibility(0);

      expect(result.status).toBe('complete');
    });
  });

  describe('Projects exceeding limits', () => {
    it('should return refused status for projects exceeding MAX_SEGMENTS_PER_DIFF', () => {
      const result = checkDiffFeasibility(MAX_SEGMENTS_PER_DIFF + 1);

      expect(result.status).toBe('refused');
    });

    it('should return refused status for very large projects', () => {
      const result = checkDiffFeasibility(50_000);

      expect(result.status).toBe('refused');
    });

    it('should return refused status for extremely large projects', () => {
      const result = checkDiffFeasibility(1_000_000);

      expect(result.status).toBe('refused');
    });

    it('should include segment count in refused reason', () => {
      const segmentCount = 15_000;
      const result = checkDiffFeasibility(segmentCount);

      expect(result.status).toBe('refused');
      if (result.status === 'refused') {
        expect(result.reason).toContain('15,000');
      }
    });

    it('should include limit in refused reason', () => {
      const result = checkDiffFeasibility(15_000);

      expect(result.status).toBe('refused');
      if (result.status === 'refused') {
        expect(result.reason).toContain('10,000');
      }
    });

    it('should include actionable suggestion in refused reason', () => {
      const result = checkDiffFeasibility(15_000);

      expect(result.status).toBe('refused');
      if (result.status === 'refused') {
        // Should suggest alternatives to help the user.
        expect(result.reason).toMatch(/smaller snapshots|splitting/i);
      }
    });
  });

  describe('Boundary conditions', () => {
    it('should refuse at MAX_SEGMENTS_PER_DIFF + 1', () => {
      const atLimit = checkDiffFeasibility(MAX_SEGMENTS_PER_DIFF);
      const overLimit = checkDiffFeasibility(MAX_SEGMENTS_PER_DIFF + 1);

      expect(atLimit.status).toBe('complete');
      expect(overLimit.status).toBe('refused');
    });
  });

  describe('Determinism', () => {
    it('should return identical results for identical inputs', () => {
      const result1 = checkDiffFeasibility(15_000);
      const result2 = checkDiffFeasibility(15_000);
      const result3 = checkDiffFeasibility(15_000);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });
});

describe('Diff Limits — shouldWarnAboutProjectSize', () => {
  describe('Projects below warning threshold', () => {
    it('should not warn for small projects', () => {
      expect(shouldWarnAboutProjectSize(100)).toBe(false);
    });

    it('should not warn at exactly WARN_SEGMENTS_THRESHOLD', () => {
      // Boundary: at threshold, no warning (warning is for exceeding).
      expect(shouldWarnAboutProjectSize(WARN_SEGMENTS_THRESHOLD)).toBe(false);
    });

    it('should not warn for empty projects', () => {
      expect(shouldWarnAboutProjectSize(0)).toBe(false);
    });
  });

  describe('Projects in warning zone', () => {
    it('should warn for projects just above WARN_SEGMENTS_THRESHOLD', () => {
      expect(shouldWarnAboutProjectSize(WARN_SEGMENTS_THRESHOLD + 1)).toBe(true);
    });

    it('should warn for projects at 75% of hard limit', () => {
      const count = Math.floor(MAX_SEGMENTS_PER_DIFF * 0.75);
      expect(shouldWarnAboutProjectSize(count)).toBe(true);
    });

    it('should warn at exactly MAX_SEGMENTS_PER_DIFF', () => {
      // At the hard limit, still feasible but should warn.
      expect(shouldWarnAboutProjectSize(MAX_SEGMENTS_PER_DIFF)).toBe(true);
    });
  });

  describe('Projects exceeding hard limit', () => {
    it('should not warn for projects exceeding MAX_SEGMENTS_PER_DIFF', () => {
      // Above hard limit: not a warning, it's a refusal.
      expect(shouldWarnAboutProjectSize(MAX_SEGMENTS_PER_DIFF + 1)).toBe(false);
    });

    it('should not warn for very large projects', () => {
      // These will be refused, not warned.
      expect(shouldWarnAboutProjectSize(50_000)).toBe(false);
    });
  });
});

describe('Diff Limits — getProjectSizeWarning', () => {
  it('should include segment count in warning message', () => {
    const warning = getProjectSizeWarning(6_500);

    expect(warning).toContain('6,500');
  });

  it('should indicate diff may be slow', () => {
    const warning = getProjectSizeWarning(7_000);

    expect(warning).toMatch(/slow/i);
  });

  it('should format large numbers with locale separators', () => {
    const warning = getProjectSizeWarning(8_234);

    // Should use locale formatting (e.g. "8,234" in en-US).
    expect(warning).toContain('8,234');
  });
});

describe('Diff Limits — getPartialDiffExplanation', () => {
  it('should explain how many changes are shown', () => {
    const explanation = getPartialDiffExplanation(5_000, 8_234);

    expect(explanation).toContain('5,000');
  });

  it('should explain total changes before truncation', () => {
    const explanation = getPartialDiffExplanation(5_000, 8_234);

    expect(explanation).toContain('8,234');
  });

  it('should indicate results are truncated', () => {
    const explanation = getPartialDiffExplanation(5_000, 10_000);

    expect(explanation).toMatch(/truncat/i);
  });

  it('should mention performance as the reason', () => {
    const explanation = getPartialDiffExplanation(5_000, 8_000);

    expect(explanation).toMatch(/performance/i);
  });

  it('should indicate how many changes are omitted', () => {
    const explanation = getPartialDiffExplanation(5_000, 8_234);

    // 8,234 - 5,000 = 3,234 omitted
    expect(explanation).toContain('3,234');
  });

  it('should handle exact limit case', () => {
    const explanation = getPartialDiffExplanation(MAX_CHANGES_RETURNED, MAX_CHANGES_RETURNED + 1);

    expect(explanation).toContain('5,000');
    expect(explanation).toContain('5,001');
  });
});

describe('Diff Limits — Stress Test Scenarios', () => {
  describe('Scenario: Solo translator with typical project', () => {
    it('should allow diff for typical 500-segment project', () => {
      // Typical project size for a solo translator.
      const result = checkDiffFeasibility(500);

      expect(result.status).toBe('complete');
      expect(shouldWarnAboutProjectSize(500)).toBe(false);
    });
  });

  describe('Scenario: Large manual or book translation', () => {
    it('should allow diff for 3,000-segment project without warning', () => {
      // Large project but below warning threshold.
      const result = checkDiffFeasibility(3_000);

      expect(result.status).toBe('complete');
      expect(shouldWarnAboutProjectSize(3_000)).toBe(false);
    });
  });

  describe('Scenario: Very large technical documentation', () => {
    it('should allow diff for 7,500-segment project with warning', () => {
      // Very large project in warning zone.
      const result = checkDiffFeasibility(7_500);

      expect(result.status).toBe('complete');
      expect(shouldWarnAboutProjectSize(7_500)).toBe(true);

      const warning = getProjectSizeWarning(7_500);
      expect(warning).toContain('7,500');
    });
  });

  describe('Scenario: Enterprise-scale project exceeding limits', () => {
    it('should refuse diff for 25,000-segment project', () => {
      // Enterprise project that exceeds reasonable limits.
      const result = checkDiffFeasibility(25_000);

      expect(result.status).toBe('refused');
      if (result.status === 'refused') {
        expect(result.reason).toContain('25,000');
        expect(result.reason).toContain('10,000');
      }
    });
  });

  describe('Scenario: Partial diff with many changes', () => {
    it('should explain partial diff for 8,234 changes truncated to 5,000', () => {
      // Simulates a diff that found 8,234 changes but can only return 5,000.
      const explanation = getPartialDiffExplanation(5_000, 8_234);

      // User should understand:
      // 1. What they're seeing (5,000 changes)
      // 2. What the total was (8,234 changes)
      // 3. Why it was truncated (performance)
      // 4. How many were omitted (3,234)
      expect(explanation).toContain('5,000');
      expect(explanation).toContain('8,234');
      expect(explanation).toMatch(/truncat/i);
      expect(explanation).toContain('3,234');
    });
  });

  describe('Scenario: Boundary at exactly 10,000 segments', () => {
    it('should handle project at exact limit boundary', () => {
      // Exactly at MAX_SEGMENTS_PER_DIFF: should be allowed but warned.
      const atLimit = checkDiffFeasibility(10_000);
      const overLimit = checkDiffFeasibility(10_001);

      expect(atLimit.status).toBe('complete');
      expect(shouldWarnAboutProjectSize(10_000)).toBe(true);

      expect(overLimit.status).toBe('refused');
      expect(shouldWarnAboutProjectSize(10_001)).toBe(false); // Not warned, refused.
    });
  });
});

describe('Diff Limits — Trust Preservation', () => {
  it('should never silently truncate (all states have explicit status)', () => {
    // The DiffCompleteness type guarantees explicit status.
    // This test documents the design intent.
    const complete: DiffCompleteness = { status: 'complete' };
    const partial: DiffCompleteness = {
      status: 'partial',
      truncatedAt: 5_000,
      reason: 'Test reason',
    };
    const refused: DiffCompleteness = {
      status: 'refused',
      reason: 'Test reason',
    };

    // All states are distinguishable.
    expect(complete.status).not.toBe(partial.status);
    expect(partial.status).not.toBe(refused.status);
    expect(complete.status).not.toBe(refused.status);
  });

  it('should provide human-readable reasons for all degradation', () => {
    // Refused: always has reason.
    const refused = checkDiffFeasibility(15_000);
    if (refused.status === 'refused') {
      expect(refused.reason.length).toBeGreaterThan(0);
      expect(refused.reason).not.toMatch(/undefined|null/i);
    }

    // Partial: explanation is readable.
    const partialExplanation = getPartialDiffExplanation(5_000, 8_000);
    expect(partialExplanation.length).toBeGreaterThan(0);
    expect(partialExplanation).not.toMatch(/undefined|null|NaN/i);

    // Warning: message is readable.
    const warning = getProjectSizeWarning(7_000);
    expect(warning.length).toBeGreaterThan(0);
    expect(warning).not.toMatch(/undefined|null|NaN/i);
  });

  it('should be deterministic across all helper functions', () => {
    // Same inputs must always produce same outputs.
    const segmentCount = 15_000;

    const feasibility1 = checkDiffFeasibility(segmentCount);
    const feasibility2 = checkDiffFeasibility(segmentCount);
    expect(feasibility1).toEqual(feasibility2);

    const warn1 = shouldWarnAboutProjectSize(7_000);
    const warn2 = shouldWarnAboutProjectSize(7_000);
    expect(warn1).toBe(warn2);

    const warning1 = getProjectSizeWarning(7_000);
    const warning2 = getProjectSizeWarning(7_000);
    expect(warning1).toBe(warning2);

    const partial1 = getPartialDiffExplanation(5_000, 8_000);
    const partial2 = getPartialDiffExplanation(5_000, 8_000);
    expect(partial1).toBe(partial2);
  });
});

