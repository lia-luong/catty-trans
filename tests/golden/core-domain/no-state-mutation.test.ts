/**
 * G3 — No Silent State Mutation
 *
 * Golden test to ensure that state transition functions never mutate their
 * input state objects. This prevents accidental mutation that could destroy
 * determinism and break immutability guarantees.
 *
 * Scenario: A function applies a change.
 */

import { applyTranslationChange } from '../../../core-domain/state/project-state';
import type { ProjectState, TranslationChange } from '../../../core-domain/state/project-state';
import { createProjectState, createTranslationChange } from '../../helpers/test-fixtures';
import { areStatesEqual } from '../../helpers/state-equality';

describe('G3 — No Silent State Mutation', () => {
  it('should not mutate original state when applying a translation change', () => {
    // Given: Original ProjectState object
    const originalState = createProjectState({
      projectName: 'Test Project',
      sourceLanguage: 'en' as const,
      targetLanguages: ['fr' as const],
    });

    // Create a deep copy to compare against later
    const originalStateCopy: ProjectState = JSON.parse(JSON.stringify(originalState));

    const change: TranslationChange = createTranslationChange({
      projectId: originalState.project.id,
      segmentId: originalState.segments[0].id,
      targetLanguage: 'fr' as const,
      newText: 'Bonjour',
      newStatus: 'translated' as const,
    });

    // When: applyChange(originalState, change) is called
    const newState = applyTranslationChange(originalState, change);

    // Then: originalState is unchanged
    expect(areStatesEqual(originalState, originalStateCopy)).toBe(true);

    // Verify reference equality: original state should be the same object reference
    // (not mutated, but also verify the structure is identical)
    expect(originalState.project.id).toBe(originalStateCopy.project.id);
    expect(originalState.segments.length).toBe(originalStateCopy.segments.length);
    expect(originalState.targetSegments.length).toBe(originalStateCopy.targetSegments.length);

    // Then: Returned state is a new object
    expect(newState).not.toBe(originalState);
    expect(newState.project).not.toBe(originalState.project);
    expect(newState.segments).not.toBe(originalState.segments);
    expect(newState.targetSegments).not.toBe(originalState.targetSegments);

    // Verify the new state has the expected changes
    expect(newState.targetSegments.length).toBe(originalState.targetSegments.length + 1);
  });

  it('should not mutate nested arrays when updating existing target segment', () => {
    // Given: State with an existing target segment
    const originalState = createProjectState({
      projectName: 'Test Project',
      sourceLanguage: 'en' as const,
      targetLanguages: ['fr' as const],
    });

    // Add an initial target segment
    const initialChange: TranslationChange = createTranslationChange({
      projectId: originalState.project.id,
      segmentId: originalState.segments[0].id,
      targetLanguage: 'fr' as const,
      newText: 'Bonjour',
      newStatus: 'translated' as const,
    });

    const stateWithTarget = applyTranslationChange(originalState, initialChange);
    const originalTargetSegments = [...stateWithTarget.targetSegments];

    // Create a change that updates the existing target segment
    const updateChange: TranslationChange = createTranslationChange({
      projectId: stateWithTarget.project.id,
      segmentId: stateWithTarget.segments[0].id,
      targetLanguage: 'fr' as const,
      newText: 'Bonjour le monde',
      newStatus: 'approved' as const,
      targetSegmentId: stateWithTarget.targetSegments[0].id,
    });

    // When: Applying the update change
    const updatedState = applyTranslationChange(stateWithTarget, updateChange);

    // Then: Original target segments array is not mutated
    expect(stateWithTarget.targetSegments).toBe(originalTargetSegments);
    expect(stateWithTarget.targetSegments[0].translatedText).toBe('Bonjour');
    expect(stateWithTarget.targetSegments[0].status).toBe('translated');

    // Then: New state has the updated values
    expect(updatedState.targetSegments[0].translatedText).toBe('Bonjour le monde');
    expect(updatedState.targetSegments[0].status).toBe('approved');
    expect(updatedState.targetSegments).not.toBe(stateWithTarget.targetSegments);
  });

  it('should not mutate state when change is invalid (wrong project)', () => {
    // Given: Original state
    const originalState = createProjectState({
      projectName: 'Test Project',
      sourceLanguage: 'en' as const,
      targetLanguages: ['fr' as const],
    });

    const originalStateCopy: ProjectState = JSON.parse(JSON.stringify(originalState));

    // Create a change for a different project
    const wrongProjectId = 'wrong-project-id' as typeof originalState.project.id;
    const invalidChange: TranslationChange = createTranslationChange({
      projectId: wrongProjectId,
      segmentId: originalState.segments[0].id,
      targetLanguage: 'fr' as const,
      newText: 'Bonjour',
      newStatus: 'translated' as const,
    });

    // When: Applying invalid change
    const resultState = applyTranslationChange(originalState, invalidChange);

    // Then: Original state is unchanged
    expect(areStatesEqual(originalState, originalStateCopy)).toBe(true);

    // Then: Result state is the same reference (early return for invalid change)
    expect(resultState).toBe(originalState);
  });

  it('should not mutate state when project is archived', () => {
    // Given: Archived project state
    const originalState = createProjectState({
      projectName: 'Test Project',
      sourceLanguage: 'en' as const,
      targetLanguages: ['fr' as const],
      projectStatus: 'archived' as const,
    });

    const originalStateCopy: ProjectState = JSON.parse(JSON.stringify(originalState));

    const change: TranslationChange = createTranslationChange({
      projectId: originalState.project.id,
      segmentId: originalState.segments[0].id,
      targetLanguage: 'fr' as const,
      newText: 'Bonjour',
      newStatus: 'translated' as const,
    });

    // When: Applying change to archived project
    const resultState = applyTranslationChange(originalState, change);

    // Then: Original state is unchanged
    expect(areStatesEqual(originalState, originalStateCopy)).toBe(true);

    // Then: Result state is the same reference (early return for archived project)
    expect(resultState).toBe(originalState);
  });

  it('should create new objects at every level of nesting', () => {
    // Given: Original state
    const originalState = createProjectState({
      projectName: 'Test Project',
      sourceLanguage: 'en' as const,
      targetLanguages: ['fr' as const],
    });

    const change: TranslationChange = createTranslationChange({
      projectId: originalState.project.id,
      segmentId: originalState.segments[0].id,
      targetLanguage: 'fr' as const,
      newText: 'Bonjour',
      newStatus: 'translated' as const,
    });

    // When: Applying change
    const newState = applyTranslationChange(originalState, change);

    // Then: All nested structures are new objects (not just shallow copy)
    expect(newState).not.toBe(originalState);
    expect(newState.project).not.toBe(originalState.project);
    expect(newState.segments).not.toBe(originalState.segments);
    expect(newState.targetSegments).not.toBe(originalState.targetSegments);

    // Verify segments array is the same reference (unchanged in this operation)
    // but targetSegments is a new array
    expect(newState.segments).toBe(originalState.segments);
    expect(newState.targetSegments).not.toBe(originalState.targetSegments);
  });
});

