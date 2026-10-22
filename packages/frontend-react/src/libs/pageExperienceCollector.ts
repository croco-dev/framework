import { useEffect } from "react";
import { Problem, ProblemCategory } from "@croco/problems-core";

export class PageExperienceCollectorProblem extends Problem {
  readonly code = "frontend/page-experience/invalid-policy";
  readonly category = ProblemCategory.ValidationError;
  constructor() {
    super(undefined, undefined, "Invalid page experience buffer policy");
  }
}

export type PageExperienceObservation = {
  id: string;
  pageInstance: string;
  page: string;
  kind: "view" | "content" | "visible" | "action" | "attempt";
  occurredAt: string;
  value: string;
};
/** One explicit instance per real navigation, retained outside a StrictMode effect. */
export function createPageExperienceCollector(options: {
  page: string;
  pageInstance: string;
  contentCondition: string;
  contentMinIntersectionRatio: number;
  engagementActions: readonly string[];
  valueAction: string;
  enabled: () => boolean;
  clock: () => number;
  monotonic: () => number;
  visible: () => boolean;
  send: (rows: readonly PageExperienceObservation[]) => Promise<void>;
  maxBuffer: number;
  maxAttempts: number;
}) {
  let revoked = false,
    generation = 0;
  const enabled = () => !revoked && options.enabled();
  const queue: PageExperienceObservation[] = [];
  const seen = new Set<string>();
  let sequence = 0,
    started = false,
    content = false,
    last: number | null = null,
    visibleMs = 0,
    dropped = 0,
    attempts = 0;
  let pending: Promise<void> | null = null;
  const enqueue = (kind: PageExperienceObservation["kind"], value: string) => {
    if (!enabled()) return;
    if (queue.length >= options.maxBuffer) {
      dropped++;
      return;
    }
    queue.push({
      id: `${options.pageInstance}:${++sequence}`,
      pageInstance: options.pageInstance,
      page: options.page,
      kind,
      occurredAt: new Date(options.clock()).toISOString(),
      value,
    });
  };
  const tick = () => {
    const now = options.monotonic();
    if (last !== null && content && enabled()) visibleMs += Math.max(0, now - last);
    last = enabled() && content && options.visible() ? now : null;
  };
  if (
    typeof options.pageInstance !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/.test(options.pageInstance) ||
    ![options.page, options.contentCondition, options.valueAction].every(
      (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value),
    ) ||
    !Array.isArray(options.engagementActions) ||
    options.engagementActions.length > 32 ||
    options.engagementActions.some(
      (value) => typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value),
    ) ||
    !Number.isFinite(options.contentMinIntersectionRatio) ||
    options.contentMinIntersectionRatio <= 0 ||
    options.contentMinIntersectionRatio > 1 ||
    !Number.isSafeInteger(options.maxBuffer) ||
    options.maxBuffer < 1 ||
    options.maxBuffer > 256 ||
    !Number.isSafeInteger(options.maxAttempts) ||
    options.maxAttempts < 1 ||
    options.maxAttempts > 5
  )
    throw new PageExperienceCollectorProblem();
  const flush = (): Promise<void> => {
    if (pending) return pending;
    if (!enabled()) {
      dropped += queue.length;
      queue.length = 0;
      return Promise.resolve();
    }
    if (!queue.length) return Promise.resolve();
    const batchGeneration = generation;
    let failed = false;
    pending = (async () => {
      while (queue.length && enabled() && batchGeneration === generation) {
        const batch = queue.splice(0, options.maxBuffer);
        try {
          await Promise.resolve().then(() => {
            if (batchGeneration !== generation || !enabled()) {
              dropped += batch.length;
              return;
            }
            return options.send(batch);
          });
          attempts = 0;
        } catch {
          failed = true;
          if (batchGeneration !== generation || !enabled()) {
            dropped += batch.length;
            return;
          }
          attempts++;
          if (attempts < options.maxAttempts) {
            const available = options.maxBuffer - queue.length;
            queue.unshift(...batch.slice(0, available));
            dropped += Math.max(0, batch.length - available);
          } else dropped += batch.length;
          break;
        }
      }
    })().finally(() => {
      pending = null;
      if (!failed && queue.length && batchGeneration === generation && enabled()) return flush();
    });
    return pending;
  };
  return {
    start() {
      if (!options.enabled()) return;
      revoked = false;
      if (started) return;
      started = true;
      enqueue("view", options.page);
    },
    contentDisplayed(intersectionRatio: number) {
      if (
        !Number.isFinite(intersectionRatio) ||
        intersectionRatio < options.contentMinIntersectionRatio ||
        intersectionRatio > 1
      )
        return;
      if (!started || content || !enabled() || !options.visible()) return;
      content = true;
      enqueue("content", options.contentCondition);
      last = options.monotonic();
    },
    /** Call before changing visibility, then resume after the transition. */
    pause() {
      tick();
      last = null;
    },
    resume() {
      last = content && enabled() && options.visible() ? options.monotonic() : null;
    },
    observe() {
      tick();
      if (content) enqueue("visible", String(Math.floor(visibleMs)));
    },
    action(action: string, identity: string) {
      const key = JSON.stringify(["action", action, identity]);
      if (!started || seen.has(key) || !enabled() || !options.visible()) return;
      if (
        !options.engagementActions.includes(action) ||
        !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/.test(identity)
      ) {
        dropped++;
        return;
      }
      if (seen.size >= options.maxBuffer) {
        dropped++;
        return;
      }
      seen.add(key);
      enqueue("action", action);
    },
    attempt(action: string, identity: string) {
      const key = JSON.stringify(["attempt", action, identity]);
      if (!started || seen.has(key) || !enabled() || !options.visible()) return;
      if (action !== options.valueAction || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/.test(identity)) {
        dropped++;
        return;
      }
      if (seen.size >= options.maxBuffer) {
        dropped++;
        return;
      }
      seen.add(key);
      enqueue("attempt", action);
    },
    revoke() {
      revoked = true;
      generation++;
      attempts = 0;
      dropped += queue.length;
      queue.length = 0;
      last = null;
      visibleMs = 0;
    },
    flush,
    status() {
      return { queued: queue.length, dropped, attempts, visibleMs };
    },
  };
}
export type PageExperienceCollector = ReturnType<typeof createPageExperienceCollector>;
/** The host's content observer calls contentDisplayed only when its declared condition is actually met. */
export function usePageExperience(collector: PageExperienceCollector, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      collector.revoke();
      return;
    }
    collector.start();
    collector.resume();
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        collector.pause();
        collector.observe();
        void collector.flush();
      } else collector.resume();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      collector.pause();
      collector.observe();
      void collector.flush();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [collector, enabled]);
}
