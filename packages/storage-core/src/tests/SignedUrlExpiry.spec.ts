import { describe, expect, it } from "vitest";
import {
  InvalidSignedUrlExpiryProblem,
  MAX_SIGNED_URL_EXPIRY_SECONDS,
  validateSignedUrlExpiry,
} from "../index";

const INVALID_SIGNED_URL_EXPIRY_MESSAGE = `Signed URL expiry must be a positive safe integer no greater than ${MAX_SIGNED_URL_EXPIRY_SECONDS} seconds`;

const INVALID_EXPIRY_CASES = [
  { label: "negative", expiresIn: -1 },
  { label: "zero", expiresIn: 0 },
  { label: "fractional", expiresIn: 1.5 },
  { label: "NaN", expiresIn: Number.NaN },
  { label: "positive infinity", expiresIn: Number.POSITIVE_INFINITY },
  { label: "negative infinity", expiresIn: Number.NEGATIVE_INFINITY },
  { label: "above provider limit", expiresIn: MAX_SIGNED_URL_EXPIRY_SECONDS + 1 },
  { label: "unsafe integer", expiresIn: Number.MAX_SAFE_INTEGER + 1 },
] as const;

describe("signed URL expiry contract", () => {
  it.each(INVALID_EXPIRY_CASES)(
    "rejects $label expiry with the stable Problem contract",
    ({ expiresIn }) => {
      expect(() => validateSignedUrlExpiry(expiresIn)).toThrow(InvalidSignedUrlExpiryProblem);
      expect(() => validateSignedUrlExpiry(expiresIn)).toThrow(INVALID_SIGNED_URL_EXPIRY_MESSAGE);

      try {
        validateSignedUrlExpiry(expiresIn);
      } catch (error) {
        expect(error).toMatchObject({
          code: "STORAGE_INVALID_SIGNED_URL_EXPIRY",
          status: 400,
        });
      }
    },
  );

  it.each([1, MAX_SIGNED_URL_EXPIRY_SECONDS])(
    "preserves valid expiry %s as seconds",
    (expiresIn) => {
      expect(validateSignedUrlExpiry(expiresIn)).toBe(expiresIn);
    },
  );
});
