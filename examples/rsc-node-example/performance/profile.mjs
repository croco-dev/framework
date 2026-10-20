// Starting budgets for this synthetic PDP. Applications own their production budgets.
export const profile = Object.freeze({
  id: "orbit-print-v1",
  critical: ["product-title", "hero", "trial-cta"],
  deferred: ["recommendation"],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  cpuSlowdown: 4,
  network: { latency: 40, downloadThroughput: 1_000_000, uploadThroughput: 500_000 },
  repetitions: 3,
  image: {
    widths: [400, 800, 1200],
    width: 800,
    height: 600,
    sizes: "(max-width: 650px) calc(100vw - 40px), 540px",
  },
  limits: {
    htmlBytes: 80_000,
    flightBytes: 40_000,
    jsBytes: 300_000,
    imageBytes: 80_000,
    requests: 18,
  },
  // Relative to the measured baseline under the same cache/device/network conditions.
  regression: { ttfbMs: 500, shellMs: 600, heroMs: 600, lcpMs: 600, interactionMs: 200 },
});
export const configurations = ["baseline", "experiment", "personalization", "combined"];
export const measuredKeys = [...Object.keys(profile.limits), ...Object.keys(profile.regression)];

export function assess(sample, baseline, selectedProfile = profile) {
  const diagnostics = [];
  if (sample.correctness !== true) diagnostics.push("PDP_CORRECTNESS_FAILED");
  for (const key of measuredKeys) {
    if (!Number.isFinite(sample[key]) || sample[key] < 0)
      diagnostics.push(`PDP_MEASUREMENT_MISSING:${key}`);
  }
  for (const [key, limit] of Object.entries(selectedProfile.limits)) {
    if (sample[key] > limit) diagnostics.push(`PDP_BUDGET_EXCEEDED:${key}`);
  }
  const comparable =
    baseline && JSON.stringify(sample.conditions) === JSON.stringify(baseline.conditions);
  const delta = {};
  if (baseline && !comparable) diagnostics.push("PDP_COMPARISON_MISMATCH");
  if (comparable) {
    for (const [key, allowance] of Object.entries(selectedProfile.regression)) {
      if (!Number.isFinite(baseline[key])) {
        diagnostics.push(`PDP_BASELINE_MISSING:${key}`);
        continue;
      }
      delta[key] = sample[key] - baseline[key];
      if (delta[key] > allowance) diagnostics.push(`PDP_REGRESSION:${key}`);
    }
  }
  return {
    state: diagnostics.length ? "failed" : "passed",
    diagnostics,
    ...(comparable ? { delta } : {}),
  };
}

export function summarize(results) {
  return (
    "# PDP synthetic lab report\n\n" +
    "Tool completion and configuration certification are separate. Lab interaction is not field INP.\n\n" +
    "| Configuration | State | Evidence | Reason |\n| --- | --- | --- | --- |\n" +
    results
      .map((r) => `| ${r.configuration} | ${r.state} | ${r.artifactRef} | ${r.reason ?? ""} |`)
      .join("\n") +
    "\n"
  );
}
