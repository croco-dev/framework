import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Container, Context as FrameworkContext } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import {
  createProblemResponseDetail,
  createProblemResponseExtensions,
  Problem,
  resolveProblemResponseRedactionPolicy,
} from "@croco/problems-core";
import { isProblem, problemToGraphQLError } from "@croco/protocols-graphql";
import { createYoga, maskError } from "graphql-yoga";
import {
  GraphQLRequestBodyAbortedProblem,
  GraphQLRequestBodyTooLargeProblem,
  GraphQLRequestHandlingFailedProblem,
  GraphQLSchemaNotConfiguredProblem,
  GraphQLServerNotInitializedProblem,
} from "./problems/GraphQLTransportProblems";
import type { GraphQLServerOptions } from "./types";

type YogaHandler = (request: Request) => Promise<Response>;
type NodeRequestPhase =
  | "request-context"
  | "request-url"
  | "request-body"
  | "request-construction"
  | "yoga-execution"
  | "response-headers"
  | "response-body"
  | "response-write";

const DEFAULT_MAX_BODY_SIZE_BYTES = 1024 * 1024;

const CROCO_YOGA_LOGGER = {
  debug: (...args: unknown[]) => console.debug(...args),
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => {
    const [error] = args;
    const problem = getCrocoProblem(error);

    if (problem) {
      console.error(problemToGraphQLError(problem, getGraphQLErrorPath(error)));
      return;
    }

    console.error(...args);
  },
};

export class GraphQLServer {
  private yogaHandler: YogaHandler | null = null;
  private server: Server | null = null;
  private initialized = false;

  constructor(private options: GraphQLServerOptions = {}) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const {
      schema,
      schemaOptions,
      context,
      graphqlEndpoint = "/graphql",
      cors,
      plugins,
    } = this.options;

    let graphqlSchema = schema;

    if (!graphqlSchema && schemaOptions) {
      const { SchemaCompiler } = await import("./SchemaCompiler");
      graphqlSchema = await SchemaCompiler.compileSchema(schemaOptions);
    }

    if (!graphqlSchema) {
      throw new GraphQLSchemaNotConfiguredProblem();
    }

    const yoga = createYoga({
      schema: graphqlSchema,
      graphqlEndpoint,
      cors,
      plugins,
      logging: CROCO_YOGA_LOGGER,
      maskedErrors: {
        maskError: maskCrocoProblemError,
      },
      context: async ({ request }) => {
        const userContext =
          typeof context === "function" ? await context(request) : (context ?? {});
        return {
          ...userContext,
          headers: Object.fromEntries(request.headers),
        };
      },
    });

    this.yogaHandler = yoga.fetch.bind(yoga) as YogaHandler;

    this.initialized = true;
  }

  getHandler(): YogaHandler {
    if (!this.yogaHandler) {
      throw new GraphQLServerNotInitializedProblem();
    }
    const yoga = this.yogaHandler;
    return async (request: Request) => {
      const requestId = randomUUID();
      return FrameworkContext.run({ requestId }, () => yoga(request));
    };
  }

  async start(port: number): Promise<void> {
    await this.initialize();

    if (!this.yogaHandler) {
      throw new GraphQLServerNotInitializedProblem("Server not initialized.");
    }

    const handler = (req: IncomingMessage, res: ServerResponse): void => {
      let phase: NodeRequestPhase = "request-context";

      const requestLifecycle = Promise.resolve().then(() => {
        const requestId = randomUUID();
        phase = "request-url";
        return FrameworkContext.run({ requestId }, async () => {
          const url = req.url
            ? new URL(req.url, `http://${req.headers.host}`)
            : new URL("http://localhost");
          const method = req.method || "GET";

          let body: string | undefined;

          if (req.method !== "GET" && req.method !== "HEAD") {
            phase = "request-body";
            body = await this.getBody(req);
          }

          phase = "request-construction";
          const request = new Request(url, {
            method,
            headers: req.headers as HeadersInit,
            body,
          });

          if (!this.yogaHandler) {
            throw new GraphQLServerNotInitializedProblem("Server not initialized.");
          }

          phase = "yoga-execution";
          const response = await this.yogaHandler(request);

          phase = "response-headers";
          res.statusCode = response.status;
          const setCookieHeaders = getSetCookieHeaders(response.headers);
          if (setCookieHeaders.length > 0) {
            res.setHeader("set-cookie", setCookieHeaders);
          }
          response.headers.forEach((value: string, key: string) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });

          phase = "response-body";
          const responseBody = await response.text();
          phase = "response-write";
          await this.writeNodeResponse(res, responseBody);
        });
      });

      void requestLifecycle
        .catch((error: unknown) => this.handleNodeRequestFailure(error, phase, res))
        .catch((error: unknown) => {
          this.recordNodeRequestFailure(error, "response-write");
          if (!res.destroyed) {
            this.destroyNodeResponse(res);
          }
        });
    };

    this.server = createServer(handler);

    await new Promise<void>((resolve, reject) => {
      this.server?.listen(port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          try {
            const logger = Container.get(Logger);
            logger.info(
              `GraphQL Server running on http://localhost:${port}${this.options.graphqlEndpoint || "/graphql"}`,
            );
          } catch {
            // Intentionally ignored: Logger is optional for startup logging
          }
          resolve();
        }
      });
    });
  }

  private getBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const maxBodySizeBytes = this.options.maxBodySizeBytes ?? DEFAULT_MAX_BODY_SIZE_BYTES;
      const contentLength = req.headers["content-length"];

      if (typeof contentLength === "string") {
        const parsedContentLength = Number(contentLength);

        if (Number.isFinite(parsedContentLength) && parsedContentLength > maxBodySizeBytes) {
          reject(new GraphQLRequestBodyTooLargeProblem(maxBodySizeBytes));
          return;
        }
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      const cleanup = () => {
        req.off("data", onData);
        req.off("end", onEnd);
        req.off("error", onError);
        req.off("aborted", onAborted);
      };

      const onData = (chunk: Buffer) => {
        totalBytes += chunk.length;

        if (totalBytes > maxBodySizeBytes) {
          cleanup();
          req.pause();
          reject(new GraphQLRequestBodyTooLargeProblem(maxBodySizeBytes));
          return;
        }

        chunks.push(chunk);
      };

      const onEnd = () => {
        cleanup();
        resolve(Buffer.concat(chunks).toString());
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onAborted = () => {
        cleanup();
        reject(new GraphQLRequestBodyAbortedProblem());
      };

      req.on("data", onData);
      req.on("end", onEnd);
      req.on("error", onError);
      req.on("aborted", onAborted);
    });
  }

  private async handleNodeRequestFailure(
    error: unknown,
    phase: NodeRequestPhase,
    res: ServerResponse,
  ): Promise<void> {
    this.recordNodeRequestFailure(error, phase);

    if (res.destroyed || res.writableFinished) {
      return;
    }

    const problem = error instanceof Problem ? error : new GraphQLRequestHandlingFailedProblem();

    if (res.headersSent || res.writableEnded) {
      this.destroyNodeResponse(res);
      return;
    }

    for (const headerName of res.getHeaderNames()) {
      res.removeHeader(headerName);
    }

    const redactionPolicy = resolveProblemResponseRedactionPolicy(problem);
    const detail = createProblemResponseDetail(problem.detail, redactionPolicy);
    const body = {
      type: problem.type,
      title: problem.title,
      status: problem.status,
      code: problem.code,
      ...(detail !== undefined ? { detail } : {}),
      ...createProblemResponseExtensions(problem.extensions, redactionPolicy),
    };

    res.statusCode = problem.status;
    res.setHeader("content-type", "application/problem+json");
    if (problem instanceof GraphQLRequestBodyTooLargeProblem) {
      res.setHeader("connection", "close");
    }
    await this.writeNodeResponse(res, JSON.stringify(body));
  }

  private writeNodeResponse(res: ServerResponse, body: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        res.off("finish", onFinish);
        res.off("error", onError);
        res.off("close", onClose);
      };
      const onFinish = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onClose = () => {
        if (res.writableFinished) return;
        cleanup();
        reject(new GraphQLRequestHandlingFailedProblem());
      };

      res.once("finish", onFinish);
      res.once("error", onError);
      res.once("close", onClose);

      try {
        res.end(body);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  private destroyNodeResponse(res: ServerResponse): void {
    try {
      res.destroy();
    } catch {
      return;
    }
  }

  private recordNodeRequestFailure(error: unknown, phase: NodeRequestPhase): void {
    const problemCode =
      error instanceof Problem ? error.code : "transports-graphql/request-handling-failed";
    const diagnostic = { phase, problemCode };

    try {
      if (Container.has(Logger)) {
        Container.get(Logger).error("GraphQL request failed", diagnostic);
        return;
      }
      console.error("GraphQL request failed", diagnostic);
    } catch {
      try {
        console.error("GraphQL request failed", diagnostic);
      } catch {
        return;
      }
    }
  }

  stop(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

function getSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (headers as { getSetCookie?: () => string[] }).getSetCookie;

  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers);
  }

  const setCookieHeaders: string[] = [];
  headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      setCookieHeaders.push(value);
    }
  });
  return setCookieHeaders;
}

function maskCrocoProblemError(error: unknown, message: string, isDev?: boolean): Error {
  const problem = getCrocoProblem(error);

  if (!problem) {
    return maskError(error, message, isDev);
  }

  return problemToGraphQLError(problem, getGraphQLErrorPath(error));
}

function getCrocoProblem(error: unknown): Problem | undefined {
  let currentError: unknown = error;
  const visited = new Set<Error>();

  while (currentError instanceof Error && !visited.has(currentError)) {
    if (isProblem(currentError)) {
      return currentError;
    }

    visited.add(currentError);

    if (!isGraphQLError(currentError)) {
      return undefined;
    }

    currentError = currentError.originalError;
  }

  return undefined;
}

function getGraphQLErrorPath(error: unknown): readonly (string | number)[] | undefined {
  return error instanceof Error && isGraphQLError(error) ? error.path : undefined;
}

function isGraphQLError(error: Error): error is Error & {
  originalError?: unknown;
  path?: readonly (string | number)[];
} {
  return error.name === "GraphQLError";
}
