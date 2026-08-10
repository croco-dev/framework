import { definePrototypeContract, parameter } from "./prototype";

const inheritedInputContract = definePrototypeContract<string | number>();

class ContractBoundBaseController {
  handle(@parameter(inheritedInputContract) value: string | number): void {
    void value;
  }
}

// TypeScript 6 intentionally compiles this unsafe narrowing because class method
// parameters are bivariant. The inherited decorator is not re-applied here.
class UndecoratedNarrowOverrideController extends ContractBoundBaseController {
  override handle(value: string): void {
    void value;
  }
}

void UndecoratedNarrowOverrideController;
