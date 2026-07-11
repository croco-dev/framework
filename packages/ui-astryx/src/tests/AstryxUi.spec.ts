import type { FrontendSessionState, ProblemRecoveryAction } from "@croco/frontend-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  AstryxAppShell,
  AstryxAuthState,
  AstryxProblemView,
  AstryxProvider,
  toAstryxAuthStateProps,
} from "../index";
import type { AstryxAuthStateProps } from "../index";

const problem = {
  code: "AUTH_PROVIDER_UNAVAILABLE",
  detail: "The identity provider did not respond.",
  instance: "/sessions/current",
  status: 503,
  title: "Authentication unavailable",
  type: "https://croco.dev/problems/auth-provider-unavailable",
};

describe("@croco/ui-astryx", () => {
  it("renders the neutral Astryx theme and application shell on the server", () => {
    const content = createElement("main", undefined, "Ready");
    const shell = createElement(AstryxAppShell, { appName: "Croco Console" }, content);
    const html = renderToStaticMarkup(createElement(AstryxProvider, { mode: "dark" }, shell));

    expect(html).toContain('data-astryx-theme="neutral"');
    expect(html).toContain('data-croco-ui-profile="astryx"');
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('data-croco-app-name="true"');
    expect(html).toContain("Croco Console");
    expect(html).toContain("Ready");
  });

  it("preserves RFC 7807 evidence and applicable recovery actions", () => {
    const retry = vi.fn();
    const actions: readonly ProblemRecoveryAction[] = [
      {
        id: "retry",
        label: "Retry",
        onRecover: retry,
        problemCodes: [problem.code],
      },
      { id: "ignored", label: "Ignore me", problemCodes: ["OTHER_PROBLEM"] },
    ];

    const html = renderToStaticMarkup(
      createElement(AstryxProblemView, { problem, recoveryActions: actions }),
    );

    expect(html).toContain(`data-croco-problem-code="${problem.code}"`);
    expect(html).toContain(problem.title);
    expect(html).toContain(problem.detail);
    expect(html).toContain(problem.type);
    expect(html).toContain(problem.instance);
    expect(html).toContain("Retry");
    expect(html).not.toContain("Ignore me");
    expect(retry).not.toHaveBeenCalled();
  });

  it("renders an explicit signed-out state for generated applications", () => {
    const html = renderToStaticMarkup(
      createElement(AstryxAuthState, {
        detail: "Sign in to manage this tenant.",
        state: "signed-out",
      }),
    );

    expect(html).toContain('data-croco-auth-state="signed-out"');
    expect(html).toContain("Signed out");
    expect(html).toContain("Sign in to manage this tenant.");
  });

  it("maps Croco frontend session contracts without treating unavailable state as signed out", () => {
    const mapFrontendSessionState: (state: FrontendSessionState) => AstryxAuthStateProps =
      toAstryxAuthStateProps;
    const sessionState: FrontendSessionState = {
      kind: "unavailable",
      problem,
      recoveryActions: [{ href: "/status", id: "status", label: "Service status" }],
    };

    const props = mapFrontendSessionState(sessionState);
    const html = renderToStaticMarkup(createElement(AstryxAuthState, props));

    expect(props.state).toBe("unavailable");
    expect(html).toContain('data-croco-auth-state="unavailable"');
    expect(html).toContain(problem.code);
    expect(html).toContain("Service status");
    expect(html).toContain('href="/status"');
  });
});
