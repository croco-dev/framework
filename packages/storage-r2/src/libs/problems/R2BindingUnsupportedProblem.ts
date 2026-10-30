import { ProblemCategory } from "@croco/problems-core";
import { StorageProblem } from "@croco/storage-core";

export class R2BindingUnsupportedProblem extends StorageProblem {
  readonly code = "STORAGE_R2_BINDING_UNSUPPORTED";

  constructor(capability: "signed-url" | "object-acl" | "public-url") {
    super(
      "STORAGE_R2_BINDING_UNSUPPORTED",
      ProblemCategory.NotImplemented,
      `R2 binding does not provide '${capability}'`,
      { extensions: { capability } },
    );
  }
}
