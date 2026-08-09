import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Container, Context as FrameworkContext } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Problem } from "@croco/problems-core";
import { isProblem, problemToGraphQLError } from "@croco/protocols-graphql";
import { createYoga, maskError } from "graphql-yoga";
import {
  GraphQLRequestBodyAbortedProblem,
  GraphQLRequestBodyTooLargeProblem,
  GraphQLSchemaNotConfiguredProblem,
  GraphQLServerNotInitializedProblem,
} from "./problems/GraphQLTransportProblems";
import type { GraphQLServerOptions } from "./types";

type YogaHandler = (request: Request) => Promise<Response>;

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

    const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      const url = req.url
        ? new URL(req.url, `http://${req.headers.host}`)
        : new URL("http://localhost");
      const method = req.method || "GET";

      let body: string | undefined;

      if (req.method !== "GET" && req.method !== "HEAD") {
        try {
          body = await this.getBody(req);
        } catch (error) {
          if (error instanceof Problem) {
            res.statusCode = error.status;
            res.setHeader("content-type", "application/problem+json");
            if (error instanceof GraphQLRequestBodyTooLargeProblem) {
              res.setHeader("connection", "close");
            }
            res.end(JSON.stringify(error.toJSON()));
            return;
          }

          throw error;
        }
      }

      const request = new Request(url, {
        method,
        headers: req.headers as HeadersInit,
        body,
      });

      if (!this.yogaHandler) {
        const problem = new GraphQLServerNotInitializedProblem("Server not initialized.");
        res.statusCode = problem.status;
        res.setHeader("content-type", "application/problem+json");
        res.end(JSON.stringify(problem.toJSON()));
        return;
      }

      const yoga = this.yogaHandler;
      const response = await FrameworkContext.run({ requestId: randomUUID() }, () => yoga(request));

      res.statusCode = response.status;
      const setCookieHeaders = getSetCookieHeaders(response.headers);
      if (setCookieHeaders.length > 0) {
        res.setHeader("set-cookie", setCookieHeaders);
      }
      response.headers.forEach((value: string, key: string) => {
        if (key.toLowerCase() === "set-cookie") return;
        res.setHeader(key, value);
      });

      const responseBody = await response.text();
      res.end(responseBody);
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
