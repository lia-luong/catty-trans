// Exercise Spine Harness - Minimal script to exercise the full Catty Trans workflow
// without UI. This demonstrates the complete data flow: project creation, translation
// changes, snapshot commits, and rollback operations using only public interfaces.
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// Core domain imports - pure functions for state transitions
import { applyTranslationChange } from '../core-domain/state/project-state';
import type { TranslationChange } from '../core-domain/state/project-state';
import { commitSnapshot, rollbackToSnapshot } from '../core-domain/history/versioning';
import type { VersionedState } from '../core-domain/history/versioning';
import type { SnapshotId } from '../core-domain/state/domain-entities';

// Domain entity types
import type {
  ClientId,
  ProjectId,
  SegmentId,
  LanguageCode,
  Project,
  Segment,
} from '../core-domain/state/domain-entities';
import type { ProjectState } from '../core-domain/state/project-state';
import type { TargetSegmentId, TargetSegmentStatus } from '../core-domain/state/translation-types';

// Adapter imports - persistence layer
import { saveSnapshot, loadProjectState } from '../adapters/storage-sqlite/sqlite-project-snapshot-adapter';
import { createDatabaseWrapper } from './db-wrapper';

// Helper function to cast strings to branded types (similar to test fixtures).
// This keeps the harness code clean while respecting domain type branding.
function asBrand<T>(value: string): T {
  return value as unknown as T;
}

// Initialize in-memory SQLite database and create schema.
// Reads the schema SQL file and executes all statements to set up tables.
function initializeDatabase(): ReturnType<typeof createDatabaseWrapper> {
  // Create in-memory database for temporary execution
  const sqliteDb = new Database(':memory:');

  // Read and execute schema
  const schemaPath = path.join(
    __dirname,
    '../adapters/storage-sqlite/schema-projects-snapshots.sql',
  );
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Remove SQL comments (lines starting with -- or block comments)
  // Split by newlines, filter out comment lines, then join back
  const cleanedSql = schemaSql
    .split('\n')
    .map((line: string) => {
      // Remove inline comments (everything after --)
      const commentIndex = line.indexOf('--');
      if (commentIndex >= 0) {
        return line.substring(0, commentIndex).trim();
      }
      return line.trim();
    })
    .filter((line: string) => line.length > 0)
    .join('\n');

  // Execute all statements at once (better-sqlite3 handles multiple statements)
  sqliteDb.exec(cleanedSql);

  return createDatabaseWrapper(sqliteDb);
}

// Create initial ProjectState with a project, one segment, and empty target segments.
// This represents a fresh project ready for translation work.
function createInitialProjectState(): ProjectState {
  const projectId = asBrand<ProjectId>('exercise-project-1');
  const clientId = asBrand<ClientId>('exercise-client-1');
  const segmentId = asBrand<SegmentId>('exercise-segment-1');
  const sourceLang = asBrand<LanguageCode>('en');
  const targetLang = asBrand<LanguageCode>('fr');

  const project: Project = {
    id: projectId,
    clientId,
    name: 'Exercise Test Project',
    sourceLanguage: sourceLang,
    targetLanguages: [targetLang],
    status: 'in_progress',
  };

  const segment: Segment = {
    id: segmentId,
    projectId,
    indexWithinProject: 0,
    sourceText: 'Hello world',
    sourceLanguage: sourceLang,
    isLocked: false,
  };

  return {
    project,
    segments: [segment],
    targetSegments: [],
  };
}

// Create initial VersionedState with empty history graph.
// This represents a project that hasn't had any snapshots committed yet.
function createInitialVersionedState(): VersionedState {
  return {
    currentState: createInitialProjectState(),
    history: {
      snapshots: new Map(),
      parentMap: new Map(),
    },
  };
}

// Format ProjectState for display, showing key information about the project
// and its target segments in a human-readable format.
function formatState(state: ProjectState): string {
  const lines: string[] = [];
  lines.push(`  Project: ${state.project.name} (${state.project.sourceLanguage} -> ${state.project.targetLanguages.join(', ')})`);
  lines.push(`  Segments: ${state.segments.length}`);
  lines.push(`  Target Segments: ${state.targetSegments.length}`);

  for (const targetSegment of state.targetSegments) {
    const segment = state.segments.find((s) => s.id === targetSegment.segmentId);
    const segmentIndex = segment ? segment.indexWithinProject : '?';
    lines.push(
      `    Segment ${segmentIndex} [${targetSegment.targetLanguage}]: "${targetSegment.translatedText}" (${targetSegment.status})`,
    );
  }

  return lines.join('\n');
}

// Compare two ProjectState objects for equality by comparing their JSON serialization.
// This is a simple but effective way to verify state matches exactly.
function areStatesEqual(a: ProjectState, b: ProjectState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Main execution flow: exercises the full spine from project creation through rollback.
function main() {
  console.log('=== Catty Trans Spine Exercise ===\n');

  // Step 1: Initialize database
  console.log('1. Initializing database...');
  const db = initializeDatabase();
  console.log('   ✓ Database initialized\n');

  // Step 2: Create initial project state
  console.log('2. Creating project...');
  let versionedState = createInitialVersionedState();
  const projectId = versionedState.currentState.project.id;
  const segmentId = versionedState.currentState.segments[0].id;
  const targetLang = versionedState.currentState.project.targetLanguages[0];
  console.log(`   ✓ Created project: ${versionedState.currentState.project.name}`);
  console.log(`     ${versionedState.currentState.project.sourceLanguage} -> ${targetLang}\n`);

  // Step 3: Apply first translation change and commit snapshot S1
  console.log('3. Applying first translation change and committing snapshot S1...');
  const change1: TranslationChange = {
    projectId,
    segmentId,
    targetLanguage: targetLang,
    targetSegmentId: asBrand<TargetSegmentId>('target-segment-1'),
    newText: 'Bonjour',
    newStatus: 'translated' as TargetSegmentStatus,
  };

  const snapshotId1 = asBrand<SnapshotId>('snapshot-1');
  const timestamp1 = Date.now();

  // commitSnapshot applies the change AND creates a snapshot of the resulting state
  versionedState = commitSnapshot(
    versionedState,
    change1,
    snapshotId1,
    timestamp1,
    'First translation',
  );

  // Persist snapshot to database using adapter
  saveSnapshot(
    db,
    versionedState.currentState,
    snapshotId1,
    timestamp1,
    'First translation',
  );

  // Capture S1 state for later comparison
  const s1State = versionedState.history.snapshots.get(snapshotId1)!.state;
  console.log(`   ✓ Applied change: "${change1.newText}" (${change1.newStatus})`);
  console.log(`   ✓ Committed snapshot S1 (${snapshotId1})\n`);

  // Step 4: Apply second translation change (without committing)
  console.log('4. Applying second translation change...');
  const change2: TranslationChange = {
    projectId,
    segmentId,
    targetLanguage: targetLang,
    targetSegmentId: asBrand<TargetSegmentId>('target-segment-1'), // Same target segment
    newText: 'Bonjour le monde',
    newStatus: 'approved' as TargetSegmentStatus,
  };

  // Apply change directly to current state
  versionedState = {
    ...versionedState,
    currentState: applyTranslationChange(versionedState.currentState, change2),
  };

  console.log(`   ✓ Applied change: "${change2.newText}" (${change2.newStatus})\n`);

  // Step 5: Display state before rollback
  console.log('5. State before rollback:');
  console.log(formatState(versionedState.currentState));
  console.log();

  // Step 6: Rollback to snapshot S1
  console.log('6. Rolling back to snapshot S1...');
  versionedState = rollbackToSnapshot(versionedState, snapshotId1);
  console.log(`   ✓ Rolled back to snapshot S1\n`);

  // Step 7: Display state after rollback
  console.log('7. State after rollback:');
  console.log(formatState(versionedState.currentState));
  console.log();

  // Step 8: Verify state matches S1 exactly
  console.log('8. Verification:');
  const statesMatch = areStatesEqual(versionedState.currentState, s1State);
  if (statesMatch) {
    console.log('   ✓ States match S1 exactly');
  } else {
    console.log('   ✗ States do NOT match S1');
    console.log('   Expected (S1):');
    console.log(formatState(s1State));
    console.log('   Actual:');
    console.log(formatState(versionedState.currentState));
    process.exit(1);
  }

  // Step 9: Verify database persistence (optional check)
  console.log('\n9. Verifying database persistence...');
  const loadedState = loadProjectState(db, projectId);
  if (loadedState && areStatesEqual(loadedState, s1State)) {
    console.log('   ✓ Database contains correct snapshot');
  } else {
    console.log('   ✗ Database state does not match S1');
    process.exit(1);
  }

  console.log('\n=== Exercise completed successfully ===');
}

// Run the harness
main();

