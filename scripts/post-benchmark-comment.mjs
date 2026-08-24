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
 * @param {unknown} value
 */
function escapeMarkdownCell(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("@", "&#64;")
    .replaceAll("|", "&#124;")
    .replaceAll(/\r?\n/g, " ");
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
  return notes.length > 0 ? notes.map(escapeMarkdownCell).join("<br>") : "-";
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
      return `| ${escapeMarkdownCell(r.name)} | ${formatDuration(r.p75)} | ${threshold} | ${baseline} | ${baselineDiff} | ${statusEmoji(r)} | ${statusNotes(r)} |`;
    })
    .join("\n");
  const gateFailures = Array.isArray(result.gateFailures) ? result.gateFailures : [];
  const failureLines = gateFailures.map((failure) => `- ${escapeMarkdownCell(failure)}`);

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
 * @param {{ github: any; owner: string; repo: string; issueNumber: number; sha: string; resultPath?: string }} args
 */
export async function run({
  github,
  owner,
  repo,
  issueNumber,
  sha,
  resultPath = "benchmark-result.json",
}) {
  let result;
  try {
    result = JSON.parse(readFileSync(resultPath, "utf-8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read ${resultPath}: ${message}`);
  }

  const body = buildCommentBody(result, sha);

  const { data: pullRequest } = await github.rest.pulls.get({
    owner,
    repo,
    pull_number: issueNumber,
  });
  if (
    pullRequest.state !== "open" ||
    pullRequest.base?.repo?.full_name !== `${owner}/${repo}` ||
    pullRequest.base?.ref !== "trunk" ||
    pullRequest.head?.sha !== sha
  ) {
    throw new Error(`Benchmark result targets stale or ineligible pull request revision ${sha}.`);
  }

  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  const existing = comments.find(
    (comment) =>
      comment.user?.login === "github-actions[bot]" &&
      comment.user?.type === "Bot" &&
      comment.body?.includes(COMMENT_MARKER),
  );

  if (existing) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }
}
