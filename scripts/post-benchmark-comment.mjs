// @ts-check
import { readFileSync } from "node:fs";

/**
 * @param {number} ms
 */
function formatDuration(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(1)}μs`;
  return `${ms.toFixed(1)}ms`;
}

/**
 * @param {number} actual
 * @param {number | undefined} expected
 */
function formatDiff(actual, expected) {
  if (!expected) return "-";
  const percent = (((actual - expected) / expected) * 100).toFixed(1);
  const sign = actual >= expected ? "+" : "";
  return `${sign}${percent}%`;
}

/**
 * @param {{ thresholdStatus?: string; baselineStatus?: string }} report
 */
function statusEmoji(report) {
  if (report.thresholdStatus === "fail" || report.baselineStatus === "fail") return "❌";
  if (report.thresholdStatus === "skip" || report.baselineStatus === "skip") return "⚠️";
  return "✅";
}

/**
 * @param {{ thresholdSkipReason?: string; baselineSkipReason?: string }} report
 */
function statusNotes(report) {
  const notes = [report.thresholdSkipReason, report.baselineSkipReason].filter(Boolean);
  return notes.length > 0 ? notes.join("<br>") : "-";
}

/**
 * @param {{ allPassed: boolean; gateFailures?: string[]; reports: any[] }} result
 * @param {string} sha
 */
export function buildCommentBody(result, sha) {
  const rows = result.reports
    .map((r) => {
      const threshold = r.threshold ? formatDuration(r.threshold) : "-";
      const baseline = r.baseline ? formatDuration(r.baseline) : "-";
      const baselineDiff = formatDiff(r.p75, r.baseline);
      return `| ${r.name} | ${formatDuration(r.p75)} | ${threshold} | ${baseline} | ${baselineDiff} | ${statusEmoji(r)} | ${statusNotes(r)} |`;
    })
    .join("\n");
  const gateFailures = Array.isArray(result.gateFailures) ? result.gateFailures : [];
  const failureLines = gateFailures.map((failure) => `- ${failure}`);

  const summary = result.allPassed ? "✅ All benchmarks passed" : "❌ Some benchmarks failed";

  return [
    COMMENT_MARKER,
    "## 📊 Benchmark Results",
    "",
    summary,
    "",
    ...(failureLines.length > 0 ? ["### Gate failures", "", ...failureLines, ""] : []),
    "| Benchmark | p75 | Threshold | Baseline | vs Baseline | Status | Notes |",
    "|-----------|-----|-----------|----------|-------------|--------|-------|",
    rows || "| _No benchmark rows collected_ | - | - | - | - | ❌ | Check workflow logs. |",
    "",
    `<sub>Updated: ${new Date().toISOString()} · Commit: ${sha.slice(0, 7)}</sub>`,
  ].join("\n");
}

const COMMENT_MARKER = "<!-- benchmark-results -->";

/**
 * Called by actions/github-script.
 * @param {{ github: any; context: any }} args
 */
export async function run({ github, context }) {
  if (!context.issue?.number) {
    console.log("Not a PR context, skipping comment");
    return;
  }

  let result;
  try {
    result = JSON.parse(readFileSync("benchmark-result.json", "utf-8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to read benchmark-result.json: ${message}`);
    return;
  }

  const body = buildCommentBody(result, context.sha);

  const { data: comments } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
  });

  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body,
    });
  }
}
