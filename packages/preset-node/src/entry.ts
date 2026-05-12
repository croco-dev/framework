import type { Server as HTTPServer } from "node:http";
import { serve } from "@hono/node-server";
import type { Hono } from "hono";

export type NodeEntryOptions = {
  readonly port?: number;
  readonly hostname?: string;
};

export type NodeEntry = {
  readonly server: HTTPServer | null;
  readonly start: () => Promise<void>;
  readonly close: () => Promise<void>;
};

export function createNodeEntry(
  honoApp: { readonly fetch: Hono["fetch"] },
  options?: NodeEntryOptions,
): NodeEntry {
  const port = options?.port ?? 3000;
  const hostname = options?.hostname ?? "0.0.0.0";
  let server: HTTPServer | null = null;

  return {
    get server() {
      return server;
    },
    start: async () => {
      return new Promise<void>((resolve, reject) => {
        const handleStartError = (error: Error) => {
          server?.off("error", handleStartError);
          server = null;
          reject(error);
        };

        try {
          server = serve(
            {
              fetch: honoApp.fetch,
              port,
              hostname,
            },
            () => {
              server?.off("error", handleStartError);
              resolve();
            },
          ) as unknown as HTTPServer;
          server.once?.("error", handleStartError);
        } catch (err) {
          reject(err);
        }
      });
    },
    close: async () => {
      return new Promise<void>((resolve) => {
        if (!server) {
          resolve();
          return;
        }

        server.close(() => {
          server = null;
          resolve();
        });
      });
    },
  };
}
