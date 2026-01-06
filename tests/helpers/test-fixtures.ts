// Test fixtures for Catty Trans golden tests.
// These helpers construct minimal but valid domain states so golden tests can
// focus on behaviour (immutability, rollback, integrity) instead of verbose
// setup code. They intentionally live in the test tree to keep core-domain
// free from test-only helpers.

import type {
  ClientId,
  Project,
  ProjectId,
  Segment,
  SegmentId,
  SnapshotId,
} from '../../core-domain/state/domain-entities';
import type {
  ProjectState,
  TranslationChange,
} from '../../core-domain/state/project-state';
import type {
  TargetSegment,
  TargetSegmentId,
  TargetSegmentStatus,
} from '../../core-domain/state/translation-types';
import type {
  HistoryGraph,
  Snapshot,
  VersionedState,
} from '../../core-domain/history/versioning';

// Simple deterministic brand-casting helper so tests can create ids without
// pulling in any runtime generators. This keeps tests explicit while matching
// the branded types used in core-domain.
function asBrand<T>(value: string): T {
  return value as unknown as T;
}

// Create a minimal Project entity that respects core invariants (non-empty
// name, valid language codes, at least one target language that differs from
// the source language). Tests can override fields as needed per scenario.
export function makeProject(overrides: Partial<Project> = {}): Project {
  const id = overrides.id ?? asBrand<ProjectId>('project-1');
  const clientId =
    overrides.clientId ?? asBrand<ClientId>('client-1');

  return {
    id,
    clientId,
    name: overrides.name ?? 'Sample project',
    sourceLanguage: overrides.sourceLanguage ?? (asBrand('en') as Project['sourceLanguage']),
    targetLanguages:
      overrides.targetLanguages ??
      ([asBrand('fr')] as Project['targetLanguages']),
    status: overrides.status ?? 'in_progress',
  };
}

// Create a simple source Segment that is consistent with the provided project.
// This keeps golden tests aligned with domain invariants around projectId,
// sourceLanguage, and ordering.
export function makeSegment(
  project: Project,
  overrides: Partial<Segment> = {},
): Segment {
  return {
    id: overrides.id ?? asBrand<SegmentId>('segment-1'),
    projectId: overrides.projectId ?? project.id,
    indexWithinProject: overrides.indexWithinProject ?? 0,
    sourceText: overrides.sourceText ?? 'Hello world.',
    sourceLanguage: overrides.sourceLanguage ?? project.sourceLanguage,
    isLocked: overrides.isLocked ?? false,
  };
}

// Create a TargetSegment for a given project and source segment. This keeps
// the relationship between project, segment, and language valid for tests
// that exercise translation updates and history.
export function makeTargetSegment(
  project: Project,
  segment: Segment,
  overrides: Partial<TargetSegment> = {},
): TargetSegment {
  const targetLanguage =
    overrides.targetLanguage ?? project.targetLanguages[0];

  return {
    id: overrides.id ?? asBrand<TargetSegmentId>('tsegment-1'),
    projectId: overrides.projectId ?? project.id,
    segmentId: overrides.segmentId ?? segment.id,
    targetLanguage,
    translatedText: overrides.translatedText ?? '',
    status: overrides.status ?? ('draft' as TargetSegmentStatus),
  };
}

// Construct a ProjectState from project, segments, and target segments. This
// helper ensures tests consistently use immutable-style arrays when seeding
// state for versioning and mutation checks.
export function makeProjectState(options?: {
  project?: Project;
  segments?: Segment[];
  targetSegments?: TargetSegment[];
}): ProjectState {
  const project = options?.project ?? makeProject();
  const baseSegment = makeSegment(project);

  const segments = options?.segments ?? [baseSegment];
  const targetSegments =
    options?.targetSegments ??
    [makeTargetSegment(project, baseSegment)];

  return {
    project,
    segments,
    targetSegments,
  };
}

// Helper to create a TranslationChange that updates or creates a single
// target segment for a given project/segment/language. Tests can override
// ids or status to cover specific edge cases.
export function makeTranslationChange(options: {
  project: Project;
  segment: Segment;
  targetLanguage?: Project['targetLanguages'][number];
  text?: string;
  status?: TargetSegmentStatus;
  targetSegmentId?: TargetSegmentId;
}): TranslationChange {
  const targetLanguage =
    options.targetLanguage ?? options.project.targetLanguages[0];

  return {
    projectId: options.project.id,
    segmentId: options.segment.id,
    targetLanguage,
    targetSegmentId:
      options.targetSegmentId ??
      (asBrand<TargetSegmentId>('tsegment-change-1')),
    newText: options.text ?? 'Bonjour le monde.',
    newStatus: options.status ?? 'translated',
  };
}

// Construct an empty HistoryGraph suitable for tests that build up snapshots
// through commit operations. This keeps the graph initialisation logic in one
// place so tests stay focused on behavioural expectations.
export function makeEmptyHistoryGraph(): HistoryGraph {
  return {
    snapshots: new Map<SnapshotId, Snapshot>(),
    parentMap: new Map<SnapshotId, SnapshotId>(),
  };
}

// Build a VersionedState wrapper around an initial ProjectState so tests can
// exercise commit/rollback behaviour without duplicating boilerplate.
export function makeVersionedState(
  state?: ProjectState,
  history?: HistoryGraph,
): VersionedState {
  const projectState = state ?? makeProjectState();
  const historyGraph = history ?? makeEmptyHistoryGraph();

  return {
    currentState: projectState,
    history: historyGraph,
  };
}


