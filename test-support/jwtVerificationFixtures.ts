import { generateKeyPairSync } from "node:crypto";
import { createLocalJWKSet, createRemoteJWKSet, customFetch, errors, jwtVerify } from "jose";
import jwt from "jsonwebtoken";

const now = 1_700_000_000;
const signingKey = "test-only HMAC signing material for JWT verification";
const otherKey = "different test-only HMAC material for JWT verification";

export const testJwt = jwt.sign({ sub: "test-user", exp: now + 60 }, signingKey, {
  noTimestamp: true,
});
const expiredJwt = jwt.sign({ sub: "test-user", exp: now - 60 }, signingKey, {
  noTimestamp: true,
});
const wrongSignatureJwt = jwt.sign({ sub: "test-user", exp: now + 60 }, otherKey, {
  noTimestamp: true,
});
const unknownCriticalHeader = { alg: "HS256", crit: ["test-extension"], "test-extension": true };
const unsupportedHeaderJwt = jwt.sign({ sub: "test-user", exp: now + 60 }, signingKey, {
  header: unknownCriticalHeader,
  noTimestamp: true,
});
const invalidJsonJwt = jwt.sign("not JSON", signingKey, { header: { alg: "HS256", typ: "JWT" } });
const [jsonHeader, , jsonSignature] = invalidJsonJwt.split(".");
const [, knownPayload, knownSignature] = testJwt.split(".");
const unknownAlgorithmHeader = Buffer.from(
  JSON.stringify({ alg: "test-unknown", typ: "JWT" }),
).toString("base64url");
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const localJwtKeys = createLocalJWKSet({ keys: [publicKey.export({ format: "jwk" })] });
const [ecHeader, ecPayload] = jwt
  .sign({ sub: "test-user" }, privateKey, { algorithm: "ES256", noTimestamp: true })
  .split(".");
const { privateKey: rsaSigningKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const rs256Jwt = jwt.sign({ sub: "test-user" }, rsaSigningKey, {
  algorithm: "RS256",
  noTimestamp: true,
});

export const verifyJoseJwt = (token: string) =>
  jwtVerify(token, new TextEncoder().encode(signingKey), { currentDate: new Date(now * 1000) });

const verifyJsonWebToken = (token: string) =>
  jwt.verify(token, signingKey, { clockTimestamp: now });

const verifyWithFailedKeyFetch = (token: string, error: Error) =>
  jwtVerify(
    token,
    createRemoteJWKSet(new URL("https://example.test/jwks"), {
      [customFetch]: () => Promise.reject(error),
    }),
  );

export const rejectedJwtCases = [
  { name: "jose expired token", token: expiredJwt, verifier: verifyJoseJwt },
  { name: "jose invalid signature", token: wrongSignatureJwt, verifier: verifyJoseJwt },
  { name: "jose malformed token", token: "malformed", verifier: verifyJoseJwt },
  { name: "jose unknown critical header", token: unsupportedHeaderJwt, verifier: verifyJoseJwt },
  {
    name: "jose unknown signing algorithm",
    token: `${unknownAlgorithmHeader}.${knownPayload}.${knownSignature}`,
    verifier: verifyJoseJwt,
  },
  {
    name: "jose unknown signing algorithm with a healthy key set",
    token: `${unknownAlgorithmHeader}.${knownPayload}.${knownSignature}`,
    verifier: (token: string) => jwtVerify(token, localJwtKeys),
  },
  { name: "jsonwebtoken expired token", token: expiredJwt, verifier: verifyJsonWebToken },
  {
    name: "jsonwebtoken invalid signature",
    token: wrongSignatureJwt,
    verifier: verifyJsonWebToken,
  },
  { name: "jsonwebtoken malformed token", token: "malformed", verifier: verifyJsonWebToken },
  {
    name: "jsonwebtoken malformed payload JSON",
    token: invalidJsonJwt,
    verifier: verifyJsonWebToken,
  },
  {
    name: "jsonwebtoken malformed payload encoding",
    token: `${jsonHeader}.A.${jsonSignature}`,
    verifier: verifyJsonWebToken,
  },
  {
    name: "jsonwebtoken wrong-width ECDSA signature",
    token: `${ecHeader}.${ecPayload}.AA`,
    verifier: (token: string) => jwt.verify(token, publicKey),
  },
];

export const unavailableJwtVerifierCases = [
  {
    name: "jose JWKS timeout",
    verifier: (token: string) =>
      jwtVerify(token, () => {
        throw new errors.JWKSTimeout();
      }),
  },
  {
    name: "jose unwrapped JWKS connection error",
    verifier: (token: string) =>
      verifyWithFailedKeyFetch(
        token,
        Object.assign(new Error("invalid token key lookup failed"), { code: "ECONNRESET" }),
      ),
  },
  {
    name: "jose wrapped JWKS connection error",
    verifier: (token: string) =>
      verifyWithFailedKeyFetch(
        token,
        new Error("invalid token key lookup failed", {
          cause: Object.assign(new Error("Connection reset"), { code: "ECONNRESET" }),
        }),
      ),
  },
  {
    name: "jose JWKS connection timeout wrapped by fetch and the verifier",
    verifier: (token: string) =>
      verifyWithFailedKeyFetch(
        token,
        new Error("invalid token key lookup failed", {
          cause: new TypeError("fetch failed", {
            cause: Object.assign(new Error("Connect timeout"), { code: "UND_ERR_CONNECT_TIMEOUT" }),
          }),
        }),
      ),
  },
  {
    name: "jose unsupported verifier configuration",
    verifier: (token: string) =>
      jwtVerify(token, () => {
        throw new errors.JOSENotSupported("Invalid or unsupported key format");
      }),
  },
  {
    name: "jose signature check with an unusable verification key",
    verifier: () => {
      throw new errors.JWSSignatureVerificationFailed(undefined, {
        cause: new DOMException("Cannot use the verification key", "InvalidAccessError"),
      });
    },
  },
  {
    name: "jose signature check with a failed crypto operation",
    verifier: () => {
      throw new errors.JWSSignatureVerificationFailed(undefined, {
        cause: new DOMException("Verification operation failed", "OperationError"),
      });
    },
  },
  {
    name: "jose encrypted-token verifier with an invalid configured key",
    verifier: () => {
      throw new errors.JWEInvalid("Invalid Content Encryption Key length");
    },
  },
  {
    name: "jose encrypted-token verifier with an opaque decryption failure",
    verifier: () => {
      throw new errors.JWEDecryptionFailed();
    },
  },
  {
    name: "verifier configuration JSON parse failure",
    token: invalidJsonJwt,
    verifier: () => JSON.parse("not JSON"),
  },
  {
    name: "verifier failure with structured stack frames",
    verifier: () => {
      throw Object.defineProperty(new SyntaxError("Invalid verifier configuration"), "stack", {
        value: [],
      });
    },
  },
  {
    name: "verifier failure with an unavailable stack formatter",
    verifier: () => {
      throw Object.defineProperty(new SyntaxError("Invalid verifier configuration"), "stack", {
        get() {
          throw new TypeError("Could not format the stack");
        },
      });
    },
  },
  {
    name: "jsonwebtoken key lookup failure",
    verifier: (token: string) =>
      new Promise((resolve, reject) => {
        jwt.verify(
          token,
          (_header, callback) => callback(new Error("ECONNRESET: invalid token key lookup failed")),
          (error, decoded) => {
            if (error) {
              reject(error);
            } else {
              resolve(decoded);
            }
          },
        );
      }),
  },
  {
    name: "jsonwebtoken malformed configured public key",
    token: rs256Jwt,
    verifier: (token: string) =>
      jwt.verify(token, "-----BEGIN PUBLIC KEY-----\nnot a key\n-----END PUBLIC KEY-----"),
  },
];
