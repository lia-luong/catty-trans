// Database wrapper that adapts better-sqlite3 to the Database interface
// required by the SQLite adapter. This keeps the adapter layer clean while
// allowing the harness to use a real SQLite database.
import Database from 'better-sqlite3';
import type { Database as AdapterDatabase } from '../adapters/storage-sqlite/sqlite-project-snapshot-adapter';

// Wrap better-sqlite3 Database instance to match the adapter's Database interface.
// This allows the harness to use real SQLite while maintaining adapter abstraction.
export function createDatabaseWrapper(
  sqliteDb: Database.Database,
): AdapterDatabase {
  return {
    // Execute a statement that doesn't return rows (INSERT, UPDATE, DELETE).
    run(sql: string, ...params: unknown[]): void {
      sqliteDb.prepare(sql).run(...params);
    },

    // Execute a query that returns a single row or undefined.
    get<T = unknown>(sql: string, ...params: unknown[]): T | undefined {
      return sqliteDb.prepare(sql).get(...params) as T | undefined;
    },

    // Execute a query that returns all matching rows.
    all<T = unknown>(sql: string, ...params: unknown[]): T[] {
      return sqliteDb.prepare(sql).all(...params) as T[];
    },

    // Execute a function within a transaction.
    // better-sqlite3 transactions automatically commit on success or rollback on error.
    transaction<T>(fn: () => T): T {
      const transaction = sqliteDb.transaction(fn);
      return transaction();
    },
  };
}

