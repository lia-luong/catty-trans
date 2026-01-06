// TM Promotion Guard for the CAT/TMS core domain.
// This module implements pure validation rules that prevent accidental TM
// pollution from cross-client contamination, ad-hoc projects, and invalid
// provenance. All functions are deterministic with no side effects.
//
// Architecture constraint: This module must NEVER import from adapters, UI, or
// runtime layers. All persistence, logging, and side effects belong in adapters
// that call these pure functions.

import type {
  ClientId,
  Project,
  Segment,
  SnapshotId,
} from '../state/domain-entities';
import type { TargetSegment } from '../state/translation-types';

// PromotionDecision captures the result of evaluating whether a segment can be
// promoted to the Translation Memory. Every decision includes an explicit
// reason for auditability and debugging.
//
// Invariants:
// - reason is always non-empty; every decision must be explainable
// - requiresExplicitOverride is only true when allowed is false and the denial
//   can be overridden by explicit user action (e.g. ad-hoc projects)
// - When allowed is true, requiresExplicitOverride is always false
export type PromotionDecision = {
  // Whether the segment can be promoted to TM under current rules.
  readonly allowed: boolean;

  // Human-readable explanation of the decision. For denials, this explains
  // which rule blocked promotion and why. For approvals, confirms eligibility.
  readonly reason: string;

  // Indicates whether an explicit user override can bypass this denial.
  // Only meaningful when allowed is false. Some rules (like cross-client
  // isolation) cannot be overridden; others (like ad-hoc projects) can be
  // overridden with explicit user confirmation.
  readonly requiresExplicitOverride: boolean;
};

// PromotionContext provides all the information needed to evaluate promotion
// rules for a segment. This bundles the project, snapshot reference, and
// ad-hoc flag into a single parameter to keep the function signature clean.
//
// Invariants:
// - project must be a valid Project with non-empty clientId
// - snapshotId must be non-empty for provenance tracking
// - sourceSegment must belong to the same project (projectId match)
// - isAdHoc indicates whether this is a rush/one-off job that shouldn't
//   automatically contribute to TM
// - existingSourceTexts contains all source texts already in TM for this client
export type PromotionContext = {
  // The project from which the segment is being promoted.
  readonly project: Project;

  // The snapshot that captures the state being promoted. Required for
  // provenance tracking: every TM entry must reference its source snapshot.
  readonly snapshotId: SnapshotId;

  // The source segment corresponding to the target segment being promoted.
  // Used to validate that the target segment belongs to the correct project.
  readonly sourceSegment: Segment;

  // Whether this project is marked as ad-hoc (rush job, one-off work).
  // Ad-hoc projects do not promote to TM by default to prevent pollution
  // from quick, potentially lower-quality translations.
  readonly isAdHoc: boolean;

  // Optional: the client ID of the target TM. When provided, enables
  // cross-client validation to ensure segments are only promoted to TMs
  // belonging to the same client as the source project.
  readonly targetClientId?: ClientId;

  // Set of source texts that already exist in the TM for this client.
  // Used to detect duplicate entries and prevent constraint violations.
  // Empty set indicates no duplicate check is performed (for backwards compatibility).
  //
  // Business intent: enables explicit "entry already exists" handling at the
  // domain level, allowing UI to offer "Update existing?" or "Skip duplicate?"
  // workflows instead of failing with generic database constraint violation.
  readonly existingSourceTexts?: ReadonlySet<string>;
};

// ============================================================================
// FAILURE SCENARIOS (Real-World Examples)
// ============================================================================
//
// Scenario 1: Cross-Client Promotion Attempt
// -------------------------------------------
// Situation: A translator working on Project A (Client: Acme Corp) accidentally
// tries to promote a segment to a TM that belongs to Client B (Globex Inc).
// This could happen if the translator has multiple projects open and selects
// the wrong TM target.
//
// How blocked: The function checks if targetClientId (when provided) matches
// project.clientId. Mismatch returns allowed: false, requiresExplicitOverride:
// false (cannot be overridden - this is an IP protection rule).
//
// Reason returned: "Cross-client promotion blocked: segment belongs to client
// [Acme Corp] but target TM belongs to client [Globex Inc]. This prevents IP
// contamination."
//
// -------------------------------------------
// Scenario 2: Ad-Hoc Rush Job
// -------------------------------------------
// Situation: A translator finishes a late-night rush job marked as ad-hoc
// (quick turnaround, possibly lower quality). They click "promote to TM"
// without realising ad-hoc work shouldn't automatically pollute the TM.
//
// How blocked: The function checks isAdHoc flag. When true, returns allowed:
// false, requiresExplicitOverride: true (can be overridden with explicit
// confirmation if the translator is certain the quality is TM-worthy).
//
// Reason returned: "Ad-hoc projects do not promote to TM by default to prevent
// pollution from rush work. Explicit override required if you confirm this
// translation meets TM quality standards."
//
// -------------------------------------------
// Scenario 3: Missing SnapshotId (System Bug)
// -------------------------------------------
// Situation: Due to a bug in the application layer, a promotion is attempted
// without a valid snapshot reference. This breaks provenance tracking and
// makes the TM entry impossible to audit.
//
// How blocked: The function validates snapshotId is non-empty. Empty/missing
// snapshotId returns allowed: false, requiresExplicitOverride: false (cannot
// be overridden - provenance is mandatory).
//
// Reason returned: "Promotion requires valid snapshotId for provenance
// tracking. Cannot create TM entry without audit trail."
//
// -------------------------------------------
// Scenario 4: Duplicate Entry (Bulk Promotion Workflow)
// -------------------------------------------
// Situation: Translator finishes Project A, promotes 200 segments to TM. Client
// requests minor revision; translator updates 5 segments. Translator then
// bulk-promotes all 200 segments again (standard workflow: "ensure TM is complete").
//
// How blocked: The function checks if sourceSegment.sourceText already exists in
// existingSourceTexts set. When duplicate detected, returns allowed: false,
// requiresExplicitOverride: true (can be overridden - user might want to update
// the existing entry with new translation).
//
// Reason returned: "TM entry already exists for this source text in this client's
// TM. Entry was created from a previous project or session. Override to update
// the existing entry, or skip this segment to keep the current TM entry."
// ============================================================================

// canPromoteSegment evaluates whether a target segment can be promoted to the
// Translation Memory based on business rules. This is a pure function: given
// the same inputs, it always returns the same decision with no side effects.
//
// The function implements fail-fast validation: it checks rules in priority
// order and returns immediately on the first failure. This ensures clear,
// unambiguous denial reasons.
//
// Rule priority (checked in order):
// 1. Valid snapshotId (provenance tracking)
// 2. Project not archived (immutability)
// 3. Non-empty translation (no empty TM entries)
// 4. Segment belongs to project (data integrity)
// 5. Cross-client validation (IP protection)
// 6. Duplicate entry check (constraint violation prevention)
// 7. Ad-hoc project check (quality control)
export function canPromoteSegment(
  targetSegment: TargetSegment,
  context: PromotionContext,
): PromotionDecision {
  // Rule 1: Valid snapshotId required for provenance tracking.
  // Every TM entry must reference the snapshot it came from to support
  // audit trails and defensibility when clients dispute translations.
  const snapshotIdString = context.snapshotId as string;
  if (!snapshotIdString || snapshotIdString.trim().length === 0) {
    return {
      allowed: false,
      reason:
        'Promotion requires valid snapshotId for provenance tracking. ' +
        'Cannot create TM entry without audit trail.',
      requiresExplicitOverride: false,
    };
  }

  // Rule 2: Archived projects are immutable.
  // Once a project is archived, no new TM entries should be created from it.
  // This preserves the historical record and prevents accidental modifications.
  if (context.project.status === 'archived') {
    return {
      allowed: false,
      reason:
        'Cannot promote segments from archived projects. ' +
        'Archived projects are immutable and preserved for historical reference.',
      requiresExplicitOverride: false,
    };
  }

  // Rule 3: Non-empty translation required.
  // Empty translations should never pollute the TM. This catches cases where
  // a segment exists but hasn't actually been translated yet.
  if (targetSegment.translatedText.trim().length === 0) {
    return {
      allowed: false,
      reason:
        'Cannot promote segment with empty translation. ' +
        'TM entries must contain actual translated content.',
      requiresExplicitOverride: false,
    };
  }

  // Rule 4: Segment must belong to the context project.
  // This validates data integrity: the target segment's projectId must match
  // the project in the promotion context. Mismatches indicate a bug or
  // incorrect API usage.
  if (targetSegment.projectId !== context.project.id) {
    return {
      allowed: false,
      reason:
        'Segment does not belong to the specified project. ' +
        'Target segment projectId must match context project id.',
      requiresExplicitOverride: false,
    };
  }

  // Rule 5: Cross-client validation (when target TM client is specified).
  // This is the critical IP protection rule: segments from one client's
  // project must never be promoted to another client's TM. This prevents
  // terminology leakage and protects confidential translations.
  if (
    context.targetClientId !== undefined &&
    context.targetClientId !== context.project.clientId
  ) {
    return {
      allowed: false,
      reason:
        'Cross-client promotion blocked: segment belongs to a different client ' +
        'than the target TM. This prevents IP contamination and protects ' +
        'client confidentiality.',
      requiresExplicitOverride: false,
    };
  }

  // Rule 6: Duplicate entry check (when existingSourceTexts is provided).
  // Prevents database constraint violations during bulk promotion workflows.
  // Translators commonly promote all segments after making edits, which would
  // cause constraint violations for unchanged segments. This check surfaces
  // duplicates explicitly at the domain level, allowing UI to offer
  // "Update existing?" or "Skip duplicate?" workflows.
  if (
    context.existingSourceTexts !== undefined &&
    context.existingSourceTexts.has(context.sourceSegment.sourceText)
  ) {
    return {
      allowed: false,
      reason:
        'TM entry already exists for this source text in this client\'s TM. ' +
        'Entry was created from a previous project or session. ' +
        'Override to update the existing entry, or skip this segment to keep ' +
        'the current TM entry.',
      requiresExplicitOverride: true,
    };
  }

  // Rule 7: Ad-hoc projects do not promote by default.
  // Rush jobs and one-off projects often have lower quality standards or
  // contain client-specific phrasing that shouldn't pollute the main TM.
  // Unlike other rules, this one can be overridden with explicit confirmation.
  if (context.isAdHoc) {
    return {
      allowed: false,
      reason:
        'Ad-hoc projects do not promote to TM by default to prevent pollution ' +
        'from rush work. Explicit override required if you confirm this ' +
        'translation meets TM quality standards.',
      requiresExplicitOverride: true,
    };
  }

  // All rules passed: segment is eligible for TM promotion.
  return {
    allowed: true,
    reason:
      'Segment eligible for TM promotion. All validation rules passed.',
    requiresExplicitOverride: false,
  };
}

