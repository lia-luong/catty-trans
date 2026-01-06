// Translation Memory domain types for the CAT/TMS core domain.
// This module defines pure types and function signatures for TM operations.
// All TM lookup algorithms must be pure functions with no side effects.
//
// Architecture constraint: This module must NEVER import from adapters, UI, or
// runtime layers. All database queries, file I/O, and side effects belong in
// adapters that call these pure functions.

import type { LanguageCode, ClientId } from '../state/domain-entities';

// A TM entry represents a single translation unit (source + target pair) in
// a Translation Memory. This is a pure domain type with no persistence metadata.
export type TMEntry = {
  // Unique identifier for this TM entry within its TM.
  readonly id: string;

  // The source text (original language) of this translation unit.
  readonly sourceText: string;

  // The target text (translated language) of this translation unit.
  readonly targetText: string;

  // Language pair for this entry.
  readonly sourceLanguage: LanguageCode;
  readonly targetLanguage: LanguageCode;

  // Optional metadata about this entry (project origin, translator notes, etc.).
  // This is domain data, not persistence metadata.
  readonly metadata?: Readonly<Record<string, unknown>>;
};

// A TM match represents a found translation with its similarity score.
// This is returned by pure lookup functions in the TM module.
export type TMMatch = {
  // The matched TM entry.
  readonly entry: TMEntry;

  // Match score from 0-100, where 100 = exact match.
  // Scores 95-99: case/punctuation differences
  // Scores 80-94: minor edits
  // Scores 70-79: substantial differences
  readonly score: number;

  // Optional explanation of why this match was selected or scored this way.
  // Helps translators understand the match provenance.
  readonly explanation?: string;
};

// TM lookup function signature (to be implemented).
// This is a pure function: given source text and TM entries, returns matches.
// No database access, no side effects, fully deterministic.
//
// Example usage:
//   const entries = loadTMEntriesFromAdapter(db, clientId); // Adapter: side effect
//   const matches = lookupTM(sourceText, entries); // Domain: pure function
export function lookupTM(
  sourceText: string,
  tmEntries: ReadonlyArray<TMEntry>,
  options?: {
    minScore?: number; // Minimum match score threshold (default: 70)
    maxResults?: number; // Maximum number of results to return
  },
): ReadonlyArray<TMMatch> {
  // TODO: Implement pure TM lookup algorithm
  // Must be deterministic: same input always produces same output
  // Must not perform any IO, database queries, or side effects
  throw new Error('Not yet implemented');
}

// Exact match lookup (to be implemented).
// Returns exact matches (score = 100) for the given source text.
export function lookupExactMatch(
  sourceText: string,
  tmEntries: ReadonlyArray<TMEntry>,
): TMMatch | null {
  // TODO: Implement exact match algorithm
  // Must normalize text (case-folding, whitespace) for comparison
  throw new Error('Not yet implemented');
}

// Fuzzy match lookup (to be implemented).
// Returns fuzzy matches (score 70-99) using edit distance algorithms.
export function lookupFuzzyMatches(
  sourceText: string,
  tmEntries: ReadonlyArray<TMEntry>,
  options?: {
    minScore?: number;
    maxResults?: number;
  },
): ReadonlyArray<TMMatch> {
  // TODO: Implement fuzzy match algorithm (e.g., Levenshtein distance)
  // Must be pure and deterministic
  throw new Error('Not yet implemented');
}

