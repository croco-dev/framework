import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExperienceConsole } from "../libs/ExperienceConsole";
import type { ExperienceConfig } from "@croco/experience-core";

const config: ExperienceConfig = {
  id: "tip",
  placementId: "checkout.assurance",
  scope: { appId: "shop", environment: "test", tenantId: "tenant-a" },
  revision: 1,
  status: "draft",
  renderer: "banner",
  content: { locale: "en", title: "Order help", body: "We can help." },
  priority: 1,
};

describe("ExperienceConsole", () => {
  it("shows storage failure without a stale publication editor", () => {
    const html = renderToString(
      h(ExperienceConsole, {
        config,
        placement: {
          id: config.placementId,
          schema: {
            contextFields: { plan: "string" },
            content: {
              locales: ["en"],
              maxTitleLength: 120,
              maxBodyLength: 1000,
              allowActionUrl: true,
            },
          },
          allowedRenderers: ["banner"],
        },
        state: { kind: "failed", code: "Experience storage unavailable" },
        renderers: { banner: (content) => h("p", null, content.body) },
        canPreview: true,
        canPublish: true,
        onPreview: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(html).toContain("Experience storage unavailable");
    expect(html).not.toContain("revision 1");
    expect(html).not.toContain("Publish");
  });

  it("shows scoped registered fields and disables publication before preview", () => {
    const html = renderToString(
      h(ExperienceConsole, {
        config,
        placement: {
          id: config.placementId,
          schema: {
            contextFields: { plan: "string" },
            content: {
              locales: ["en"],
              maxTitleLength: 120,
              maxBodyLength: 1000,
              allowActionUrl: true,
            },
          },
          allowedRenderers: ["banner"],
        },
        state: { kind: "ready", configs: [config] },
        renderers: { banner: (content) => h("p", null, content.body) },
        canPreview: true,
        canPublish: true,
        onPreview: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(html).toContain("tenant-a");
    expect(html).toContain("Published cohort snapshot ID");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Publish<\/button>/);
  });

  it("exposes every registered context condition for editing", () => {
    const html = renderToString(
      h(ExperienceConsole, {
        config: {
          ...config,
          targeting: {
            context: [
              { field: "plan", operator: "eq", value: "paid" },
              { field: "plan", operator: "in", value: ["paid", "trial"] },
            ],
          },
        },
        placement: {
          id: config.placementId,
          schema: {
            contextFields: { plan: "string" },
            content: {
              locales: ["en"],
              maxTitleLength: 120,
              maxBodyLength: 1000,
              allowActionUrl: true,
            },
          },
          allowedRenderers: ["banner"],
        },
        state: { kind: "ready", configs: [config] },
        renderers: { banner: (content) => h("p", null, content.body) },
        canPreview: true,
        canPublish: true,
        onPreview: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(html).toContain("Condition 2");
    expect(html).toContain("Add condition");
    expect(html).toContain("Remove condition");
  });

  it("uses explicit controls for boolean context conditions", () => {
    const placement = {
      id: config.placementId,
      schema: {
        contextFields: { active: "boolean" as const },
        content: {
          locales: ["en"],
          maxTitleLength: 120,
          maxBodyLength: 1000,
          allowActionUrl: true,
        },
      },
      allowedRenderers: ["banner"],
    };
    const render = (operator: "eq" | "in") =>
      renderToString(
        h(ExperienceConsole, {
          config: {
            ...config,
            targeting: {
              context: [
                operator === "eq"
                  ? { field: "active", operator, value: false }
                  : { field: "active", operator, value: [false] },
              ],
            },
          },
          placement,
          state: { kind: "ready", configs: [config] },
          renderers: { banner: (content) => h("p", null, content.body) },
          canPreview: true,
          canPublish: true,
          onPreview: vi.fn(),
          onSave: vi.fn(),
        }),
      );

    expect(render("eq")).toMatch(
      /<select[^>]*><option value="false"[^>]*>False<\/option><option value="true"[^>]*>True<\/option><\/select>/,
    );
    expect(render("in")).toContain('type="checkbox"');
  });
});
