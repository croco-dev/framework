import OpenAI from "openai";
import type {
  OpenAiEmbeddingRequest,
  OpenAiEmbeddingResponse,
  OpenAiRequestOptions,
  OpenAiResponse,
  OpenAiResponseRequest,
  OpenAiSdkTransportOptions,
  OpenAiStreamEvent,
  OpenAiTransport,
} from "./types";

type OpenAiClientShape = {
  readonly responses: {
    create(request: unknown, options?: unknown): Promise<unknown>;
  };
  readonly embeddings: {
    create(request: unknown, options?: unknown): Promise<unknown>;
  };
};

export function createOpenAiSdkTransport(options: OpenAiSdkTransportOptions): OpenAiTransport {
  const client = new OpenAI({
    apiKey: options.apiKey,
    ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
    ...(options.timeout ? { timeout: options.timeout } : {}),
  }) as unknown as OpenAiClientShape;

  return {
    async createResponse(
      request: OpenAiResponseRequest,
      requestOptions?: OpenAiRequestOptions,
    ): Promise<OpenAiResponse> {
      const response = await client.responses.create(request, requestOptions);
      return response as OpenAiResponse;
    },

    async streamResponse(
      request: OpenAiResponseRequest,
      requestOptions?: OpenAiRequestOptions,
    ): Promise<AsyncIterable<OpenAiStreamEvent>> {
      const stream = await client.responses.create(
        {
          ...request,
          stream: true,
        },
        requestOptions,
      );
      return stream as AsyncIterable<OpenAiStreamEvent>;
    },

    async createEmbedding(
      request: OpenAiEmbeddingRequest,
      requestOptions?: OpenAiRequestOptions,
    ): Promise<OpenAiEmbeddingResponse> {
      const response = await client.embeddings.create(request, requestOptions);
      return response as OpenAiEmbeddingResponse;
    },
  };
}
