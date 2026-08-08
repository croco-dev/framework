import { ProblemCategory } from "@croco/problems-core";
import { StorageProblem } from "./StorageProblem";

export const MAX_SIGNED_URL_EXPIRY_SECONDS = 604_800;

const INVALID_SIGNED_URL_EXPIRY_MESSAGE = `Signed URL expiry must be a positive safe integer no greater than ${MAX_SIGNED_URL_EXPIRY_SECONDS} seconds`;

export class InvalidSignedUrlExpiryProblem extends StorageProblem {
  readonly code = "STORAGE_INVALID_SIGNED_URL_EXPIRY";
  readonly category = ProblemCategory.BadRequest;

  constructor() {
    super(undefined, undefined, INVALID_SIGNED_URL_EXPIRY_MESSAGE);
  }
}
