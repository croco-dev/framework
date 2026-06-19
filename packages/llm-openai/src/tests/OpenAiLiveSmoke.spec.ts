import { describe, expect, it } from "vitest";
import { OpenAiLlmModel } from "../libs/OpenAiLlmModel";
import { OpenAiMissingConfigProblem } from "../libs/problems/OpenAiProblems";

const apiKey = process.env.OPENAI_API_KEY;
const liveModel = process.env.OPENAI_LIVE_MODEL ?? "gpt-5.5";
const liveEmbeddingModel = process.env.OPENAI_LIVE_EMBEDDING_MODEL ?? "text-embedding-3-small";

describe("OpenAI live smoke", () => {
  it.skipIf(!apiKey)(
    "requires OPENAI_API_KEY and generates text and embeddings against OpenAI",
    async () => {
      const resolvedApiKey = requireApiKey();

      const model = new OpenAiLlmModel({
        modelId: liveModel,
        embeddingModelId: liveEmbeddingModel,
        apiKey: resolvedApiKey,
      });

      const generated = await model.generate({
        prompt: "Reply with exactly one short word.",
        maxTokens: 8,
      });
      const embedded = await model.embed({ text: "croco live smoke" });

      expect(generated.text.length).toBeGreaterThan(0);
      expect(generated.usage.totalTokens).toBeGreaterThan(0);
      expect(embedded.embedding.length).toBeGreaterThan(0);
      expect(embedded.usage.totalTokens).toBeGreaterThan(0);
    },
    60_000,
  );
});

function requireApiKey(): string {
  if (!apiKey) {
    throw new OpenAiMissingConfigProblem("OPENAI_API_KEY");
  }

  return apiKey;
}
