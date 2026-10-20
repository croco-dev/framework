import { createElement, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { App } from "./App";
import { createFixtureCollector } from "./collector";
import type { PageExperienceObservation } from "../../../packages/frontend-react/src/libs/pageExperienceCollector";
const observations: PageExperienceObservation[] = [];
const seed = document.getElementById("root")?.dataset.instance ?? "missing-instance";
const collectors = new Map<number, ReturnType<typeof createFixtureCollector>>();
const createCollector = (navigation: number) => {
  let collector = collectors.get(navigation);
  if (!collector) {
    collector = createFixtureCollector(`${seed}-${navigation}`, {
      visible: () => document.visibilityState === "visible",
      monotonic: () => performance.now(),
      send: async (rows) => {
        observations.push(...rows);
      },
    });
    collectors.set(navigation, collector);
  }
  return collector;
};
Object.assign(window, {
  pageExperienceFixture: {
    observations,
    flush: () => Promise.all([...collectors.values()].map((collector) => collector.flush())),
  },
});
const root = document.getElementById("root");
if (root)
  hydrateRoot(root, createElement(StrictMode, null, createElement(App, { createCollector })));
