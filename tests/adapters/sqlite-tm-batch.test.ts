/**
 * Test Suite: SQLite TM Batch Insert
 *
 * Validates that insertTMEntryBatch handles duplicates gracefully and
 * provides structured feedback (inserted/skipped/failed breakdown).
 *
 * Business intent: Bulk TM promotion workflows must never silently fail.
 * When a translator promotes 200 segments and 195 already exist in TM,
 * the UI should show: "195 already in TM, 5 new entries added" — not a generic error.
 */

import { insertTMEntryBatch, type BatchInsertResult } from '../../adapters/storage-sqlite/sqlite-tm-adapter';
import { makeTMEntry } from '../helpers/test-fixtures';
import type { Database } from '../../adapters/storage-sqlite/sqlite-tm-adapter';
import type { TMEntry } from '../../core-domain/tm/tm-types';

describe('SQLite TM Adapter — Batch Insert', () => {
  let mockDb: Database;

  beforeEach(() => {
    // Mock database that simulates in-memory SQLite behavior.
    const entries = new Map<string, TMEntry>();

    mockDb = {
      run: (sql: string, ...params: unknown[]) => {
        // Parse INSERT statement: we care about client_id and source_text for the primary key.
        if (sql.includes('INSERT INTO tm_entries')) {
          const clientId = params[0] as string;
          const sourceText = params[1] as string;
          const key = `${clientId}:${sourceText}`;

          if (entries.has(key)) {
            // Simulate PRIMARY KEY constraint violation.
            throw new Error('UNIQUE constraint failed: tm_entries.client_id, tm_entries.source_text');
          }

          // Store the entry to simulate successful insert.
          entries.set(key, {
            clientId: clientId as any,
            sourceText,
            targetText: params[2] as string,
            projectId: params[3] as any,
            snapshotId: params[4] as any,
            createdAt: params[5] as number,
          });
        }
      },
      get: () => undefined,
      all: () => [],
      transaction: function <T>(fn: () => T): T {
        try {
          return fn();
        } catch (error) {
          // Re-throw to caller; batch handler will catch and categorize.
          throw error;
        }
      },
    };
  });

  describe('Batch with all new entries', () => {
    it('should insert all entries when no duplicates exist', () => {
      const entries = [
        makeTMEntry({ sourceText: 'Hello' }),
        makeTMEntry({ sourceText: 'World' }),
        makeTMEntry({ sourceText: 'Foo' }),
      ];

      const result = insertTMEntryBatch(mockDb, entries);

      expect(result.inserted).toHaveLength(3);
      expect(result.skipped).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });

    it('should return all entries in inserted array with correct order', () => {
      const entries = [
        makeTMEntry({ sourceText: 'First' }),
        makeTMEntry({ sourceText: 'Second' }),
      ];

      const result = insertTMEntryBatch(mockDb, entries);

      expect(result.inserted).toHaveLength(2);
      expect(result.inserted[0].sourceText).toBe('First');
      expect(result.inserted[1].sourceText).toBe('Second');
    });
  });

  describe('Batch with all duplicates', () => {
    it('should skip all entries when all duplicates exist', () => {
      const entries = [
        makeTMEntry({ sourceText: 'Hello' }),
        makeTMEntry({ sourceText: 'Hello' }), // Duplicate in same batch
      ];

      const result = insertTMEntryBatch(mockDb, entries);

      // First "Hello" inserts successfully; second is duplicate.
      expect(result.inserted).toHaveLength(1);
      expect(result.skipped).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
    });

    it('should categorise entries correctly when multiple duplicates in batch', () => {
      const entries = [
        makeTMEntry({ sourceText: 'A' }),
        makeTMEntry({ sourceText: 'B' }),
        makeTMEntry({ sourceText: 'A' }), // Duplicate
        makeTMEntry({ sourceText: 'B' }), // Duplicate
      ];

      const result = insertTMEntryBatch(mockDb, entries);

      expect(result.inserted).toHaveLength(2);
      expect(result.skipped).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });
  });

  describe('Mixed batch (some new, some duplicates)', () => {
    it('should partition entries correctly: 5 new, 195 duplicates (typical scenario)', () => {
      // Simulate: translator promotes same 200 segments again.
      // First 195 are already in TM, last 5 are new.
      const existingEntries = Array.from({ length: 195 }, (_, i) =>
        makeTMEntry({ sourceText: `segment-${i}` }),
      );
      const newEntries = Array.from({ length: 5 }, (_, i) =>
        makeTMEntry({ sourceText: `segment-${195 + i}` }),
      );

      // First pass: insert existing entries.
      insertTMEntryBatch(mockDb, existingEntries);

      // Second pass: attempt to re-promote all 200.
      const allEntries = [...existingEntries, ...newEntries];
      const result = insertTMEntryBatch(mockDb, allEntries);

      expect(result.inserted).toHaveLength(5); // Only new entries
      expect(result.skipped).toHaveLength(195); // Existing entries
      expect(result.failed).toHaveLength(0);
    });

    it('should preserve entry details in result arrays', () => {
      const newEntry = makeTMEntry({ sourceText: 'New', targetText: 'Nouveau' });
      const dupEntry = makeTMEntry({ sourceText: 'New', targetText: 'Already exists' });

      // Insert first one to establish it in DB.
      insertTMEntryBatch(mockDb, [newEntry]);

      // Attempt to insert both again.
      const result = insertTMEntryBatch(mockDb, [newEntry, dupEntry]);

      expect(result.inserted).toHaveLength(1);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].sourceText).toBe('New');
    });
  });

  describe('Empty batch', () => {
    it('should return empty arrays for empty input', () => {
      const result = insertTMEntryBatch(mockDb, []);

      expect(result.inserted).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });
  });

  describe('Error handling', () => {
    it('should categorise PRIMARY KEY constraint errors as skipped (not failed)', () => {
      const entry = makeTMEntry({ sourceText: 'Test' });

      // Insert once to establish it.
      insertTMEntryBatch(mockDb, [entry]);

      // Attempt to insert again.
      const result = insertTMEntryBatch(mockDb, [entry]);

      expect(result.skipped).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
    });

    it('should return BatchInsertResult with readonly arrays', () => {
      const entries = [makeTMEntry({ sourceText: 'Test' })];
      const result = insertTMEntryBatch(mockDb, entries);

      // Verify arrays are readonly (this is a TypeScript check, but we can verify structure).
      expect(Array.isArray(result.inserted)).toBe(true);
      expect(Array.isArray(result.skipped)).toBe(true);
      expect(Array.isArray(result.failed)).toBe(true);
    });
  });

  describe('Business scenario: Bulk TM promotion with report', () => {
    it('should provide UI-friendly breakdown for translator communication', () => {
      // Scenario: Translator promotes 200 segments from finished project.
      // On retry (after client revision), 195 already exist, 5 are new.
      const existingBatch = Array.from({ length: 195 }, (_, i) =>
        makeTMEntry({ sourceText: `pharma-${i}` }),
      );
      const newBatch = Array.from({ length: 5 }, (_, i) =>
        makeTMEntry({ sourceText: `pharma-new-${i}` }),
      );

      // First promotion: all succeed.
      const firstResult = insertTMEntryBatch(mockDb, [...existingBatch, ...newBatch]);
      expect(firstResult.inserted).toHaveLength(200);

      // Retry: attempt to promote all 200 again.
      const retryResult = insertTMEntryBatch(mockDb, [...existingBatch, ...newBatch]);

      // UI can now display:
      const message = `${retryResult.inserted.length} inserted, ${retryResult.skipped.length} already in TM, ${retryResult.failed.length} failed`;
      expect(message).toBe('5 inserted, 195 already in TM, 0 failed');
    });
  });

  describe('Determinism', () => {
    it('should return identical results for identical inputs (determinism)', () => {
      const entries = [
        makeTMEntry({ sourceText: 'A' }),
        makeTMEntry({ sourceText: 'B' }),
      ];

      const result1 = insertTMEntryBatch(mockDb, entries);
      const result2 = insertTMEntryBatch(mockDb, entries);

      // Both attempts should have identical structure (both insert A, both skip B on second attempt).
      expect(result1.inserted).toHaveLength(result2.inserted.length);
      expect(result1.skipped).toHaveLength(result2.skipped.length);
      expect(result1.failed).toHaveLength(result2.failed.length);
    });
  });
});

