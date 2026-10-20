import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { App } from "./App";
import { createFixtureCollector } from "./collector";
export function renderFixture(seed: string) {
  const collectors: ReturnType<typeof createFixtureCollector>[] = [];
  const html = renderToString(
    createElement(
      StrictMode,
      null,
      createElement(App, {
        createCollector: (navigation: number) => {
          const collector = createFixtureCollector(`${seed}-${navigation}`, {
            visible: () => false,
            monotonic: () => 0,
            send: async () => {},
          });
          collectors.push(collector);
          return collector;
        },
      }),
    ),
  );
  return {
    html,
    queued: collectors.reduce((sum, collector) => sum + collector.status().queued, 0),
  };
}
