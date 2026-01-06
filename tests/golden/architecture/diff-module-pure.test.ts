/**
 * G16 — Diff Module Remains Pure
 *
 * Golden test to ensure that the diff computation module in core-domain
 * remains pure with no side effects. This prevents accidental introduction
 * of file I/O, export formatting, or other side effects into diff algorithms.
 *
 * Scenario: Developer implements diff computation and accidentally adds file export.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('G16 — Diff Module Remains Pure', () => {
  const diffModulePath = path.join(__dirname, '../../../core-domain/diff');

  // Check if diff module directory exists
  const diffModuleExists = fs.existsSync(diffModulePath);

  it('should not contain any forbidden imports in diff module', () => {
    // Given: Diff module may not exist yet (planned), but if it does, it must be pure
    if (!diffModuleExists) {
      // Module doesn't exist yet, which is acceptable (it's planned)
      expect(true).toBe(true);
      return;
    }

    // Forbidden import patterns that indicate IO or side effects
    const forbiddenImports = [
      // Filesystem access
      /from\s+['"]fs['"]/,
      /from\s+['"]fs\/promises['"]/,
      /require\s*\(\s*['"]fs['"]\s*\)/,
      /require\s*\(\s*['"]fs\/promises['"]\s*\)/,

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

      // Timers and randomness
      /from\s+['"]crypto['"]/,
      /Math\.random/,
      /Date\.now/,
      /new\s+Date\(\)/,

      // Process and environment
      /process\./,
      /from\s+['"]process['"]/,
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

    const files = getAllTypeScriptFiles(diffModulePath);
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
        `Found ${violations.length} forbidden import(s) in diff module:\n${violationMessages.join('\n')}`,
      );
    }

    expect(violations.length).toBe(0);
  });

  it('should not import from adapters, UI, or runtime layers', () => {
    if (!diffModuleExists) {
      expect(true).toBe(true);
      return;
    }

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

    const files = getAllTypeScriptFiles(diffModulePath);
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
        `Found ${violations.length} forbidden import(s) from outer layers in diff module:\n${violationMessages.join('\n')}`,
      );
    }

    expect(violations.length).toBe(0);
  });
});

