import { beforeEach, describe, expect, it, vi } from "vitest";

const openAiConstructorOptions = vi.hoisted(() => [] as unknown[]);

vi.mock("openai", () => ({
  default: class MockOpenAI {
    readonly responses = {
      create: vi.fn(),
    };

    readonly embeddings = {
      create: vi.fn(),
    };

    constructor(options: unknown) {
      openAiConstructorOptions.push(options);
    }
  },
}));

import { createOpenAiSdkTransport } from "../libs/OpenAiSdkTransport";

describe("createOpenAiSdkTransport", () => {
  beforeEach(() => {
    openAiConstructorOptions.length = 0;
  });

  it("disables SDK retries so Croco owns the total outbound attempt budget", () => {
    createOpenAiSdkTransport({
      apiKey: "test-api-key",
      baseUrl: "https://openai.example.test/v1",
      timeout: 2_000,
    });

    expect(openAiConstructorOptions).toEqual([
      {
        apiKey: "test-api-key",
        baseURL: "https://openai.example.test/v1",
        maxRetries: 0,
        timeout: 2_000,
      },
    ]);
  });
});
