import { createElement as h, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import type { ExperienceContent, ExperienceDecision, ExposureHandle } from "@croco/experience-core";

export type ExperienceRenderer = (content: ExperienceContent) => ReactNode;
export type ExperienceSlotProps = Readonly<{
  decision: ExperienceDecision | null;
  handle?: ExposureHandle;
  renderers: Readonly<Record<string, ExperienceRenderer>>;
  preview?: boolean;
  onExposure?(handle: ExposureHandle): Promise<void>;
  onDismiss?(handle: ExposureHandle): Promise<void>;
  onError?(error: unknown): void;
}>;

function canRestoreFocus(element: HTMLElement | null): element is HTMLElement {
  return Boolean(
    element?.isConnected &&
    !element.matches(":disabled") &&
    element.matches("a[href],button,input,select,textarea,[tabindex]"),
  );
}

/** Renders the server decision as supplied; the first client render uses that same snapshot. */
export function ExperienceSlot(props: ExperienceSlotProps): ReactElement | null {
  return props.decision
    ? h(ExperienceSlotState, { ...props, key: props.decision.decisionId })
    : null;
}

function ExperienceSlotState(props: ExperienceSlotProps): ReactElement | null {
  const { decision, handle, preview = false, onExposure, onError } = props;
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<"exposure" | "dismiss">();
  const [viewed, setViewed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const container = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const fallbackFocus = useRef<HTMLElement | null>(null);
  const recording = useRef(false);
  const recorded = useRef(false);
  const dismissing = useRef(false);
  const retryFocus = useRef(false);
  const exposureCallback = useRef(onExposure);
  const errorCallback = useRef(onError);
  exposureCallback.current = onExposure;
  errorCallback.current = onError;

  useLayoutEffect(() => {
    if (error !== undefined || !retryFocus.current) return;
    retryFocus.current = false;
    closeButton.current?.focus();
  }, [error]);

  useLayoutEffect(() => {
    if (!dismissed) return;
    const previous = returnFocus.current;
    if (canRestoreFocus(previous)) previous.focus();
    else fallbackFocus.current?.focus();
  }, [dismissed, error]);

  useLayoutEffect(() => {
    if (!decision || decision.renderer !== "modal") return;
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    fallbackFocus.current =
      container.current?.nextElementSibling instanceof HTMLElement
        ? container.current.nextElementSibling
        : null;
    closeButton.current?.focus();
    return () => {
      const previous = returnFocus.current;
      if (canRestoreFocus(previous)) previous.focus();
      else fallbackFocus.current?.focus();
    };
  }, [decision]);

  useEffect(() => {
    if (
      !decision ||
      !handle ||
      preview ||
      dismissed ||
      !exposureCallback.current ||
      !container.current
    )
      return;
    const element = container.current;
    let intersecting = false;
    const observer = new IntersectionObserver(
      (entries) => {
        intersecting = entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5,
        );
        setViewed(intersecting && document.visibilityState === "visible");
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(element);
    const onVisibility = () => setViewed(intersecting && document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [decision, handle, preview, dismissed]);

  useEffect(() => {
    if (
      !viewed ||
      !handle ||
      preview ||
      !exposureCallback.current ||
      recording.current ||
      recorded.current
    )
      return;
    recording.current = true;
    void exposureCallback
      .current(handle)
      .then(
        () => {
          recorded.current = true;
          setError((current) => (current === "exposure" ? undefined : current));
        },
        (failure: unknown) => {
          setError((current) => (current === "dismiss" ? current : "exposure"));
          errorCallback.current?.(failure);
        },
      )
      .finally(() => {
        recording.current = false;
      });
  }, [viewed, handle, preview, attempt]);

  if (!decision) return null;
  const renderer = Object.hasOwn(props.renderers, decision.renderer)
    ? props.renderers[decision.renderer]
    : undefined;
  if (!renderer)
    return h("p", { role: "alert" }, `Experience renderer is not registered: ${decision.renderer}`);

  const persistDismissal = async (): Promise<void> => {
    if (!handle || !props.onDismiss) {
      setError("dismiss");
      return;
    }
    if (dismissing.current) return;
    dismissing.current = true;
    try {
      await props.onDismiss(handle);
      setError(undefined);
    } catch (failure) {
      setError("dismiss");
      props.onError?.(failure);
    } finally {
      dismissing.current = false;
    }
  };
  const close = (): void => {
    setDismissed(true);
    if (!preview) void persistDismissal();
  };
  if (dismissed)
    return error === "dismiss"
      ? h(
          "p",
          { role: "alert" },
          "Dismissal was not saved. ",
          h(
            "button",
            { type: "button", onClick: () => void persistDismissal() },
            "Retry dismissal",
          ),
        )
      : null;
  const modal = decision.renderer === "modal";
  return h(
    "section",
    {
      ref: container,
      role: modal ? "dialog" : "region",
      "aria-modal": modal ? true : undefined,
      "aria-label": decision.content.title,
      onKeyDown: modal
        ? (event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
            if (event.key === "Tab" && container.current) {
              const focusable = Array.from(
                container.current.querySelectorAll<HTMLElement>(
                  "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])",
                ),
              );
              const first = focusable[0];
              const last = focusable.at(-1);
              if (event.shiftKey && document.activeElement === first && last) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last && first) {
                event.preventDefault();
                first.focus();
              }
            }
          }
        : undefined,
    },
    renderer(decision.content),
    h(
      "button",
      { ref: closeButton, type: "button", onClick: close },
      preview ? "Close preview" : "Dismiss",
    ),
    error === "exposure"
      ? h(
          "p",
          { role: "status" },
          "Display confirmation failed.",
          h(
            "button",
            {
              type: "button",
              onClick: () => {
                retryFocus.current = true;
                setAttempt((current) => current + 1);
              },
            },
            "Retry confirmation",
          ),
        )
      : null,
  );
}
