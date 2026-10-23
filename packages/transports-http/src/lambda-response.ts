type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[];
};

type LambdaResponseHeaders = {
  headers: Record<string, string>;
  cookies: string[];
};

type LambdaResponseBody = {
  body: string;
  isBase64Encoded: boolean;
};

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

function isBinaryContentType(contentType: string): boolean {
  const mimeType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";

  if (mimeType === "") {
    return false;
  }

  if (mimeType.startsWith("text/")) {
    return false;
  }

  if (
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("javascript") ||
    mimeType === "application/x-www-form-urlencoded"
  ) {
    return false;
  }

  return true;
}

function hasContentCoding(headers: Headers): boolean {
  const contentEncoding = headers.get("content-encoding")?.toLowerCase() ?? "";
  return contentEncoding !== "" && contentEncoding !== "identity";
}

function decodeUtf8Text(bytes: Uint8Array): string | undefined {
  try {
    return UTF8_DECODER.decode(bytes);
  } catch (error) {
    if (error instanceof TypeError) {
      return undefined;
    }
    throw error;
  }
}

async function toLambdaResponseBody(response: Response): Promise<LambdaResponseBody> {
  const bytes = Buffer.from(await response.arrayBuffer());
  const text =
    hasContentCoding(response.headers) ||
    isBinaryContentType(response.headers.get("content-type") ?? "")
      ? undefined
      : decodeUtf8Text(bytes);

  return text === undefined
    ? { body: bytes.toString("base64"), isBase64Encoded: true }
    : { body: text, isBase64Encoded: false };
}

function getSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (headers as HeadersWithSetCookie).getSetCookie;
  if (typeof getSetCookie === "function") {
    const cookies = getSetCookie.call(headers);
    if (cookies.length > 0) {
      return cookies;
    }
  }

  const cookies: string[] = [];
  headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      cookies.push(value);
    }
  });

  return cookies;
}

function toLambdaResponseHeaders(headers: Headers): LambdaResponseHeaders {
  const cookies = getSetCookieHeaders(headers);
  const responseHeaders = Object.fromEntries(
    [...headers].filter(([key]) => key.toLowerCase() !== "set-cookie"),
  );

  return { headers: responseHeaders, cookies };
}

/** Serializable buffered API Gateway result. Cookies use the selected payload format. */
export type LambdaProxyResponse = {
  statusCode: number;
  headers: Record<string, string>;
  cookies?: string[];
  multiValueHeaders?: Record<string, string[]>;
  body: string;
  isBase64Encoded: boolean;
};

/** Consume the complete body before the invocation can finish. Read failures propagate. */
export async function toLambdaProxyResponse(
  response: Response,
  payloadFormat: "1.0" | "2.0" = "2.0",
): Promise<LambdaProxyResponse> {
  const body = await toLambdaResponseBody(response);
  const { headers, cookies } = toLambdaResponseHeaders(response.headers);
  return {
    statusCode: response.status,
    headers,
    ...(cookies.length === 0
      ? {}
      : payloadFormat === "2.0"
        ? { cookies }
        : { multiValueHeaders: { "set-cookie": cookies } }),
    ...body,
  };
}
