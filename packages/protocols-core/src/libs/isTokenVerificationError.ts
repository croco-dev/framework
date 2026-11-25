const JOSE_TOKEN_ERROR_CODES = new Set([
  "ERR_JWT_CLAIM_VALIDATION_FAILED",
  "ERR_JWT_EXPIRED",
  "ERR_JWT_INVALID",
  "ERR_JWS_INVALID",
  "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
  "ERR_JOSE_ALG_NOT_ALLOWED",
]);

const CONNECTION_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

const JSON_WEB_TOKEN_REJECTION_MESSAGES = new Set([
  "jwt malformed",
  "invalid token",
  "invalid signature",
  "jwt signature is required",
  "invalid nbf value",
  "invalid exp value",
  "iat required when maxAge is specified",
]);

function isJsonWebTokenPayloadParseError(error: SyntaxError): boolean {
  // jsonwebtoken forwards the native SyntaxError from jws without a credential error code.
  // Require decoder frames so configuration and key lookup parsers can still fail as outages.
  const headline = `${error.name}: ${error.message}\n`;
  let stack: unknown;
  try {
    stack = error.stack;
  } catch {
    return false;
  }
  if (typeof stack !== "string" || !stack.startsWith(headline)) {
    return false;
  }

  const [parseFrame, payloadFrame = "", decoderFrame = ""] = stack
    .slice(headline.length)
    .split("\n", 3);
  return (
    parseFrame?.trim() === "at JSON.parse (<anonymous>)" &&
    /[/\\]jws[/\\]lib[/\\]verify-stream\.js:\d+:\d+\)?$/.test(payloadFrame) &&
    /[/\\]jsonwebtoken[/\\]decode\.js:\d+:\d+\)?$/.test(decoderFrame)
  );
}

/**
 * Identifies a credential rejection reported by a protocol guard's token verifier.
 * Native jsonwebtoken payload parse errors require the original decoder stack frames.
 */
export function isTokenVerificationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if ("code" in error && typeof error.code === "string") {
    if (error.code === "ERR_JOSE_NOT_SUPPORTED") {
      return (
        error.message === 'Unsupported "alg" value for a JSON Web Key Set' ||
        (error.message.startsWith('Extension Header Parameter "') &&
          error.message.endsWith('" is not recognized')) ||
        (error.message.startsWith("alg ") &&
          error.message.endsWith(" is not supported either by JOSE or your javascript runtime"))
      );
    }
    // jose attaches a cause when WebCrypto throws instead of returning a signature verdict.
    if (error.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" && Object.hasOwn(error, "cause")) {
      return false;
    }
    if (/^ERR_(JWT|JWS|JWE|JWK|JWKS|JOSE)_/.test(error.code)) {
      return JOSE_TOKEN_ERROR_CODES.has(error.code);
    }
  }

  if (hasConnectionError(error)) {
    return false;
  }

  if (error.name === "TokenExpiredError" || error.name === "NotBeforeError") {
    return true;
  }

  if (error.name === "JsonWebTokenError") {
    // jsonwebtoken uses this class for key lookup and verifier configuration errors as well.
    return (
      JSON_WEB_TOKEN_REJECTION_MESSAGES.has(error.message) ||
      /^jwt (audience|issuer|subject|jwtid|nonce) invalid\. expected: /.test(error.message)
    );
  }

  if (error instanceof SyntaxError) {
    return isJsonWebTokenPayloadParseError(error);
  }

  // ecdsa-sig-formatter throws this TypeError for an invalid JOSE signature width.
  if (
    error instanceof TypeError &&
    /^"ES(256|384|512)" signatures must be "\d+" bytes, saw "\d+"$/.test(error.message)
  ) {
    return true;
  }

  const name = error.name.toUpperCase();
  const message = error.message.toLowerCase();
  return (
    name.startsWith("ERR_JWT_") ||
    name.startsWith("ERR_JWS_") ||
    name.startsWith("ERR_JWE_") ||
    message.includes("token expired") ||
    message.includes("invalid token") ||
    message.includes("jwt expired") ||
    message.includes("token invalid")
  );
}

function hasConnectionError(error: Error): boolean {
  const seen = new Set<object>();
  let cause: unknown = error;
  while (typeof cause === "object" && cause !== null && !seen.has(cause)) {
    seen.add(cause);
    const code: unknown = Object.getOwnPropertyDescriptor(cause, "code")?.value;
    if (typeof code === "string" && CONNECTION_ERROR_CODES.has(code)) {
      return true;
    }
    cause = Object.getOwnPropertyDescriptor(cause, "cause")?.value;
  }
  return false;
}
