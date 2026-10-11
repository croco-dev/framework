import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { JourneyConsole } from "@croco/admin-react";
import type {
  JourneyAdminCommand,
  JourneyAdminState,
  JourneyDryRunView,
  JourneyEpisodeView,
} from "@croco/admin-core";
import type { JourneyDefinition } from "@croco/lifecycle-core";

type Config = {
  definition: JourneyDefinition;
  state: JourneyAdminState;
  permissions: readonly ("journey.read" | "journey.preview" | "journey.operate")[];
  samples: readonly { id: string; label: string }[];
};

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  if (!response.ok) {
    const problem: unknown = await response.json();
    const code =
      typeof problem === "object" &&
      problem !== null &&
      "code" in problem &&
      typeof problem.code === "string"
        ? problem.code
        : "JOURNEY_HTTP_ERROR";
    throw Object.assign(new Error(`Journey operation failed: ${response.status}`), { code });
  }
  return response.json() as Promise<T>;
}

async function main() {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Journey example root is missing");
  }
  const root = createRoot(rootElement);
  try {
    const config = await request<Config>("/api/config");
    root.render(
      createElement(JourneyConsole, {
        scopeKey: "demo-store/local/demo-tenant",
        ...config,
        onDryRun: (definition: JourneyDefinition, sampleId: string) =>
          request<JourneyDryRunView>("/api/preview", { definition, sampleId }),
        onCommand: (command: JourneyAdminCommand) =>
          request<JourneyEpisodeView>("/api/command", command),
      }),
    );
  } catch {
    root.render(
      createElement("p", { role: "alert" }, "Journey example is unavailable. Reload to retry."),
    );
  }
}

void main();
