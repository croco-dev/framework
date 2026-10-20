import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

export async function createS3Fixture() {
  const objects = new Map<string, { body: Buffer; headers: IncomingMessage["headers"] }>();
  const uploads = new Map<
    string,
    { key: string; parts: Map<number, Buffer>; headers: IncomingMessage["headers"] }
  >();
  const requests: {
    method: string;
    key: string;
    headers: IncomingMessage["headers"];
    query: URLSearchParams;
  }[] = [];
  let sequence = 0;
  let failPart = false;
  let failCleanup = false;
  let stallCleanup = false;
  let forbidden = false;
  let onPart: (() => void) | undefined;
  const error = (response: ServerResponse, status: number, code: string) => {
    response.writeHead(status, { "content-type": "application/xml" });
    response.end(`<Error><Code>${code}</Code><Message>upstream-sensitive-text</Message></Error>`);
  };
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", "http://fixture");
      const key = decodeURIComponent(url.pathname);
      const query = url.searchParams;
      requests.push({ method: request.method ?? "", key, headers: request.headers, query });
      if (forbidden) {
        error(response, 403, "AccessDenied");
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks);
      const id = query.get("uploadId");
      if (request.method === "POST" && query.has("uploads")) {
        const uploadId = `upload-${++sequence}`;
        uploads.set(uploadId, { key, headers: request.headers, parts: new Map() });
        response.end(
          `<InitiateMultipartUploadResult><Bucket>bucket</Bucket><Key>${key}</Key><UploadId>${uploadId}</UploadId></InitiateMultipartUploadResult>`,
        );
      } else if (id) {
        const upload = uploads.get(id);
        if (!upload) {
          error(response, 404, "NoSuchUpload");
          return;
        }
        if (request.method === "PUT") {
          onPart?.();
          if (failPart) {
            error(response, 400, "InvalidRequest");
            return;
          }
          upload.parts.set(Number(query.get("partNumber")), body);
          response.writeHead(200, { etag: `"part-${query.get("partNumber")}"` });
          response.end();
        } else if (request.method === "DELETE") {
          if (stallCleanup) return;
          if (failCleanup) {
            error(response, 403, "AccessDenied");
            return;
          }
          uploads.delete(id);
          response.writeHead(204);
          response.end();
        } else if (request.method === "POST") {
          if (request.headers["if-none-match"] === "*" && objects.has(key)) {
            error(response, 412, "PreconditionFailed");
            return;
          }
          const expected = [...upload.parts.keys()].sort((a, b) => a - b);
          if (!expected.every((n) => body.includes(`<PartNumber>${n}</PartNumber>`))) {
            error(response, 400, "InvalidPart");
            return;
          }
          objects.set(key, {
            body: Buffer.concat(expected.map((n) => upload.parts.get(n) ?? Buffer.alloc(0))),
            headers: upload.headers,
          });
          uploads.delete(id);
          response.end(
            '<CompleteMultipartUploadResult><ETag>"multipart-etag-2"</ETag></CompleteMultipartUploadResult>',
          );
        }
      } else if (request.method === "PUT") {
        if (
          (request.headers["if-none-match"] === "*" && objects.has(key)) ||
          (request.headers["if-match"] && request.headers["if-match"] !== '"object-etag"')
        ) {
          error(response, 412, "PreconditionFailed");
          return;
        }
        objects.set(key, { body, headers: request.headers });
        response.writeHead(200, { etag: '"object-etag"' });
        response.end();
      } else if (request.method === "DELETE") {
        objects.delete(key);
        response.writeHead(204);
        response.end();
      } else {
        const object = objects.get(key);
        if (!object) {
          error(response, 404, "NoSuchKey");
          return;
        }
        const headers: Record<string, string> = {
          "content-length": String(object.body.length),
          "content-type": String(object.headers["content-type"] ?? "application/octet-stream"),
          "last-modified": "Wed, 14 Oct 2026 02:00:00 GMT",
          etag: '"object-etag"',
        };
        for (const [name, value] of Object.entries(object.headers)) {
          if (name.startsWith("x-amz-meta-") || name === "cache-control")
            headers[name] = String(value);
        }
        let result = object.body;
        const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
        if (range) {
          const start = Number(range[1]);
          const end = range[2] ? Number(range[2]) : result.length - 1;
          if (start >= result.length) {
            error(response, 416, "InvalidRange");
            return;
          }
          result = result.subarray(start, end + 1);
          headers["content-length"] = String(result.length);
          headers["content-range"] =
            `bytes ${start}-${Math.min(end, object.body.length - 1)}/${object.body.length}`;
        }
        response.writeHead(range ? 206 : 200, headers);
        response.end(request.method === "HEAD" ? undefined : result);
      }
    })().catch(() => {
      if (!response.destroyed) response.destroy();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture address missing");
  return {
    endpoint: `http://127.0.0.1:${address.port}`,
    objects,
    uploads,
    requests,
    set failPart(value: boolean) {
      failPart = value;
    },
    set stallCleanup(value: boolean) {
      stallCleanup = value;
    },
    set failCleanup(value: boolean) {
      failCleanup = value;
    },
    set forbidden(value: boolean) {
      forbidden = value;
    },
    set onPart(value: (() => void) | undefined) {
      onPart = value;
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    },
  };
}
