/**
 * G14 — core-domain Has No IO
 *
 * Golden test to ensure that core-domain remains pure with no side effects.
 * This architectural guardrail prevents violations that would poison the
 * architecture and break the domain's purity guarantees.
 *
 * Scenario: AI adds convenience logic.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('G14 — core-domain Has No IO', () => {
  const coreDomainPath = path.join(__dirname, '../../../core-domain');

  // Forbidden import patterns that indicate IO or side effects
  const forbiddenImports = [
    // Filesystem access
    /from\s+['"]fs['"]/,
    /from\s+['"]fs\/promises['"]/,
    /require\s*\(\s*['"]fs['"]\s*\)/,
    /require\s*\(\s*['"]fs\/promises['"]\s*\)/,
    /import\s+.*\s+from\s+['"]fs['"]/,
    /import\s+.*\s+from\s+['"]fs\/promises['"]/,

    // Database access
    /from\s+['"]sqlite['"]/,
    /from\s+['"]better-sqlite3['"]/,
    /from\s+['"]sqlite3['"]/,
    /require\s*\(\s*['"]sqlite['"]\s*\)/,
    /require\s*\(\s*['"]better-sqlite3['"]\s*\)/,
    /require\s*\(\s*['"]sqlite3['"]\s*\)/,

    // Network libraries
    /from\s+['"]http['"]/,
    /from\s+['"]https['"]/,
    /from\s+['"]fetch['"]/,
    /from\s+['"]axios['"]/,
    /from\s+['"]node-fetch['"]/,
    /require\s*\(\s*['"]http['"]\s*\)/,
    /require\s*\(\s*['"]https['"]\s*\)/,
    /require\s*\(\s*['"]axios['"]\s*\)/,

    // Timers and randomness
    /from\s+['"]crypto['"]/,
    /require\s*\(\s*['"]crypto['"]\s*\)/,
    /Math\.random/,
    /Date\.now/,
    /new\s+Date\(\)/,
    /setTimeout/,
    /setInterval/,
    /clearTimeout/,
    /clearInterval/,

    // Process and environment
    /process\./,
    /from\s+['"]process['"]/,
    /require\s*\(\s*['"]process['"]\s*\)/,
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

  it('should not contain any forbidden imports in core-domain', () => {
    // Given: /core-domain directory
    const files = getAllTypeScriptFiles(coreDomainPath);

    expect(files.length).toBeGreaterThan(0);

    const violations: Array<{ file: string; line: number; match: string }> = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of forbiddenImports) {
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
        `Found ${violations.length} forbidden import(s) in core-domain:\n${violationMessages.join('\n')}`,
      );
    }

    expect(violations.length).toBe(0);
  });

  it('should not import from adapters, UI, or runtime layers', () => {
    // Given: /core-domain directory
    const files = getAllTypeScriptFiles(coreDomainPath);

    const forbiddenPaths = [
      /from\s+['"]\.\.\/adapters/,
      /from\s+['"]\.\.\/\.\.\/adapters/,
      /from\s+['"]\.\.\/desktop/,
      /from\s+['"]\.\.\/\.\.\/desktop/,
      /from\s+['"]\.\.\/ui/,
      /from\s+['"]\.\.\/\.\.\/ui/,
      /require\s*\(\s*['"]\.\.\/adapters/,
      /require\s*\(\s*['"]\.\.\/\.\.\/adapters/,
      /require\s*\(\s*['"]\.\.\/desktop/,
      /require\s*\(\s*['"]\.\.\/\.\.\/desktop/,
    ];

    const violations: Array<{ file: string; line: number; match: string }> = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of forbiddenPaths) {
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
        `Found ${violations.length} forbidden import(s) from outer layers in core-domain:\n${violationMessages.join('\n')}`,
      );
    }

    expect(violations.length).toBe(0);
  });
});

