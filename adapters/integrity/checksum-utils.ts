// Checksum calculation utilities for snapshot integrity verification.
// This module provides pure functions for computing SHA-256 hashes of
// snapshot payloads, enabling corruption detection through checksum validation.

import { createHash } from 'crypto';

// Calculate SHA-256 checksum for state_json payload.
// Returns hex-encoded string (64 characters) representing the hash of the input.
// This checksum is stored alongside the snapshot and used during verification
// to detect data corruption (e.g., disk errors, partial writes, or tampering).
export function calculateSnapshotChecksum(stateJson: string): string {
  return createHash('sha256').update(stateJson, 'utf8').digest('hex');
}

