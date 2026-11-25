import { errors, jwtVerify } from "jose";
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

export const verifyJoseJwt = (token: string) =>
  jwtVerify(token, new TextEncoder().encode(signingKey), { currentDate: new Date(now * 1000) });

const verifyJsonWebToken = (token: string) =>
  jwt.verify(token, signingKey, { clockTimestamp: now });

export const rejectedJwtCases = [
  { name: "jose expired token", token: expiredJwt, verifier: verifyJoseJwt },
  { name: "jose invalid signature", token: wrongSignatureJwt, verifier: verifyJoseJwt },
  { name: "jose malformed token", token: "malformed", verifier: verifyJoseJwt },
  { name: "jsonwebtoken expired token", token: expiredJwt, verifier: verifyJsonWebToken },
  {
    name: "jsonwebtoken invalid signature",
    token: wrongSignatureJwt,
    verifier: verifyJsonWebToken,
  },
  { name: "jsonwebtoken malformed token", token: "malformed", verifier: verifyJsonWebToken },
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
