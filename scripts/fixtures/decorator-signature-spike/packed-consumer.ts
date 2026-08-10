import { definePrototypeContract, parameter, route } from "@croco/decorator-signature-prototype";

const stringMethodContract = definePrototypeContract<string>();
const stringParameterContract = definePrototypeContract<string>();

class PackedConsumer {
  @route(stringMethodContract)
  valid(@parameter(stringParameterContract) value: string): Promise<string> {
    return Promise.resolve(value);
  }

  @route("/loose")
  loose(@parameter("value") value: number): number {
    return value;
  }

  // @ts-expect-error packed declarations preserve strict method return validation.
  @route(stringMethodContract)
  invalidReturn(): number {
    return 1;
  }

  invalidParameter(
    // @ts-expect-error packed declarations preserve strict parameter validation.
    @parameter(stringParameterContract) value: number,
  ): void {
    void value;
  }
}

void PackedConsumer;
