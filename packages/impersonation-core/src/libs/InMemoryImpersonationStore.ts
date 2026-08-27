import { Component } from "@croco/framework-context";
import { ImpersonationStore } from "./interfaces";
import type { ImpersonationSessionCreateResult } from "./interfaces";
import type { ImpersonationState } from "./types";

@Component()
export class InMemoryImpersonationStore extends ImpersonationStore {
  private readonly sessions = new Map<string, ImpersonationState>();
  private readonly activeSessionsByImpersonator = new Map<string, ImpersonationState>();

  async createIfNoActiveSession(
    session: ImpersonationState,
  ): Promise<ImpersonationSessionCreateResult> {
    const existing = this.activeSessionsByImpersonator.get(session.impersonatorId);
    if (existing && !this.isExpired(existing)) {
      return { status: "active-session-exists" };
    }
    if (existing) {
      this.deleteSession(existing);
    }

    this.sessions.set(session.sessionId, session);
    this.activeSessionsByImpersonator.set(session.impersonatorId, session);
    return { status: "created" };
  }

  async find(sessionId: string): Promise<ImpersonationState | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (this.isExpired(session)) {
      this.deleteSession(session);
      return null;
    }
    return session;
  }

  async findByImpersonator(impersonatorId: string): Promise<ImpersonationState | null> {
    const session = this.activeSessionsByImpersonator.get(impersonatorId);
    if (!session) return null;
    if (this.isExpired(session)) {
      this.deleteSession(session);
      return null;
    }
    return session;
  }

  async revoke(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.deleteSession(session);
    }
  }

  private isExpired(session: ImpersonationState): boolean {
    return session.expiresAt.getTime() <= Date.now();
  }

  private deleteSession(session: ImpersonationState): void {
    this.sessions.delete(session.sessionId);
    const active = this.activeSessionsByImpersonator.get(session.impersonatorId);
    if (active?.sessionId === session.sessionId) {
      this.activeSessionsByImpersonator.delete(session.impersonatorId);
    }
  }
}
