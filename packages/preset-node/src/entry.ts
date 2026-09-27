import type { Server as HTTPServer, ServerResponse } from "node:http";
import { serve } from "@hono/node-server";
import type { Hono } from "hono";

import {
  NodeEntryCloseTimeoutProblem,
  NodeEntryLifecycleIoProblem,
  NodeEntryLifecycleProblem,
} from "./problems";

export type NodeHostOptions = {
  readonly port?: number;
  readonly hostname?: string;
};

export type NodeHost = {
  readonly server: HTTPServer | null;
  readonly start: () => Promise<void>;
  readonly close: (timeoutMs?: number) => Promise<void>;
};

/** @deprecated Use `NodeHostOptions`. */
export type NodeEntryOptions = NodeHostOptions;

/** @deprecated Use `NodeHost`. */
export type NodeEntry = NodeHost;

type NodeEntryState = "idle" | "starting" | "started" | "closing" | "closed";

const DEFAULT_CLOSE_TIMEOUT_MS = 30_000;

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

export function createNodeHost(
  honoApp: { readonly fetch: Hono["fetch"] },
  options?: NodeHostOptions,
): NodeHost {
  const port = options?.port ?? 3000;
  const hostname = options?.hostname ?? "0.0.0.0";
  let server: HTTPServer | null = null;
  let state: NodeEntryState = "idle";
  let startPromise: Promise<void> | null = null;
  let closePromise: Promise<void> | null = null;
  let serverClosePromise: Promise<void> | null = null;
  const activeResponses = new Set<ServerResponse>();

  const start = (): Promise<void> => {
    if (state === "closing" || state === "closed") {
      return Promise.reject(new NodeEntryLifecycleProblem("start", state));
    }

    if (state === "started") {
      return Promise.resolve();
    }

    if (startPromise) {
      return startPromise;
    }

    state = "starting";
    let createdServer: HTTPServer | null = null;
    let listening = false;

    const attempt = new Promise<void>((resolve, reject) => {
      const handleStartError = (error: Error) => {
        createdServer?.off("error", handleStartError);
        reject(new NodeEntryLifecycleIoProblem("start", error));
      };

      const handleListening = () => {
        listening = true;
        if (createdServer) {
          createdServer.off("error", handleStartError);
          resolve();
        }
      };

      try {
        createdServer = serve(
          {
            fetch: honoApp.fetch,
            port,
            hostname,
          },
          handleListening,
        ) as unknown as HTTPServer;
        server = createdServer;
        createdServer.prependListener("request", (_request, response: ServerResponse) => {
          activeResponses.add(response);
          response.once("close", () => activeResponses.delete(response));
          response.once("finish", () => {
            if (state === "closing") {
              createdServer?.closeIdleConnections?.();
            }
          });
          const writeHead = response.writeHead;
          response.writeHead = ((...args: unknown[]) => {
            if (state === "closing" && !response.headersSent) {
              response.setHeader("Connection", "close");
              const headersIndex = args[2] === undefined && typeof args[1] !== "string" ? 1 : 2;
              const headers = args[headersIndex];
              if (Array.isArray(headers)) {
                const remaining: unknown[] = [];
                for (let index = 0; index < headers.length; index += 2) {
                  if (String(headers[index]).toLowerCase() !== "connection") {
                    remaining.push(headers[index], headers[index + 1]);
                  }
                }
                args[headersIndex] = [...remaining, "Connection", "close"];
              } else if (headers && typeof headers === "object") {
                args[headersIndex] = {
                  ...Object.fromEntries(
                    Object.entries(headers).filter(([name]) => name.toLowerCase() !== "connection"),
                  ),
                  Connection: "close",
                };
              }
            }
            return Reflect.apply(writeHead, response, args) as ServerResponse;
          }) as ServerResponse["writeHead"];
          if (state === "closing" && !response.headersSent) {
            response.setHeader("Connection", "close");
          }
        });
        createdServer.once("error", handleStartError);

        if (listening) {
          createdServer.off("error", handleStartError);
          resolve();
        }
      } catch (error) {
        createdServer?.off("error", handleStartError);
        server = null;
        reject(new NodeEntryLifecycleIoProblem("start", asError(error)));
      }
    });

    const settledAttempt = attempt.then(
      () => {
        if (state === "starting") {
          state = "started";
        }
      },
      (error: unknown) => {
        if (server === createdServer) {
          server = null;
        }
        if (state === "starting") {
          state = "idle";
        }
        throw error;
      },
    );
    const sharedAttempt = settledAttempt.finally(() => {
      if (startPromise === sharedAttempt) {
        startPromise = null;
      }
    });

    startPromise = sharedAttempt;
    return sharedAttempt;
  };

  const close = (timeoutMs = DEFAULT_CLOSE_TIMEOUT_MS): Promise<void> => {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      return Promise.reject(new NodeEntryCloseTimeoutProblem(timeoutMs));
    }

    if (closePromise) {
      return closePromise;
    }

    if (state === "closed") {
      return Promise.resolve();
    }

    const activeStart = startPromise;
    state = "closing";

    const closeActiveServer = async () => {
      if (activeStart) {
        try {
          await activeStart;
        } catch {
          // A failed start creates no listener, so close can still complete.
          server = null;
        }
      }

      const activeServer = server;
      if (!activeServer) {
        state = "closed";
        return;
      }

      let activeServerClose = serverClosePromise;
      if (!activeServerClose) {
        const serverCloseAttempt = new Promise<void>((resolve, reject) => {
          try {
            activeServer.close((error?: Error) => {
              if (error) {
                reject(new NodeEntryLifecycleIoProblem("close", error));
                return;
              }
              resolve();
            });
            for (const response of activeResponses) {
              if (!response.headersSent) {
                response.setHeader("Connection", "close");
              }
            }
            activeServer.closeIdleConnections?.();
          } catch (error) {
            reject(new NodeEntryLifecycleIoProblem("close", asError(error)));
          }
        });
        const settledServerClose = serverCloseAttempt.then(
          () => {
            if (server === activeServer) {
              server = null;
            }
            state = "closed";
          },
          (error: unknown) => {
            state = server ? "closing" : "closed";
            throw error;
          },
        );
        const sharedServerClose = settledServerClose.finally(() => {
          if (serverClosePromise === sharedServerClose) {
            serverClosePromise = null;
          }
        });

        serverClosePromise = sharedServerClose;
        activeServerClose = sharedServerClose;
      }

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const closeTimer = setTimeout(() => {
          settled = true;
          try {
            activeServer.closeAllConnections?.();
          } catch (error) {
            reject(new NodeEntryLifecycleIoProblem("close", asError(error)));
            return;
          }
          reject(
            new NodeEntryLifecycleIoProblem(
              "close",
              new Error(`Node server close timed out after ${timeoutMs}ms.`),
            ),
          );
        }, timeoutMs);

        void activeServerClose.then(
          () => {
            if (!settled) {
              settled = true;
              clearTimeout(closeTimer);
              resolve();
            }
          },
          (error: unknown) => {
            if (!settled) {
              settled = true;
              clearTimeout(closeTimer);
              reject(error);
            }
          },
        );
      });
    };

    const settledClose = closeActiveServer().catch((error: unknown) => {
      state = server ? "closing" : "closed";
      throw error;
    });
    const sharedClose = settledClose.finally(() => {
      if (closePromise === sharedClose) {
        closePromise = null;
      }
    });

    closePromise = sharedClose;
    return sharedClose;
  };

  return {
    get server() {
      return server;
    },
    start,
    close,
  };
}

/** @deprecated Use `createNodeHost`. */
export const createNodeEntry = createNodeHost;
