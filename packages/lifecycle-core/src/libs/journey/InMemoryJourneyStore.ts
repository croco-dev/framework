import { JourneyProblem, validateJourneyScope } from "./JourneyEngine";
import type { JourneyEpisode, JourneyScope, JourneyStore } from "./types";
export class InMemoryJourneyStore implements JourneyStore {
  private readonly leases = new Map<string, number>();
  private readonly episodes = new Map<string, JourneyEpisode>();
  private key(scope: JourneyScope, id: string): string {
    validateJourneyScope(scope);
    return JSON.stringify([scope.appId, scope.environment, scope.tenantId, id]);
  }
  async claimDue(
    scope: JourneyScope,
    now: string,
    limit: number,
    leaseMs: number,
  ): Promise<JourneyEpisode[]> {
    validateJourneyScope(scope);
    const at = Date.parse(now);
    if (
      !Number.isFinite(at) ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      !Number.isFinite(leaseMs) ||
      leaseMs <= 0
    )
      throw new JourneyProblem("claim", "Invalid wake claim bounds");
    const due: JourneyEpisode[] = [];
    for (const episode of this.episodes.values()) {
      const key = this.key(scope, episode.id);
      if (
        this.key(episode.scope, episode.id) !== key ||
        !["running", "waiting"].includes(episode.status) ||
        (episode.wakeAt && Date.parse(episode.wakeAt) > at) ||
        (this.leases.get(key) ?? 0) > at
      )
        continue;
      this.leases.set(key, at + leaseMs);
      due.push(structuredClone(episode));
      if (due.length === limit) break;
    }
    return due;
  }
  async create(episode: JourneyEpisode): Promise<{ episode: JourneyEpisode; created: boolean }> {
    const key = this.key(episode.scope, episode.id);
    const existing = [...this.episodes.values()].find(
      (item) =>
        this.key(item.scope, item.reentryKey) === this.key(episode.scope, episode.reentryKey),
    );
    if (existing) return { episode: structuredClone(existing), created: false };
    if (this.episodes.has(key)) throw new JourneyProblem("identity", "Episode id is already used");
    this.episodes.set(key, structuredClone(episode));
    return { episode: structuredClone(episode), created: true };
  }
  async get(scope: JourneyScope, id: string): Promise<JourneyEpisode | undefined> {
    const episode = this.episodes.get(this.key(scope, id));
    return episode && structuredClone(episode);
  }
  async list(scope: JourneyScope): Promise<JourneyEpisode[]> {
    validateJourneyScope(scope);
    return [...this.episodes.values()]
      .filter((item) => this.key(item.scope, "") === this.key(scope, ""))
      .map((item) => structuredClone(item));
  }
  async compareAndSet(
    scope: JourneyScope,
    id: string,
    expectedRevision: number,
    next: JourneyEpisode,
  ): Promise<boolean> {
    const key = this.key(scope, id);
    const previous = this.episodes.get(key);
    if (!previous || previous.revision !== expectedRevision) return false;
    if (
      key !== this.key(next.scope, next.id) ||
      next.revision !== expectedRevision + 1 ||
      previous.reentryKey !== next.reentryKey ||
      previous.definitionId !== next.definitionId ||
      previous.definitionVersion !== next.definitionVersion ||
      previous.definitionSnapshot !== next.definitionSnapshot ||
      previous.subject !== next.subject ||
      previous.sourceEventId !== next.sourceEventId ||
      previous.episodeKey !== next.episodeKey ||
      previous.startedAt !== next.startedAt ||
      previous.businessObjectRef !== next.businessObjectRef
    )
      throw new JourneyProblem("identity", "Episode identity and version are immutable");
    this.episodes.set(key, structuredClone(next));
    this.leases.delete(key);
    return true;
  }
}
