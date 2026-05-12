import { Component } from "@croco/framework-context";
import { ImpersonationStore } from "./interfaces";
import type { ImpersonationState } from "./types";

@Component()
export class InMemoryImpersonationStore extends ImpersonationStore {
  private readonly sessions = new Map<string, ImpersonationState>();

  async save(session: ImpersonationState): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async find(sessionId: string): Promise<ImpersonationState | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.expiresAt && new Date() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  async findByImpersonator(impersonatorId: string): Promise<ImpersonationState | null> {
    for (const session of this.sessions.values()) {
      if (session.impersonatorId === impersonatorId) {
        if (session.expiresAt && new Date() > session.expiresAt) {
          this.sessions.delete(session.sessionId);
          continue;
        }
        return session;
      }
    }
    return null;
  }

  async revoke(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}
