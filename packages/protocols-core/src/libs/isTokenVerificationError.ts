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

/** Identifies a credential rejection reported by a protocol guard's token verifier. */
export function isTokenVerificationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (
    "code" in error &&
    typeof error.code === "string" &&
    /^ERR_(JWT|JWS|JWE|JWK|JWKS|JOSE)_/.test(error.code)
  ) {
    return JOSE_TOKEN_ERROR_CODES.has(error.code);
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
