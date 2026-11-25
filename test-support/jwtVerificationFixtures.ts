import { generateKeyPairSync } from "node:crypto";
import { createRemoteJWKSet, customFetch, errors, jwtVerify } from "jose";
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
const [ecHeader, ecPayload] = jwt
  .sign({ sub: "test-user" }, privateKey, { algorithm: "ES256", noTimestamp: true })
  .split(".");

export const verifyJoseJwt = (token: string) =>
  jwtVerify(token, new TextEncoder().encode(signingKey), { currentDate: new Date(now * 1000) });

const verifyJsonWebToken = (token: string) =>
  jwt.verify(token, signingKey, { clockTimestamp: now });

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
      jwtVerify(
        token,
        createRemoteJWKSet(new URL("https://example.test/jwks"), {
          [customFetch]: () =>
            Promise.reject(
              Object.assign(new Error("invalid token key lookup failed"), {
                code: "ECONNRESET",
              }),
            ),
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
    name: "verifier configuration JSON parse failure",
    token: invalidJsonJwt,
    verifier: () => JSON.parse("not JSON"),
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
];
