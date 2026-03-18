import { Token } from '@croco/framework-context';
import type { AuditLogRepository } from './AuditLogRepository';

export const AUDIT_LOG_REPOSITORY_TOKEN = new Token<AuditLogRepository>('AuditLogRepository');
