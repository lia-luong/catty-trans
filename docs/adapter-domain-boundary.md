# Adapter-Domain Boundary Guide

This document provides clear examples of the architectural boundary between `core-domain` (pure domain logic) and `adapters` (side effects and I/O). Understanding this boundary is critical for maintaining architectural purity.

## Core Principle

**Domain = Pure Functions | Adapters = Side Effects**

- `core-domain` contains **pure, deterministic functions** with no side effects
- `adapters` handle all **I/O, persistence, and side effects**
- Domain functions operate on data structures; adapters load/save data

---

## Example 1: Translation Memory Lookup

### ✅ Correct Pattern

**Domain (pure function):**
```typescript
// core-domain/tm/lookup.ts
export function lookupTM(
  sourceText: string,
  tmEntries: ReadonlyArray<TMEntry>
): ReadonlyArray<TMMatch> {
  // Pure algorithm: no DB, no IO, no side effects
  // Computes match scores, filters, sorts
  return tmEntries
    .map(entry => computeMatchScore(sourceText, entry))
    .filter(match => match.score >= 70)
    .sort((a, b) => b.score - a.score);
}
```

**Adapter (side effects):**
```typescript
// adapters/storage-sqlite/tm-adapter.ts
export function loadTMEntries(db: Database, clientId: string): TMEntry[] {
  // Side effect: database query
  const rows = db.all(
    'SELECT * FROM tm_units WHERE client_id = ?',
    clientId
  );
  return rows.map(row => deserializeTMEntry(row));
}
```

**Application Service (orchestrates):**
```typescript
// desktop/ui/services/tm-service.ts (or similar)
export function performTMLookup(
  db: Database,
  sourceText: string,
  clientId: string
): TMMatch[] {
  // Step 1: Adapter loads data (side effect)
  const entries = loadTMEntries(db, clientId);
  
  // Step 2: Domain computes matches (pure function)
  return lookupTM(sourceText, entries);
}
```

### ❌ Incorrect Pattern

```typescript
// ❌ WRONG: Domain function with side effects
export function lookupTM(
  db: Database,  // ❌ Database in domain!
  sourceText: string
): Promise<TMMatch[]> {  // ❌ Async in domain!
  const rows = await db.query('SELECT * FROM tm_units ...'); // ❌ Side effect!
  // ...
}
```

**Why this is wrong:**
- Domain function performs I/O (database query)
- Domain function is async (side effect)
- Domain depends on infrastructure (Database type)

---

## Example 2: Diff Computation

### ✅ Correct Pattern

**Domain (pure function):**
```typescript
// core-domain/diff/compute.ts
export function computeDiff(
  fromState: ProjectState,
  toState: ProjectState
): DiffResult {
  // Pure algorithm: compares two state objects
  // No file I/O, no database, no side effects
  const changes: DiffEntry[] = [];
  
  // Compare segments, detect changes
  // Return diff structure
  return { fromState, toState, changes, summary: {...} };
}
```

**Adapter (side effects):**
```typescript
// adapters/storage-sqlite/snapshot-adapter.ts
export function loadProjectState(
  db: Database,
  snapshotId: SnapshotId
): ProjectState | null {
  // Side effect: database query
  const row = db.get('SELECT state_json FROM project_snapshots WHERE id = ?', snapshotId);
  if (!row) return null;
  return JSON.parse(row.state_json) as ProjectState;
}

// adapters/export/diff-export-adapter.ts
export function exportDiffToHTML(
  diff: DiffResult,
  outputPath: string
): void {
  // Side effect: file I/O
  const html = renderDiffToHTML(diff);
  fs.writeFileSync(outputPath, html);
}
```

**Application Service (orchestrates):**
```typescript
// desktop/ui/services/diff-service.ts
export function generateAndExportDiff(
  db: Database,
  fromSnapshotId: SnapshotId,
  toSnapshotId: SnapshotId,
  outputPath: string
): void {
  // Step 1: Adapters load data (side effects)
  const fromState = loadProjectState(db, fromSnapshotId);
  const toState = loadProjectState(db, toSnapshotId);
  
  if (!fromState || !toState) throw new Error('Snapshots not found');
  
  // Step 2: Domain computes diff (pure function)
  const diff = computeDiff(fromState, toState);
  
  // Step 3: Adapter exports diff (side effect)
  exportDiffToHTML(diff, outputPath);
}
```

### ❌ Incorrect Pattern

```typescript
// ❌ WRONG: Domain function with file I/O
export function computeDiff(
  fromSnapshotId: string,  // ❌ IDs instead of state objects
  toSnapshotId: string
): DiffResult {
  // ❌ Domain function loads from database
  const fromState = loadFromDB(fromSnapshotId);
  const toState = loadFromDB(toSnapshotId);
  // ...
}

// ❌ WRONG: Domain function exports files
export function exportDiffToHTML(diff: DiffResult, path: string): void {
  fs.writeFileSync(path, renderHTML(diff)); // ❌ File I/O in domain!
}
```

**Why this is wrong:**
- Domain function performs I/O (database queries, file writes)
- Domain function takes IDs instead of state objects (couples to persistence)

---

## Example 3: Validation/Guards

### ✅ Correct Pattern

**Domain (pure function):**
```typescript
// core-domain/guards/validate.ts
export function validateProjectState(
  state: ProjectState,
  rules: ReadonlyArray<ValidationRule>
): ValidationResult {
  // Pure algorithm: validates state against rules
  // No database, no I/O, no side effects
  const findings: ValidationFinding[] = [];
  
  for (const rule of rules) {
    if (rule.enabled) {
      const ruleFindings = validateRule(state, rule);
      findings.push(...ruleFindings);
    }
  }
  
  return {
    state,
    findings,
    summary: computeSummary(findings),
    isValid: findings.every(f => f.severity !== 'error')
  };
}
```

**Adapter (side effects):**
```typescript
// adapters/storage-sqlite/validation-adapter.ts
export function loadValidationRules(
  db: Database,
  projectId: ProjectId
): ValidationRule[] {
  // Side effect: database query
  const rows = db.all(
    'SELECT * FROM validation_rules WHERE project_id = ?',
    projectId
  );
  return rows.map(row => deserializeRule(row));
}

export function saveValidationFindings(
  db: Database,
  findings: ReadonlyArray<ValidationFinding>
): void {
  // Side effect: database write
  // Persist findings for reporting
}
```

**Application Service (orchestrates):**
```typescript
// desktop/ui/services/qa-service.ts
export function runQA(
  db: Database,
  projectId: ProjectId
): ValidationResult {
  // Step 1: Adapter loads state and rules (side effects)
  const state = loadProjectState(db, projectId);
  const rules = loadValidationRules(db, projectId);
  
  if (!state) throw new Error('Project not found');
  
  // Step 2: Domain validates (pure function)
  const result = validateProjectState(state, rules);
  
  // Step 3: Adapter persists findings (side effect)
  saveValidationFindings(db, result.findings);
  
  return result;
}
```

### ❌ Incorrect Pattern

```typescript
// ❌ WRONG: Domain function queries database
export function validateProjectState(
  db: Database,  // ❌ Database in domain!
  projectId: string
): ValidationResult {
  // ❌ Domain function loads from database
  const state = db.get('SELECT * FROM projects WHERE id = ?', projectId);
  const rules = db.all('SELECT * FROM validation_rules ...');
  // ...
}
```

**Why this is wrong:**
- Domain function performs I/O (database queries)
- Domain depends on infrastructure (Database type)

---

## Example 4: State Transitions

### ✅ Correct Pattern

**Domain (pure function):**
```typescript
// core-domain/state/project-state.ts
export function applyTranslationChange(
  previous: ProjectState,
  change: TranslationChange
): ProjectState {
  // Pure function: returns new state, never mutates input
  // No I/O, no side effects, fully deterministic
  return {
    ...previous,
    targetSegments: updateTargetSegments(previous.targetSegments, change)
  };
}
```

**Adapter (side effects):**
```typescript
// adapters/storage-sqlite/project-adapter.ts
export function saveProjectState(
  db: Database,
  state: ProjectState
): void {
  // Side effect: database write
  const stateJson = JSON.stringify(state);
  db.run('INSERT INTO project_snapshots (id, state_json) VALUES (?, ?)', ...);
}
```

**Application Service (orchestrates):**
```typescript
// desktop/ui/services/project-service.ts
export function applyTranslation(
  db: Database,
  projectId: ProjectId,
  change: TranslationChange
): ProjectState {
  // Step 1: Adapter loads state (side effect)
  const currentState = loadProjectState(db, projectId);
  if (!currentState) throw new Error('Project not found');
  
  // Step 2: Domain applies change (pure function)
  const newState = applyTranslationChange(currentState, change);
  
  // Step 3: Adapter saves state (side effect)
  saveProjectState(db, newState);
  
  return newState;
}
```

---

## Decision Tree: Where Does This Code Belong?

Ask these questions:

1. **Does this code perform I/O?** (file system, database, network)
   - ✅ Yes → **Adapter**
   - ❌ No → Continue

2. **Does this code have side effects?** (mutates global state, timers, randomness)
   - ✅ Yes → **Adapter**
   - ❌ No → Continue

3. **Does this code depend on infrastructure?** (Database, FileSystem, HTTP client)
   - ✅ Yes → **Adapter**
   - ❌ No → Continue

4. **Is this code a pure function?** (same input → same output, no side effects)
   - ✅ Yes → **Domain**
   - ❌ No → **Adapter**

### Examples

| Code | Question | Answer | Location |
|------|----------|--------|----------|
| TM lookup algorithm | Pure function? | Yes | `core-domain/tm` |
| SQLite FTS5 query | I/O? | Yes | `adapters/storage-sqlite` |
| Diff computation | Pure function? | Yes | `core-domain/diff` |
| HTML export | I/O? | Yes | `adapters/export` |
| Validation rules | Pure function? | Yes | `core-domain/guards` |
| Save validation results | I/O? | Yes | `adapters/storage-sqlite` |
| State transition | Pure function? | Yes | `core-domain/state` |
| Load state from DB | I/O? | Yes | `adapters/storage-sqlite` |

---

## Common Mistakes to Avoid

### ❌ Mistake 1: "Convenience" Functions in Domain

```typescript
// ❌ WRONG
export function lookupTMWithDB(db: Database, text: string): TMMatch[] {
  const entries = loadFromDB(db); // Side effect in domain!
  return lookupTM(text, entries);
}
```

**Fix:** Keep domain pure, create convenience function in adapter/service layer.

### ❌ Mistake 2: Async Domain Functions

```typescript
// ❌ WRONG
export async function lookupTM(...): Promise<TMMatch[]> {
  // Async implies side effects
}
```

**Fix:** Domain functions are synchronous. Adapters handle async I/O.

### ❌ Mistake 3: Caching in Domain

```typescript
// ❌ WRONG
const cache = new Map(); // Mutable state in domain!
export function lookupTM(...) {
  if (cache.has(key)) return cache.get(key); // Side effect!
  // ...
}
```

**Fix:** Cache in adapters or application services, not in domain.

### ❌ Mistake 4: Error Handling with I/O

```typescript
// ❌ WRONG
export function lookupTM(...) {
  try {
    // ...
  } catch (error) {
    logToFile(error); // I/O in domain!
  }
}
```

**Fix:** Domain functions throw errors. Adapters/services handle logging.

---

## Summary

- **Domain = Pure Functions**: No I/O, no side effects, deterministic
- **Adapters = Side Effects**: All I/O, persistence, infrastructure
- **Services = Orchestration**: Load data → call domain → save results

When in doubt, ask: "Does this code need to touch the outside world?" If yes, it's an adapter. If no, it's domain.

