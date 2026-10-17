import { createElement, useEffect, useRef, useState } from "react";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { ReactElement, ReactNode } from "react";

/** Invalid delivery/admission data or failed receipt transport; never a business-command failure. */
export class ExperimentDeliveryClientProblem extends Problem {
  readonly code = "frontend-react/experiment-delivery-failed";
  readonly category = ProblemCategory.InternalServerError;
  constructor(detail: string) {
    super("frontend-react/experiment-delivery-failed", ProblemCategory.InternalServerError, detail);
  }
}

/** Public projection only. Receipt is opaque; scopeKey is a host-owned session generation, not a subject id. */
export type ExperimentRegionDecision = Readonly<{
  region: string;
  deliveryId: string;
  policyRevision: string;
  experimentRevision: string;
  status: "assigned" | "fallback";
  variant?: string;
  value?: string | boolean | number;
  receipt?: string;
  phase: "speculative" | "admitted";
  validUntil: string;
}>;
export type ExperimentRegionProps = Readonly<{
  decision: ExperimentRegionDecision;
  scopeKey: string;
  activeScopeKey: string;
  renderVariant(variant: string, value: string | boolean | number): ReactNode;
  fallback: ReactNode;
  /** Consume speculative navigation using authenticated server identity, never a browser subject field. */
  admit?(receipt: string, signal: AbortSignal): Promise<ExperimentRegionDecision>;
  report(
    input: Readonly<{ receipt: string; displayInstanceId: string; occurredAt: string }>,
  ): Promise<void>;
  onObservationError?(error: unknown): void;
}>;

/** Hydrates the exact server decision. A speculative or obsolete scope renders fallback, never treatment. */
export function ExperimentRegion(props: ExperimentRegionProps): ReactElement {
  return createElement(ExperimentRegionState, {
    ...props,
    key: `${props.scopeKey}:${props.decision.deliveryId}:${props.decision.region}`,
  });
}
function ExperimentRegionState(props: ExperimentRegionProps): ReactElement {
  const [consumed, setConsumed] = useState<ExperimentRegionDecision>();
  const element = useRef<HTMLDivElement>(null);
  const occurrence = useRef<
    | Readonly<{
        receipt: string;
        displayInstanceId: string;
        occurredAt: string;
      }>
    | undefined
  >(undefined);
  const reported = useRef(false);
  const callbacks = useRef(props);
  callbacks.current = props;
  const current = props.scopeKey === props.activeScopeKey;
  const decision = consumed ?? props.decision;
  const assigned =
    current &&
    decision.status === "assigned" &&
    decision.phase === "admitted" &&
    decision.variant !== undefined &&
    decision.value !== undefined &&
    !!decision.receipt;

  useEffect(() => {
    if (
      !current ||
      props.decision.status !== "assigned" ||
      props.decision.phase !== "speculative" ||
      !props.decision.receipt ||
      !callbacks.current.admit
    )
      return;
    const controller = new AbortController();
    const original = props.decision;
    const admit = callbacks.current.admit;
    const receipt = props.decision.receipt;
    void Promise.resolve()
      .then(() => (controller.signal.aborted ? original : admit(receipt, controller.signal)))
      .then(
        (result) => {
          if (
            controller.signal.aborted ||
            callbacks.current.scopeKey !== callbacks.current.activeScopeKey
          )
            return;
          if (
            !result ||
            typeof result !== "object" ||
            (result.status !== "assigned" && result.status !== "fallback") ||
            result.region !== original.region ||
            result.deliveryId !== original.deliveryId ||
            result.policyRevision !== original.policyRevision ||
            result.experimentRevision !== original.experimentRevision ||
            (result.status === "assigned" &&
              (result.variant !== original.variant ||
                result.value !== original.value ||
                result.phase !== "admitted" ||
                typeof result.receipt !== "string" ||
                !result.receipt))
          ) {
            callbacks.current.onObservationError?.(
              new ExperimentDeliveryClientProblem("Admission changed the frozen render decision"),
            );
            return;
          }
          setConsumed(result);
        },
        (error: unknown) => {
          if (!controller.signal.aborted) callbacks.current.onObservationError?.(error);
        },
      );
    return () => controller.abort();
  }, [current, props.decision]);

  useEffect(() => {
    if (
      !assigned ||
      !element.current ||
      !decision.receipt ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const node = element.current;
    const receipt = decision.receipt;
    let visible = false;
    let pending = false;
    let disposed = false;
    let visibilityFrame: number | undefined;
    const isDisplayed = () => {
      if (
        typeof node.checkVisibility === "function" &&
        !node.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        })
      )
        return false;
      const visibility = getComputedStyle(node).visibility;
      if (visibility === "hidden" || visibility === "collapse") return false;
      for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.display === "none" || Number(style.opacity) === 0) return false;
      }
      return true;
    };
    const report = () => {
      if (
        disposed ||
        !visible ||
        document.visibilityState !== "visible" ||
        reported.current ||
        pending ||
        callbacks.current.scopeKey !== callbacks.current.activeScopeKey
      )
        return;
      if (!isDisplayed()) {
        visibilityFrame ??= requestAnimationFrame(() => {
          visibilityFrame = undefined;
          report();
        });
        return;
      }
      if (visibilityFrame !== undefined) {
        cancelAnimationFrame(visibilityFrame);
        visibilityFrame = undefined;
      }
      occurrence.current ??= {
        receipt,
        displayInstanceId: crypto.randomUUID(),
        occurredAt: new Date().toISOString(),
      };
      const input = occurrence.current;
      pending = true;
      void Promise.resolve()
        .then(() => {
          if (disposed || callbacks.current.scopeKey !== callbacks.current.activeScopeKey) return;
          return callbacks.current.report(input);
        })
        .then(
          () => {
            reported.current = true;
          },
          (error: unknown) => {
            if (!disposed) callbacks.current.onObservationError?.(error);
          },
        )
        .finally(() => {
          pending = false;
        });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some(
          (entry) =>
            entry.target === node && entry.isIntersecting && entry.intersectionRatio >= 0.5,
        );
        report();
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(node);
    document.addEventListener("visibilitychange", report);
    return () => {
      disposed = true;
      if (visibilityFrame !== undefined) cancelAnimationFrame(visibilityFrame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", report);
    };
  }, [assigned, decision.receipt]);

  return createElement(
    "div",
    {
      ref: element,
      "data-experiment-region": decision.region,
      "data-delivery": decision.deliveryId,
    },
    assigned && decision.variant !== undefined && decision.value !== undefined
      ? props.renderVariant(decision.variant, decision.value)
      : props.fallback,
  );
}
