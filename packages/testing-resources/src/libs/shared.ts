import { createHash } from "node:crypto";
import type { TestResourceDiagnostic, TestResourceDiagnosticStage } from "@croco/testing";
import type { StartedTestContainer } from "testcontainers";
import { TestResourceConfigurationProblem, TestResourceLifecycleProblem } from "./problems";

export const DEFAULT_POSTGRES_IMAGE =
  "postgres:16.10-alpine@sha256:029660641a0cfc575b14f336ba448fb8a75fd595d42e1fa316b9fb4378742297";
export const DEFAULT_REDIS_IMAGE =
  "redis:7.4.5-alpine@sha256:bb186d083732f669da90be8b0f975a37812b15e913465bb14d845db72a4e3e08";

export type ResourceImageOptions = {
  readonly allowUnpinnedImage?: boolean;
  readonly image?: string;
};

export function resolveImage(
  resourceId: string,
  defaultImage: string,
  options: ResourceImageOptions,
): string {
  const image = options.image ?? defaultImage;
  if (!options.allowUnpinnedImage && !/@sha256:[a-f0-9]{64}$/i.test(image)) {
    throw new TestResourceConfigurationProblem(
      `Test resource '${resourceId}' image '${image}' is not digest-pinned. Use an image@sha256 reference or set allowUnpinnedImage only for an intentional local experiment.`,
      { image, resourceId },
    );
  }
  return image;
}

export function isolationSuffix(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 16);
}

export function appendContainerLogs(target: string[]): (stream: NodeJS.ReadableStream) => void {
  return (stream) => {
    stream.on("data", (chunk: Buffer | string) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          target.push(trimmed);
        }
      }
    });
  };
}

export function passedDiagnostic(
  stage: TestResourceDiagnosticStage,
  message: string,
  logs: readonly string[],
): TestResourceDiagnostic {
  return {
    logs: logs.slice(-200),
    message,
    stage,
    status: "passed",
  };
}

export function failedDiagnostic(
  stage: TestResourceDiagnosticStage,
  error: unknown,
  logs: readonly string[],
): TestResourceDiagnostic {
  return {
    logs: logs.slice(-200),
    message: errorMessage(error),
    stage,
    status: "failed",
  };
}

export async function stopContainer(
  resourceId: string,
  container: StartedTestContainer,
  logs: string[],
  diagnostics: TestResourceDiagnostic[],
): Promise<void> {
  try {
    await container.stop();
    diagnostics.push(passedDiagnostic("cleanup", "container stopped", logs));
  } catch (error) {
    diagnostics.push(failedDiagnostic("cleanup", error, logs));
    throw new TestResourceLifecycleProblem(resourceId, "cleanup", errorMessage(error), logs, error);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
