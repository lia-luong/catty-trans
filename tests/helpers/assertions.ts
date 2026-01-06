// Shared assertion helpers for Catty Trans golden tests.
// These functions keep repetitive expectations for integrity reports and
// architectural guardrails in one place, so tests read like executable specs
// instead of low-level assertion lists.

import type { IntegrityReport, IntegrityIssue } from '../../adapters/integrity/integrity-types';

// Assert that an integrity report represents an unsafe state. Golden tests
// for corrupted artefacts use this to document that any checksum mismatch or
// gross inconsistency must block normal project loading until the user takes
// explicit recovery action.
export function expectReportToBeUnsafe(report: IntegrityReport): void {
  // eslint-disable-next-line jest/no-standalone-expect
  expect(report.isSafe).toBe(false);
  // eslint-disable-next-line jest/no-standalone-expect
  expect(report.issues.length).toBeGreaterThan(0);
}

// Find all integrity issues of a particular type, used in tests to express
// which failure mode we are focusing on (e.g. checksum mismatch vs orphaned
// snapshot). This keeps the tests honest about which safety guarantees they
// are exercising.
export function getIssuesByType(
  report: IntegrityReport,
  issueType: IntegrityIssue['issueType'],
): IntegrityIssue[] {
  return report.issues.filter((issue) => issue.issueType === issueType);
}


