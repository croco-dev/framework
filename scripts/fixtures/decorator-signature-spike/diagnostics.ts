import { contractMethod, contractParameter } from "./prototype";

class RepresentativeDiagnostics {
  @contractMethod<string>()
  invalidReturn(): number {
    return 1;
  }

  invalidParameter(@contractParameter<string>() value: number): void {
    void value;
  }

  @contractMethod<string>()
  anyReturn(): any {
    return "value";
  }
}

void RepresentativeDiagnostics;
