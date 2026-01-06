// TM Query types for the CAT/TMS core domain.
// This module defines pure types for TM query semantics with deterministic,
// explainable match results. All queries are reproducible: same query + same TM
// state → same result, enabling defensibility when clients dispute translations.
//
// Architecture constraint: This module must NEVER import from adapters, UI, or
// runtime layers. All database queries, file I/O, and side effects belong in
// adapters that call these pure functions.

import type {
  ClientId,
  SnapshotId,
} from '../state/domain-entities';
import type {
  ClientScope,
  TMEntry,
} from './tm-types';

// TMMatchType describes what kind of match occurred in a TM query.
// Only two states exist: exact match or no match. No fuzzy scoring.
//
// This is intentional: eliminates probabilistic behaviour that could produce
// different results on repeated queries with same inputs. Removes ranking
// ambiguity (no "which 85% match is better?" disputes). Aligns with PRD
// requirement for inspectable, deterministic decisions.
//
// Invariants:
// - 'exact': sourceText matches an entry exactly (case-sensitive, whitespace-aware)
// - 'none': no entry with this sourceText exists in the TM
export type TMMatchType = 'exact' | 'none';

// TMQuery represents a Translation Memory lookup request. It captures the
// essentials of a query: what source text to find, within which client's scope,
// and at what point in time (for audit trails).
//
// A TMQuery is deterministic: given the same query and same TM state, execution
// must always produce the same TMMatchResult. This enables translators to prove
// what TM matches were available at translation time when clients dispute wording.
//
// Invariants:
// - sourceText is non-empty after trimming; empty queries are not valid
// - clientScope must be a valid ClientScope wrapping an existing ClientId
// - queryTimestamp must be >= 0 (epoch milliseconds since Unix epoch); represents
//   the logical moment of query, useful for "TM as of time X" audit queries
// - sourceText must be normalized consistently (same case, whitespace handling)
//   across queries to ensure deterministic matching
//
// Forbidden states:
// - Empty or whitespace-only sourceText; cannot match against empty queries
// - clientScope mismatched with entries being queried (structural violation of
//   client isolation)
// - queryTimestamp in future relative to TM entry creation times; queries should
//   not request matches from entries created after the query timestamp
// - Cross-client sourceText leakage; queries must respect client scope invariant
export type TMQuery = {
  // Source language text to search for in the TM. This is the lookup key.
  // Translator needs to find existing translations for this exact text.
  //
  // Business intent: enables finding existing translations for identical source
  // text, reducing redundant translation work and ensuring terminology
  // consistency across projects.
  readonly sourceText: string;

  // Client scope that constrains this query. The result must only contain
  // entries belonging to this client. This is a structural enforcement:
  // entries from other clients cannot be returned, regardless of sourceText match.
  //
  // Business intent: prevents cross-client contamination. Translator working
  // on Client B's project must never see suggestions from Client A's TM,
  // protecting IP and confidentiality.
  readonly clientScope: ClientScope;

  // Logical timestamp (epoch milliseconds) when this query is being executed.
  // Used for audit trails: enables "what TM matches existed at time X" queries
  // to support defensibility when clients dispute whether a match was available.
  //
  // Business intent: allows translators to prove what TM state existed at
  // translation time. If client disputes wording, translator can re-run query
  // against TM as it existed during the original translation session.
  readonly queryTimestamp: number;
};

// TMMatchResult represents the outcome of a Translation Memory query. Every
// result includes the original query, the match type, and a human-readable
// explanation of why this match occurred (or didn't).
//
// This type is deterministic: same TMQuery against same TM state always produces
// identical TMMatchResult. This guarantee enables audit trails and defensibility.
// The provenanceExplanation field answers: "Why did this match occur, and where
// did it come from?" enabling translators to prove they followed TM guidance.
//
// Invariants:
// - query must be non-null and represent a valid TMQuery
// - matchType is 'exact' when matchedEntry is non-null; 'none' when undefined
// - matchedEntry is non-null only when matchType is 'exact'; it is undefined
//   when no match found
// - provenanceExplanation must always be non-empty; every result must be
//   explainable to users
// - matchedEntry, when present, must belong to the client scope in query;
//   cross-client entries must never be returned
// - matchedEntry.sourceText must exactly equal query.sourceText (case-sensitive,
//   whitespace-aware)
//
// Forbidden states:
// - matchType 'exact' with undefined matchedEntry (inconsistent state)
// - matchType 'none' with non-null matchedEntry (inconsistent state)
// - Empty or missing provenanceExplanation; users must understand why result
//   was returned or not returned
// - matchedEntry belonging to different client than query.clientScope
// - matchedEntry.sourceText differing from query.sourceText; match must be exact
export type TMMatchResult = {
  // The original query that produced this result. Retained for traceability:
  // enables translators to reproduce the exact query-result pair if clients
  // dispute wording.
  //
  // Business intent: supports audit trails. Translator can show client the
  // exact source text queried, the timestamp of query, and which client scope
  // was searched, proving the result is defensible.
  readonly query: TMQuery;

  // Type of match that occurred: 'exact' if sourceText found, 'none' if not.
  // Deterministic: same query + same TM state always produces same matchType.
  //
  // Business intent: enables translator to quickly understand whether TM had
  // relevant guidance. No fuzzy scoring; either exact match exists or it doesn't.
  readonly matchType: TMMatchType;

  // The matched TM entry, if matchType is 'exact'. Undefined when no match found.
  // This entry includes complete provenance (projectId, snapshotId, createdAt)
  // enabling defensibility.
  //
  // Business intent: when translator follows TM match, this entry proves:
  // - Which project contributed the translation (projectId)
  // - Which snapshot it came from (snapshotId) — enables "what was TM state at
  //   time X" audit queries
  // - When the entry was created (createdAt) — helps translators understand if
  //   match is recent or legacy
  // - The actual target text (targetText) that was suggested
  readonly matchedEntry?: TMEntry;

  // Human-readable explanation of this match result. This answers:
  // - For exact matches: "Found entry from [project] in snapshot [snapshot] at
  //   [timestamp], contributed by [client]"
  // - For no matches: "No exact match found in client's TM" or "TM contains [N]
  //   similar entries from [project], but no exact sourceText match"
  //
  // Business intent: enables translators to understand and defend TM decisions.
  // When clients dispute wording, translator can reference this explanation to
  // show whether they followed TM, accepted alternative, or overrode guidance
  // with justification.
  //
  // Invariant: must be non-empty and must not contain placeholder text like
  // "unknown source" without explicit indication of missing information.
  readonly provenanceExplanation: string;
};

