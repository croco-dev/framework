import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { PageExperiencePanel } from "../../../packages/admin-react/src/libs/PageExperiencePanel";
import type { PageExperiencePanelState } from "../../../packages/admin-react/src/libs/PageExperiencePanel";
import type { createPageExperienceCollector } from "../../../packages/frontend-react/src/libs/pageExperienceCollector";
import { usePageExperience } from "../../../packages/frontend-react/src/libs/pageExperienceCollector";
export function App({
  createCollector,
}: {
  createCollector: (navigation: number) => ReturnType<typeof createPageExperienceCollector>;
}) {
  const [navigation, setNavigation] = useState(1);
  const collector = useMemo(() => createCollector(navigation), [createCollector, navigation]);
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
  }, [collector]);
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
      "button",
      {
        onClick: () => {
          history.pushState(null, "", `/product/${navigation + 1}`);
          setNavigation(navigation + 1);
        },
      },
      "Next product",
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
