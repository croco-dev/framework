import { ProblemCategory } from "@croco/problems-core";
import { StorageProblem } from "./StorageProblem";

export class InvalidNodeStorageBodyProblem extends StorageProblem {
  readonly code = "STORAGE_INVALID_NODE_BODY";
  readonly category = ProblemCategory.BadRequest;

  constructor(chunkType: string) {
    super(undefined, undefined, `Node readable emitted unsupported ${chunkType} data`);
  }
}
