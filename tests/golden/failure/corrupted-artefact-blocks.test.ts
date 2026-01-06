/**
 * G13 — Corrupted Artefact Blocks Progress
 *
 * Golden test to ensure that corrupted snapshots are detected and the system
 * refuses to proceed, presenting recovery options without auto-repair. This
 * prevents "best effort" recovery that could hide damage.
 *
 * Scenario: Disk write interrupted.
 */

import { verifySnapshotIntegrity } from '../../../adapters/integrity/verify-snapshot-integrity';
import type { Database } from '../../../adapters/storage-sqlite/sqlite-project-snapshot-adapter';
import type { ProjectId, SnapshotId } from '../../../core-domain/state/domain-entities';
import type { VersionedState } from '../../../core-domain/history/versioning';
import { createVersionedState } from '../../helpers/test-fixtures';
import { calculateSnapshotChecksum } from '../../../adapters/integrity/checksum-utils';

describe('G13 — Corrupted Artefact Blocks Progress', () => {
  it('should detect checksum mismatch and mark state as unsafe', () => {
    // Given: Snapshot checksum mismatch
    const projectId: ProjectId = 'test-project-1' as ProjectId;
    const snapshotId: SnapshotId = 'snapshot-1' as SnapshotId;

    // Create a valid state JSON
    const versionedState = createVersionedState({
      projectName: 'Test Project',
      sourceLanguage: 'en' as const,
      targetLanguages: ['fr' as const],
    });

    const validStateJson = JSON.stringify(versionedState.currentState);
    const correctChecksum = calculateSnapshotChecksum(validStateJson);

    // Corrupt the data (modify the JSON string)
    const corruptedStateJson = validStateJson.replace('"en"', '"corrupted"');

    // Create a mock database that returns corrupted data with correct checksum
    // (simulating a checksum mismatch scenario)
    const mockDb: Database = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(() => [
        {
          id: snapshotId,
          project_id: projectId,
          state_json: corruptedStateJson,
          checksum: correctChecksum, // Stored checksum doesn't match corrupted data
        },
      ]),
      transaction: jest.fn((fn) => fn()),
    };

    // When: Project loads and integrity is verified
    const report = verifySnapshotIntegrity(mockDb, projectId, versionedState);

    // Then: System refuses to proceed
    expect(report.isSafe).toBe(false);

    // Then: Recovery options are presented (via error messages)
    const checksumIssues = report.issues.filter(
      (issue) => issue.issueType === 'checksum_mismatch',
    );
    expect(checksumIssues.length).toBeGreaterThan(0);
    expect(checksumIssues[0].severity).toBe('error');
    expect(checksumIssues[0].message).toContain('checksum mismatch');
    expect(checksumIssues[0].message).toContain('corrupted');
  });

  it('should detect missing payload and mark state as unsafe', () => {
    // Given: Snapshot with missing payload
    const projectId: ProjectId = 'test-project-1' as ProjectId;
    const snapshotId: SnapshotId = 'snapshot-1' as SnapshotId;

    const versionedState = createVersionedState({
      projectName: 'Test Project',
      sourceLanguage: 'en' as const,
      targetLanguages: ['fr' as const],
    });

    const mockDb: Database = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(() => [
        {
          id: snapshotId,
          project_id: projectId,
          state_json: null, // Missing payload
          checksum: null,
        },
      ]),
      transaction: jest.fn((fn) => fn()),
    };

    // When: Project loads
    const report = verifySnapshotIntegrity(mockDb, projectId, versionedState);

    // Then: System refuses to proceed
    expect(report.isSafe).toBe(false);

    // Then: Error message explains missing payload
    const missingPayloadIssues = report.issues.filter(
      (issue) => issue.issueType === 'missing_payload',
    );
    expect(missingPayloadIssues.length).toBeGreaterThan(0);
    expect(missingPayloadIssues[0].severity).toBe('error');
    expect(missingPayloadIssues[0].message).toContain('missing');
  });

  it('should detect invalid JSON and mark state as unsafe', () => {
    // Given: Snapshot with invalid JSON
    const projectId: ProjectId = 'test-project-1' as ProjectId;
    const snapshotId: SnapshotId = 'snapshot-1' as SnapshotId;

    const versionedState = createVersionedState({
      projectName: 'Test Project',
      sourceLanguage: 'en' as const,
      targetLanguages: ['fr' as const],
    });

    const invalidJson = '{ invalid json syntax }';

    const mockDb: Database = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(() => [
        {
          id: snapshotId,
          project_id: projectId,
          state_json: invalidJson,
          checksum: calculateSnapshotChecksum(invalidJson),
        },
      ]),
      transaction: jest.fn((fn) => fn()),
    };

    // When: Project loads
    const report = verifySnapshotIntegrity(mockDb, projectId, versionedState);

    // Then: System refuses to proceed
    expect(report.isSafe).toBe(false);

    // Then: Error message explains invalid JSON
    const invalidJsonIssues = report.issues.filter(
      (issue) => issue.issueType === 'invalid_json',
    );
    expect(invalidJsonIssues.length).toBeGreaterThan(0);
    expect(invalidJsonIssues[0].severity).toBe('error');
    expect(invalidJsonIssues[0].message).toContain('invalid JSON');
  });

  it('should detect domain invariant violations and mark state as unsafe', () => {
    // Given: Snapshot with domain invariant violation (wrong project ID)
    const projectId: ProjectId = 'test-project-1' as ProjectId;
    const wrongProjectId: ProjectId = 'wrong-project' as ProjectId;
    const snapshotId: SnapshotId = 'snapshot-1' as SnapshotId;

    const versionedState = createVersionedState({
      projectName: 'Test Project',
      sourceLanguage: 'en' as const,
      targetLanguages: ['fr' as const],
    });

    // Create state JSON with wrong project ID
    const corruptedState = {
      ...versionedState.currentState,
      project: {
        ...versionedState.currentState.project,
        id: wrongProjectId, // Wrong project ID
      },
    };
    const corruptedStateJson = JSON.stringify(corruptedState);

    const mockDb: Database = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(() => [
        {
          id: snapshotId,
          project_id: projectId,
          state_json: corruptedStateJson,
          checksum: calculateSnapshotChecksum(corruptedStateJson),
        },
      ]),
      transaction: jest.fn((fn) => fn()),
    };

    // When: Project loads
    const report = verifySnapshotIntegrity(mockDb, projectId, versionedState);

    // Then: System refuses to proceed
    expect(report.isSafe).toBe(false);

    // Then: Error message explains domain invariant violation
    const domainIssues = report.issues.filter(
      (issue) => issue.issueType === 'domain_invariant_violation',
    );
    expect(domainIssues.length).toBeGreaterThan(0);
    expect(domainIssues[0].severity).toBe('error');
    expect(domainIssues[0].message).toContain('project ID mismatch');
  });

  it('should not auto-repair corrupted snapshots', () => {
    // Given: Corrupted snapshot
    const projectId: ProjectId = 'test-project-1' as ProjectId;
    const snapshotId: SnapshotId = 'snapshot-1' as SnapshotId;

    const versionedState = createVersionedState({
      projectName: 'Test Project',
      sourceLanguage: 'en' as const,
      targetLanguages: ['fr' as const],
    });

    const validStateJson = JSON.stringify(versionedState.currentState);
    const corruptedStateJson = validStateJson.replace('"en"', '"corrupted"');
    const correctChecksum = calculateSnapshotChecksum(validStateJson);

    const mockDb: Database = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(() => [
        {
          id: snapshotId,
          project_id: projectId,
          state_json: corruptedStateJson,
          checksum: correctChecksum,
        },
      ]),
      transaction: jest.fn((fn) => fn()),
    };

    // When: Integrity is verified
    const report = verifySnapshotIntegrity(mockDb, projectId, versionedState);

    // Then: No auto-repair occurred (database was not modified)
    expect(mockDb.run).not.toHaveBeenCalled();

    // Then: Report indicates unsafe state
    expect(report.isSafe).toBe(false);
    expect(report.issues.length).toBeGreaterThan(0);
  });

  it('should return safe status when all snapshots are valid', () => {
    // Given: Valid snapshots
    const projectId: ProjectId = 'test-project-1' as ProjectId;
    const snapshotId: SnapshotId = 'snapshot-1' as SnapshotId;

    const versionedState = createVersionedState({
      projectName: 'Test Project',
      sourceLanguage: 'en' as const,
      targetLanguages: ['fr' as const],
    });

    const validStateJson = JSON.stringify(versionedState.currentState);
    const correctChecksum = calculateSnapshotChecksum(validStateJson);

    const mockDb: Database = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(() => [
        {
          id: snapshotId,
          project_id: projectId,
          state_json: validStateJson,
          checksum: correctChecksum,
        },
      ]),
      transaction: jest.fn((fn) => fn()),
    };

    // When: Integrity is verified
    const report = verifySnapshotIntegrity(mockDb, projectId, versionedState);

    // Then: System allows progress
    expect(report.isSafe).toBe(true);
    expect(report.issues.length).toBe(0);
  });
});

