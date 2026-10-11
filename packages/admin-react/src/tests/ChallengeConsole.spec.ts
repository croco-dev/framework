import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChallengeConsole } from "../libs/ChallengeConsole";
import type { ChallengeOperationsDefinition } from "@croco/admin-core";

const initialDefinition: ChallengeOperationsDefinition = {
  id: "challenge",
  version: 1,
  scope: { app: "app", environment: "test", tenantId: "tenant" },
  start: new Date("2026-01-01Z"),
  end: new Date("2026-02-01Z"),
  goal: 4,
  memberCap: 2,
  minMembers: 2,
  lateAllowanceMs: 1000,
  visibility: "aggregate",
  leavePolicy: "retain",
};
describe("Challenge console", () => {
  it.each([{ permissions: [] }, { permissions: ["challenge.read"] }])(
    "does not mutate during render with permissions %j",
    ({ permissions }) => {
      const source = { load: vi.fn(), save: vi.fn(), close: vi.fn() };
      const html = renderToString(
        createElement(ChallengeConsole, {
          actor: "operator",
          scopeKey: "tenant",
          permissions,
          source,
          initialDefinition,
        }),
      );
      expect(html).toContain(
        permissions.length ? "Loading challenge operations" : "read permission is required",
      );
      expect(html).not.toContain("Create challenge");
      expect(source.load).not.toHaveBeenCalled();
      expect(source.save).not.toHaveBeenCalled();
      expect(source.close).not.toHaveBeenCalled();
    },
  );
});
