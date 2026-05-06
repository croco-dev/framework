import { createServer, type Server } from 'node:http';
import type { Hono } from 'hono';

export type NodeEntryOptions = {
  readonly port?: number;
  readonly hostname?: string;
};

export type NodeEntry = {
  readonly server: Server;
  readonly start: () => Promise<void>;
  readonly close: () => Promise<void>;
};

export function createNodeEntry(honoApp: { readonly fetch: Hono['fetch'] }, options?: NodeEntryOptions): NodeEntry {
  const port = options?.port ?? 3000;
  const hostname = options?.hostname ?? '0.0.0.0';

  const server = createServer(async (req, res) => {
    const protocol = 'encrypted' in req.socket && req.socket.encrypted ? 'https' : 'http';
    const host = req.headers.host ?? 'localhost';
    const url = new URL(req.url ?? '/', `${protocol}://${host}`);

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);

    const request = new Request(url.toString(), {
      method: req.method,
      headers: Object.entries(req.headers).reduce(
        (acc, [key, value]) => {
          if (value) {
            acc[key] = Array.isArray(value) ? value.join(', ') : value;
          }
          return acc;
        },
        {} as Record<string, string>
      ),
      body: ['GET', 'HEAD'].includes(req.method ?? '') ? undefined : body,
    });

    const response = await honoApp.fetch(request);

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));

    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          res.write(value);
        }
        res.end();
      };

      pump().catch((err: unknown) => {
        console.error('[node-entry] Stream error:', err);
        res.end();
      });
    } else {
      res.end();
    }
  });

  return {
    server,
    start: () => {
      return new Promise<void>((resolve) => {
        server.listen(port, hostname, () => {
          console.log(`[node-preset] Server running at http://${hostname}:${port}`);
          resolve();
        });
      });
    },
    close: () => {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
