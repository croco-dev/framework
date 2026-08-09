import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { EmailContent } from "@croco/engagement-core";
import { reactEmail, ReactEmailRenderProblem, renderReactEmail } from "../index";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const EXPECTED_FIXTURE_HTML = [
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" ',
  '"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
  '<!--$--><div data-skip-in-text="true" ',
  'style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden">',
  "Review your plan</div>",
  '<main style="font-family:sans-serif"><table role="presentation"><tbody><tr><td>',
  '<h1>Trial ending</h1><a href="https://croco.dev/upgrade" style="display:inline-block">',
  "Review plan</a></td></tr></tbody></table></main><!--/$-->",
].join("");

describe("reactEmail", () => {
  it("renders deterministic table, button, and layout markup", async () => {
    const body = createElement(
      "main",
      { style: { fontFamily: "sans-serif" } },
      createElement(
        "table",
        { role: "presentation" },
        createElement(
          "tbody",
          undefined,
          createElement(
            "tr",
            undefined,
            createElement(
              "td",
              undefined,
              createElement("h1", undefined, "Trial ending"),
              createElement(
                "a",
                { href: "https://croco.dev/upgrade", style: { display: "inline-block" } },
                "Review plan",
              ),
            ),
          ),
        ),
      ),
    );

    const first: EmailContent = await reactEmail({
      subject: "Trial ending",
      preview: "Review your plan",
      body,
      replyTo: "support@croco.dev",
      headers: { "X-Campaign": "trial-ending" },
    });
    const second = await reactEmail({
      subject: "Trial ending",
      preview: "Review your plan",
      body,
      replyTo: "support@croco.dev",
      headers: { "X-Campaign": "trial-ending" },
    });

    expect(first).toEqual(second);
    expect(first.html).toBe(EXPECTED_FIXTURE_HTML);
    expect(first.html).toContain("Review your plan");
    expect(first.html).toContain('<table role="presentation"');
    expect(first.html).toContain("https://croco.dev/upgrade");
    expect(first.text).toBe("TRIAL ENDING\n\nReview plan https://croco.dev/upgrade");
    expect(first.replyTo).toBe("support@croco.dev");
    expect(first.headers).toEqual({ "X-Campaign": "trial-ending" });
  });

  it("uses an explicit text fallback", async () => {
    const content = await reactEmail({
      subject: "Explicit fallback",
      body: createElement("p", undefined, "HTML body"),
      text: "Plain body",
    });

    expect(content.text).toBe("Plain body");
  });

  it("renders a lower-level HTML fixture deterministically", async () => {
    const body = createElement("p", undefined, "Fixture");

    await expect(renderReactEmail(body)).resolves.toBe(await renderReactEmail(body));
  });

  it("preserves valid template elements that use data-msg", async () => {
    const body = createElement("template", { "data-msg": "valid-user-content" }, "Fixture");

    await expect(renderReactEmail(body)).resolves.toContain(
      '<template data-msg="valid-user-content">Fixture</template>',
    );
  });

  it("redacts component data when rendering fails", async () => {
    const secret = "private-customer-value";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ThrowingComponent = vi.fn(() => {
      throw new Error(secret);
    });

    try {
      const rendering = reactEmail({
        subject: "Failure",
        body: createElement(ThrowingComponent, { customer: secret }),
      });

      await expect(rendering).rejects.toBeInstanceOf(ReactEmailRenderProblem);
      await rendering.catch((problem: unknown) => {
        expect(String(problem)).not.toContain(secret);
        expect(JSON.stringify(problem)).not.toContain(secret);
      });
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("keeps React dependencies out of core and provider package declarations", () => {
    for (const packageName of ["engagement-core", "notifications-core", "notifications-resend"]) {
      const manifest = JSON.parse(
        readFileSync(resolve(rootDir, "packages", packageName, "package.json"), "utf8"),
      ) as {
        readonly dependencies?: Readonly<Record<string, string>>;
        readonly peerDependencies?: Readonly<Record<string, string>>;
      };
      const runtimeDependencies = {
        ...manifest.dependencies,
        ...manifest.peerDependencies,
      };

      expect(runtimeDependencies).not.toHaveProperty("@react-email/render");
      expect(runtimeDependencies).not.toHaveProperty("react");
      expect(runtimeDependencies).not.toHaveProperty("react-dom");
    }
  });
});
