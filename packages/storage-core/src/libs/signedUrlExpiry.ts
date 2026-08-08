import {
  InvalidSignedUrlExpiryProblem,
  MAX_SIGNED_URL_EXPIRY_SECONDS,
} from "./problems/InvalidSignedUrlExpiryProblem";

/**
 * Validates a signed-URL lifetime expressed in seconds.
 *
 * The seven-day upper bound is the narrowest limit shared by Croco's storage providers.
 *
 * @throws {InvalidSignedUrlExpiryProblem} When the expiry is not a positive safe integer or exceeds the provider limit.
 */
export function validateSignedUrlExpiry(expiresIn: number): number {
  if (
    !Number.isSafeInteger(expiresIn) ||
    expiresIn <= 0 ||
    expiresIn > MAX_SIGNED_URL_EXPIRY_SECONDS
  ) {
    throw new InvalidSignedUrlExpiryProblem();
  }

  return expiresIn;
}
