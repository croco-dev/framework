import type { AuditLogEntry } from './types';

export type AuditIntegrityConfig = {
  algorithm?: 'sha256';
  secretKey?: string;
};

export type AuditIntegrityMetadata = {
  hash: string;
  algorithm: string;
  timestamp: number;
};

export interface AuditIntegrityVerifier {
  verify(entry: AuditLogEntry): boolean;
  computeHash(entry: Omit<AuditLogEntry, 'integrityHash'>): string;
}

export interface AuditChainVerifier {
  verifyChain(entries: AuditLogEntry[]): { valid: boolean; brokenAt?: number };
}

export type AuditSequenceConfig = {
  enableOrdering: boolean;
  sequenceField?: string;
};

export interface AuditSequenceGenerator {
  generateNext(previousSequence?: number): number;
  validateOrder(entries: AuditLogEntry[]): boolean;
}

export type TamperProofAuditLog = AuditLogEntry & {
  integrityHash: string;
  parentHash?: string;
  sequence: number;
};
