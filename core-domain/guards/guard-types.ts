// Business rule validation and invariant checks for the CAT/TMS core domain.
// This module defines pure types and function signatures for validating
// project states against business rules.
//
// Architecture constraint: This module must NEVER import from adapters, UI, or
// runtime layers. All persistence, reporting, and side effects belong in
// adapters that call these pure functions.

import type { ProjectState } from '../state/project-state';
import type { SegmentId } from '../state/domain-entities';

// Severity level for a validation finding.
export type ValidationSeverity = 'error' | 'warning' | 'info';

// A single validation finding (rule violation or issue detected).
export type ValidationFinding = {
  // The segment ID this finding relates to (if applicable).
  readonly segmentId?: SegmentId;

  // The rule ID that generated this finding.
  readonly ruleId: string;

  // Human-readable message explaining the issue.
  readonly message: string;

  // Severity of this finding.
  readonly severity: ValidationSeverity;

  // Optional suggestion for how to fix the issue.
  readonly suggestion?: string;

  // Optional context (source/target text, surrounding segments, etc.).
  readonly context?: Readonly<Record<string, unknown>>;
};

// A validation rule definition.
export type ValidationRule = {
  // Unique identifier for this rule.
  readonly id: string;

  // Human-readable name for this rule.
  readonly name: string;

  // Category this rule belongs to.
  readonly category: 'consistency' | 'formatting' | 'terminology' | 'numbers' | 'tags' | 'completeness';

  // Severity level for violations of this rule.
  readonly severity: ValidationSeverity;

  // Whether this rule is currently enabled.
  readonly enabled: boolean;

  // Optional rule-specific configuration.
  readonly config?: Readonly<Record<string, unknown>>;
};

// Complete validation result for a project state.
export type ValidationResult = {
  // The state that was validated.
  readonly state: ProjectState;

  // All findings detected by the validation rules.
  readonly findings: ReadonlyArray<ValidationFinding>;

  // Summary statistics.
  readonly summary: {
    readonly totalFindings: number;
    readonly errors: number;
    readonly warnings: number;
    readonly info: number;
  };

  // Whether the state passed validation (no errors).
  readonly isValid: boolean;
};

// Validate a project state against a set of rules (to be implemented).
// This is a pure function: given a state and rules, returns validation results.
// No database access, no side effects, fully deterministic.
//
// Example usage:
//   const state = loadProjectStateFromAdapter(db, projectId); // Adapter: side effect
//   const rules = loadValidationRulesFromAdapter(db, projectId); // Adapter: side effect
//   const result = validateProjectState(state, rules); // Domain: pure function
export function validateProjectState(
  state: ProjectState,
  rules: ReadonlyArray<ValidationRule>,
): ValidationResult {
  // TODO: Implement pure validation logic
  // Must check all enabled rules against the project state
  // Must be deterministic: same inputs always produce same output
  // Must not perform any IO, database queries, or side effects
  throw new Error('Not yet implemented');
}

// Validate a single rule against a project state (to be implemented).
// Pure function for validating one specific rule.
export function validateRule(
  state: ProjectState,
  rule: ValidationRule,
): ReadonlyArray<ValidationFinding> {
  // TODO: Implement single-rule validation
  // Must be pure and deterministic
  throw new Error('Not yet implemented');
}

// Built-in validation rules (to be implemented).
// These are common QA rules that should be available by default.
export const BUILT_IN_RULES: ReadonlyArray<ValidationRule> = [
  // TODO: Define built-in rules (untranslated segments, number mismatches, etc.)
  // These are pure type definitions; implementation comes later
];

