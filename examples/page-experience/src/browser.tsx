import { createElement, StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PageExperiencePanel } from "../../../packages/admin-react/src/libs/PageExperiencePanel";
import type { PageExperiencePanelState } from "../../../packages/admin-react/src/libs/PageExperiencePanel";
import {
  createPageExperienceCollector,
  usePageExperience,
} from "../../../packages/frontend-react/src/libs/pageExperienceCollector";
import type { PageExperienceObservation } from "../../../packages/frontend-react/src/libs/pageExperienceCollector";
const observations: PageExperienceObservation[] = [];
const collector = createPageExperienceCollector({
  page: "product",
  pageInstance: "navigation-1",
  contentCondition: "hero-visible",
  contentMinIntersectionRatio: 0.5,
  engagementActions: ["preview"],
  valueAction: "purchase",
  enabled: () => true,
  clock: () => Date.now(),
  monotonic: () => performance.now(),
  visible: () => document.visibilityState === "visible",
  send: async (rows) => {
    observations.push(...rows);
  },
  maxBuffer: 32,
  maxAttempts: 2,
});
function App() {
  const [state, setState] = useState<PageExperiencePanelState>({ kind: "loading" });
  const hero = useRef<HTMLElement>(null);
  usePageExperience(collector, true);
  const refresh = () => {
    setState({ kind: "loading" });
    void fetch("/report")
      .then((r) => r.json())
      .then(setState);
  };
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    const target = hero.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5))
          collector.contentDisplayed(
            Math.max(...entries.filter((e) => e.isIntersecting).map((e) => e.intersectionRatio)),
          );
      },
      { threshold: 0.5 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  return createElement(
    "main",
    null,
    createElement(
      "article",
      { ref: hero, style: { padding: "1rem", fontFamily: "system-ui" } },
      createElement("h2", null, "Product preview"),
      createElement("p", null, "Synthetic public content. No customer tracking."),
      createElement(
        "button",
        {
          onClick: () => {
            collector.action("preview", "preview-1");
            collector.observe();
            void collector.flush();
          },
        },
        "Preview product",
      ),
    ),
    createElement(
      "label",
      null,
      "Fixture state ",
      createElement(
        "select",
        {
          "aria-label": "Fixture state",
          onChange: (e) => {
            const mode = (e.currentTarget as HTMLSelectElement).value;
            if (mode === "ready" || mode === "partial")
              void fetch(`/report?mode=${mode}`)
                .then((r) => r.json())
                .then(setState);
            else setState({ kind: mode as "empty" });
          },
        },
        ...["ready", "partial", "empty", "loading", "denied", "error", "unavailable"].map((mode) =>
          createElement("option", { key: mode, value: mode }, mode),
        ),
      ),
    ),
    createElement(PageExperiencePanel, { state, onRefresh: refresh }),
  );
}
Object.assign(window, {
  pageExperienceFixture: {
    observations,
    flush: () => collector.flush(),
    status: () => collector.status(),
  },
});
const root = document.getElementById("root");
if (root) createRoot(root).render(createElement(StrictMode, null, createElement(App)));
