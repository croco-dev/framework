import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { buildCommentBody, run } from "../post-benchmark-comment.mjs";

describe("post-benchmark-comment.mjs", () => {
  it("includes gate failures and an explicit empty-report row", () => {
    const body = buildCommentBody(
      {
        allPassed: false,
        gateFailures: ["No benchmark reports were collected."],
        reports: [],
      },
      "1234567890abcdef",
    );

    expect(body).toContain("### Gate failures");
    expect(body).toContain("- No benchmark reports were collected.");
    expect(body).toContain(
      "| _No benchmark rows collected_ | - | - | - | - | ❌ | Check workflow logs. |",
    );
  });

  it("marks either threshold or baseline skip as a warning and includes the reason", () => {
    const body = buildCommentBody(
      {
        allPassed: false,
        reports: [
          {
            name: "Example benchmark",
            p75: 1,
            threshold: 2,
            baselineStatus: "skip",
            thresholdStatus: "pass",
            baselineSkipReason: "No baseline defined in benchmarks/baseline.json.",
          },
        ],
      },
      "1234567890abcdef",
    );

    expect(body).toContain(
      "| Example benchmark | 1.0ms | 2.0ms | - | - | ⚠️ | No baseline defined in benchmarks/baseline.json. |",
    );
  });

  it("neutralizes markdown control characters and mentions from benchmark artifacts", () => {
    const body = buildCommentBody(
      {
        allPassed: false,
        gateFailures: ["@maintainers | investigate"],
        reports: [
          {
            name: "Injected | row\n@maintainers",
            p75: 1,
            thresholdStatus: "fail",
          },
        ],
      },
      "1234567890abcdef",
    );

    expect(body).toContain("- &#64;maintainers &#124; investigate");
    expect(body).toContain("| Injected &#124; row &#64;maintainers | 1.0ms");
    expect(body).not.toContain("@maintainers");
  });

  it("revalidates the live pull request revision before any comment write", async () => {
    const fixtureDir = mkdtempSync(resolve(tmpdir(), "benchmark-comment-"));
    const resultPath = resolve(fixtureDir, "benchmark-result.json");
    writeFileSync(resultPath, JSON.stringify({ allPassed: true, reports: [] }));
    const paginate = vi.fn();
    const updateComment = vi.fn();
    const createComment = vi.fn();
    const github = {
      paginate,
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({
            data: {
              state: "open",
              base: { ref: "trunk", repo: { full_name: "croco/framework" } },
              head: { sha: "b".repeat(40) },
            },
          }),
        },
        issues: { listComments: vi.fn(), updateComment, createComment },
      },
    };

    try {
      await expect(
        run({
          github,
          owner: "croco",
          repo: "framework",
          issueNumber: 123,
          sha: "a".repeat(40),
          resultPath,
        }),
      ).rejects.toThrow("stale or ineligible pull request revision");
      expect(paginate).not.toHaveBeenCalled();
      expect(updateComment).not.toHaveBeenCalled();
      expect(createComment).not.toHaveBeenCalled();
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it("ignores a user-authored marker and creates the trusted workflow comment", async () => {
    const fixtureDir = mkdtempSync(resolve(tmpdir(), "benchmark-comment-"));
    const resultPath = resolve(fixtureDir, "benchmark-result.json");
    const sha = "a".repeat(40);
    writeFileSync(resultPath, JSON.stringify({ allPassed: true, reports: [] }));
    const updateComment = vi.fn();
    const createComment = vi.fn();
    const github = {
      paginate: vi.fn().mockResolvedValue([
        {
          id: 1,
          body: "<!-- benchmark-results -->",
          user: { login: "contributor", type: "User" },
        },
      ]),
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({
            data: {
              state: "open",
              base: { ref: "trunk", repo: { full_name: "croco/framework" } },
              head: { sha },
            },
          }),
        },
        issues: { listComments: vi.fn(), updateComment, createComment },
      },
    };

    try {
      await run({
        github,
        owner: "croco",
        repo: "framework",
        issueNumber: 123,
        sha,
        resultPath,
      });
      expect(updateComment).not.toHaveBeenCalled();
      expect(createComment).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "croco", repo: "framework", issue_number: 123 }),
      );
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it("updates only the GitHub Actions bot marker across paginated comments", async () => {
    const fixtureDir = mkdtempSync(resolve(tmpdir(), "benchmark-comment-"));
    const resultPath = resolve(fixtureDir, "benchmark-result.json");
    const sha = "a".repeat(40);
    writeFileSync(resultPath, JSON.stringify({ allPassed: true, reports: [] }));
    const updateComment = vi.fn();
    const createComment = vi.fn();
    const listComments = vi.fn();
    const github = {
      paginate: vi.fn().mockResolvedValue([
        {
          id: 1,
          body: "<!-- benchmark-results -->",
          user: { login: "contributor", type: "User" },
        },
        {
          id: 2,
          body: "<!-- benchmark-results -->",
          user: { login: "github-actions[bot]", type: "Bot" },
        },
      ]),
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({
            data: {
              state: "open",
              base: { ref: "trunk", repo: { full_name: "croco/framework" } },
              head: { sha },
            },
          }),
        },
        issues: { listComments, updateComment, createComment },
      },
    };

    try {
      await run({
        github,
        owner: "croco",
        repo: "framework",
        issueNumber: 123,
        sha,
        resultPath,
      });
      expect(github.paginate).toHaveBeenCalledWith(
        listComments,
        expect.objectContaining({ per_page: 100 }),
      );
      expect(updateComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 2 }));
      expect(createComment).not.toHaveBeenCalled();
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});
