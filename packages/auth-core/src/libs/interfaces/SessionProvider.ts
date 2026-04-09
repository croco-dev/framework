export type Session = {
  id: string;
  userId: string;
  clientId: string;
  status: 'abandoned' | 'active' | 'pending' | 'ended' | 'expired' | 'removed' | 'replaced' | 'revoked';
  createdAt: Date;
  updatedAt: Date;
  expireAt?: Date;
  abandonedAt?: Date;
  lastActiveAt?: Date;
};

export type SessionListOptions = {
  userId?: string;
  clientId?: string;
  status?: Session['status'];
  limit?: number;
  offset?: number;
};

export type SessionListResult = {
  sessions: Session[];
  totalCount: number;
};

export interface SessionProvider {
  getSession(sessionId: string): Promise<Session | null>;
  listSessions(options: SessionListOptions): Promise<SessionListResult>;
  revokeSession(sessionId: string): Promise<void>;
  revokeAllSessions(userId: string): Promise<void>;
}
