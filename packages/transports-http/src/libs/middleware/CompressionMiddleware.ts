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

  return async (ctx, next): Promise<void> => {
    await next();

    if (ctx.res.status >= 300) return;

    const acceptEncoding = ctx.header("accept-encoding") ?? "";
    const contentType = ctx.header("content-type") ?? "";

    if (!shouldCompress(contentType)) return;

    const encoding = selectEncoding(acceptEncoding, encodings);
    if (!encoding) return;

    const body = await getResponseBody(ctx);
    if (!body || body.length < threshold) return;

    const compressed = await compressBody(body, encoding);
    if (!compressed) return;

    ctx.raw.header("Content-Encoding", encoding);
    ctx.raw.header("Vary", "Accept-Encoding");

    ctx.res.headers["content-encoding"] = encoding;
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

async function getResponseBody(ctx: { raw: { res: { body: unknown } } }): Promise<Buffer | null> {
  const body = ctx.raw.res.body;

  if (body === null || body === undefined) {
    return null;
  }

  if (body instanceof Buffer) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === "string") {
    return Buffer.from(body, "utf-8");
  }

  return null;
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
