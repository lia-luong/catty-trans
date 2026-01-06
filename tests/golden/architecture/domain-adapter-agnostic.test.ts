/**
 * G15 — Domain Logic Is Adapter-Agnostic
 *
 * Golden test to ensure that core-domain logic does not contain adapter-specific
 * assumptions (SQLite, Postgres, etc.). This enables future migrations to web
 * or other storage backends without rewriting domain logic.
 *
 * Scenario: Storage implementation changes.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('G15 — Domain Logic Is Adapter-Agnostic', () => {
  const coreDomainPath = path.join(__dirname, '../../../core-domain');

  // Adapter-specific patterns that should not appear in core-domain
  const adapterSpecificPatterns = [
    // SQLite-specific
    /SQLite/i,
    /sqlite/i,
    /\.db\b/,
    /CREATE\s+TABLE/i,
    /PRAGMA/i,
    /FOREIGN\s+KEY/i,
    /better-sqlite3/i,

    // Postgres-specific
    /PostgreSQL/i,
    /postgres/i,
    /pg\./,
    /SERIAL/i,
    /BIGSERIAL/i,

    // Database-specific SQL
    /SELECT\s+.*\s+FROM/i,
    /INSERT\s+INTO/i,
    /UPDATE\s+.*\s+SET/i,
    /DELETE\s+FROM/i,

    // File system paths (storage-specific)
    /\.sqlite$/,
    /\.db$/,
    /workspace\.db/,
    /tm_.*\.db/,
  ];

  function getAllTypeScriptFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getAllTypeScriptFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  it('should not contain SQLite-specific assumptions', () => {
    // Given: core-domain logic
    const files = getAllTypeScriptFiles(coreDomainPath);

    expect(files.length).toBeGreaterThan(0);

    const violations: Array<{ file: string; line: number; match: string }> = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments and string literals that might contain documentation
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          continue;
        }

        for (const pattern of adapterSpecificPatterns) {
          if (pattern.test(line)) {
            violations.push({
              file: path.relative(process.cwd(), file),
              line: i + 1,
              match: line.trim(),
            });
          }
        }
      }
    }

    // Then: No violations found
    if (violations.length > 0) {
      const violationMessages = violations.map(
        (v) => `  ${v.file}:${v.line} - ${v.match}`,
      );
      fail(
        `Found ${violations.length} adapter-specific assumption(s) in core-domain:\n${violationMessages.join('\n')}`,
      );
    }

    expect(violations.length).toBe(0);
  });

  it('should not contain database-specific types or logic', () => {
    // Given: core-domain logic
    const files = getAllTypeScriptFiles(coreDomainPath);

    const databaseTypePatterns = [
      /type.*Database/,
      /interface.*Database/,
      /:.*Database/,
      /Database\s*</,
    ];

    const violations: Array<{ file: string; line: number; match: string }> = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          continue;
        }

        for (const pattern of databaseTypePatterns) {
          if (pattern.test(line)) {
            // Allow if it's importing Database type from adapters (which is fine for type definitions)
            // But not if it's using Database in domain logic
            if (!line.includes('from') && !line.includes('import')) {
              violations.push({
                file: path.relative(process.cwd(), file),
                line: i + 1,
                match: line.trim(),
              });
            }
          }
        }
      }
    }

    // Then: No violations found
    if (violations.length > 0) {
      const violationMessages = violations.map(
        (v) => `  ${v.file}:${v.line} - ${v.match}`,
      );
      fail(
        `Found ${violations.length} database-specific type usage(s) in core-domain:\n${violationMessages.join('\n')}`,
      );
    }

    expect(violations.length).toBe(0);
  });
});

