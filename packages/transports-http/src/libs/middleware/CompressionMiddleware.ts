import type { MiddlewareFunction } from "../types";

export type CompressionOptions = {
  threshold?: number;
  encodings?: CompressionEncoding[];
};

export type CompressionEncoding = "gzip" | "br" | "deflate";

const DEFAULT_THRESHOLD = 1024;
const DEFAULT_ENCODINGS: CompressionEncoding[] = ["br", "gzip"];

const COMPRESSION_ALGORITHMS: CompressionEncoding[] = ["br", "gzip", "deflate"];

/**
 * 응답 크기와 Accept-Encoding 헤더를 기준으로 압축을 적용하는 미들웨어입니다.
 */
export const compressionMiddleware = (options: CompressionOptions = {}): MiddlewareFunction => {
  const { threshold = DEFAULT_THRESHOLD, encodings = DEFAULT_ENCODINGS } = options;

  return async (ctx, next): Promise<Response | void> => {
    const response = await next();

    if (!(response instanceof Response)) return;
    if (response.status >= 300) return response;
    if (response.headers.has("Content-Encoding")) return response;

    const acceptEncoding = ctx.header("accept-encoding") ?? "";
    const contentType = response.headers.get("Content-Type") ?? "";

    if (!shouldCompress(contentType)) return response;

    const encoding = selectEncoding(acceptEncoding, encodings);
    if (!encoding) return response;

    const body = getResponseBody(ctx);
    if (!body || body.length < threshold) return response;

    const compressed = await compressBody(body, encoding);
    if (!compressed) return response;

    const headers = new Headers(response.headers);
    headers.set("Content-Encoding", encoding);
    setVaryHeader(headers, "Accept-Encoding");
    headers.delete("Content-Length");

    ctx.res.status = response.status;
    ctx.res.headers["content-encoding"] = encoding;
    ctx.res.headers.vary = headers.get("Vary") ?? "Accept-Encoding";
    delete ctx.res.headers["content-length"];

    return new Response(toResponseBody(compressed), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
};

function shouldCompress(contentType: string): boolean {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  const compressibleTypes = [
    "text/",
    "application/json",
    "application/javascript",
    "application/xml",
    "application/rss+xml",
    "application/atom+xml",
    "application/xhtml+xml",
    "image/svg+xml",
  ];

  return compressibleTypes.some((t) => type.startsWith(t));
}

function selectEncoding(
  acceptEncoding: string,
  preferred: CompressionEncoding[],
): CompressionEncoding | null {
  const accepted = acceptEncoding
    .toLowerCase()
    .split(",")
    .map((e) => e.trim().split(";")[0].trim())
    .filter((e): e is CompressionEncoding =>
      COMPRESSION_ALGORITHMS.includes(e as CompressionEncoding),
    );

  for (const encoding of preferred) {
    if (accepted.includes(encoding)) {
      return encoding;
    }
  }

  return accepted[0] ?? null;
}

function getResponseBody(ctx: Parameters<MiddlewareFunction>[0]): Buffer | null {
  const bufferedBody = readBufferedResponseBody(ctx);
  return bufferedBody ? Buffer.from(bufferedBody) : null;
}

function setVaryHeader(headers: Headers, value: string): void {
  const currentValue = headers.get("Vary");

  if (!currentValue) {
    headers.set("Vary", value);
    return;
  }

  const existingValues = currentValue.split(",").map((entry) => entry.trim().toLowerCase());
  if (existingValues.includes("*") || existingValues.includes(value.toLowerCase())) {
    return;
  }

  headers.set("Vary", `${currentValue}, ${value}`);
}

function toResponseBody(body: Buffer): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(body.byteLength);
  copy.set(body);
  return copy;
}

function readBufferedResponseBody(ctx: Parameters<MiddlewareFunction>[0]): Uint8Array | null {
  if (!("getBufferedResponseBody" in ctx) || typeof ctx.getBufferedResponseBody !== "function") {
    return null;
  }

  const body = ctx.getBufferedResponseBody();
  return body instanceof Uint8Array ? body : null;
}

async function compressBody(body: Buffer, encoding: CompressionEncoding): Promise<Buffer | null> {
  const zlib = await import("node:zlib");

  try {
    switch (encoding) {
      case "gzip": {
        return zlib.gzipSync(body, { level: zlib.constants.Z_DEFAULT_COMPRESSION });
      }
      case "br": {
        return zlib.brotliCompressSync(body, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
            [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
          },
        });
      }
      case "deflate": {
        return zlib.deflateSync(body, { level: zlib.constants.Z_DEFAULT_COMPRESSION });
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
