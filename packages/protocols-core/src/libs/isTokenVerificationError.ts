const JOSE_TOKEN_ERROR_CODES = new Set([
  "ERR_JWT_CLAIM_VALIDATION_FAILED",
  "ERR_JWT_EXPIRED",
  "ERR_JWT_INVALID",
  "ERR_JWS_INVALID",
  "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
  "ERR_JWE_DECRYPTION_FAILED",
  "ERR_JWE_INVALID",
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
]);

const JSON_WEB_TOKEN_REJECTION_MESSAGES = new Set([
  "jwt malformed",
  "invalid token",
  "invalid signature",
  "invalid algorithm",
  "jwt signature is required",
  'please specify "none" in "algorithms" to verify unsigned tokens',
  "invalid nbf value",
  "invalid exp value",
  "iat required when maxAge is specified",
]);

function decodeBase64Url(value: string): string {
  return atob(value.replace(/-/g, "+").replace(/_/g, "/"));
}

function matchesJwtPayloadParseError(token: string, verifierError: SyntaxError): boolean {
  const [, encodedHeader, encodedPayload] = /^([\w-]+)\.([\w-]+)\.[\w-]*$/.exec(token) ?? [];
  if (!encodedHeader || !encodedPayload) {
    return false;
  }

  let header: unknown;
  try {
    header = JSON.parse(decodeBase64Url(encodedHeader));
  } catch {
    return false;
  }
  if (typeof header !== "object" || header === null || !("typ" in header) || header.typ !== "JWT") {
    return false;
  }

  // jsonwebtoken forwards the native payload parse error without a JWT error code.
  try {
    const bytes = Uint8Array.from(decodeBase64Url(encodedPayload), (value) => value.charCodeAt(0));
    JSON.parse(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes));
  } catch (error) {
    return error instanceof SyntaxError && error.message === verifierError.message;
  }
  return false;
}

/** Identifies a credential rejection reported by a protocol guard's token verifier. */
export function isTokenVerificationError(error: unknown, token: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if ("code" in error && typeof error.code === "string") {
    if (error.code === "ERR_JOSE_NOT_SUPPORTED") {
      return (
        error.message.startsWith('Extension Header Parameter "') &&
        error.message.endsWith('" is not recognized')
      );
    }
    if (/^ERR_(JWT|JWS|JWE|JWK|JWKS|JOSE)_/.test(error.code)) {
      return JOSE_TOKEN_ERROR_CODES.has(error.code);
    }
    if (CONNECTION_ERROR_CODES.has(error.code)) {
      return false;
    }
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
    return matchesJwtPayloadParseError(token, error);
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
