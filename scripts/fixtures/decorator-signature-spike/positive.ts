import { z } from "zod";

import { contractMethod, contractParameter } from "./prototype";

const userIdSchema = z.string().brand<"UserId">();
const accountIdSchema = z.number().brand<"AccountId">();
const coercedSchema = z.coerce.number();
const transformedSchema = z.string().transform((value) => value.length);
const preprocessedSchema = z.preprocess((value) => String(value), z.string());
const defaultedSchema = z.string().default("default");
const optionalSchema = z.string().optional();
const nullableSchema = z.string().nullable();
const unionSchema = z.union([z.string(), z.number()]);
const anySchema = z.any();
const unknownSchema = z.unknown();
const neverSchema = z.never();

const methodObserver: MethodDecorator = () => undefined;
const parameterObserver: ParameterDecorator = () => undefined;

class PositiveController {
  @contractMethod<string>()
  sync(): string {
    return "ok";
  }

  @contractMethod<string>()
  async async(): Promise<string> {
    return "ok";
  }

  @contractMethod<string>()
  brandedReturn(): z.input<typeof userIdSchema> {
    return "user_1";
  }

  @contractMethod<z.input<typeof accountIdSchema>>()
  brandedNumberReturn(): number {
    return 1;
  }

  @contractMethod<z.input<typeof transformedSchema>>()
  responseTransformInput(): string {
    return "before-transform";
  }

  @contractMethod<z.input<typeof defaultedSchema>>()
  responseDefaultInput(): string | undefined {
    return undefined;
  }

  @contractMethod<z.input<typeof preprocessedSchema>>()
  responsePreprocessInput(): unknown {
    return { convertedAtRuntime: true };
  }

  @contractMethod<string | undefined>()
  optionalReturn(): undefined {
    return undefined;
  }

  @contractMethod<string | null>()
  nullableReturn(): null {
    return null;
  }

  @contractMethod<string | number>()
  unionReturn(): string {
    return "narrower-than-contract";
  }

  @contractMethod<unknown>()
  unknownReturn(): unknown {
    return Symbol("accepted-by-unknown-schema");
  }

  @contractMethod<z.input<typeof anySchema>>()
  unconstrainedSchemaReturn(): unknown {
    return Symbol("accepted-by-any-schema-without-an-any-annotation");
  }

  @methodObserver
  @contractMethod<string>()
  strictDecoratorAppliedFirst(): string {
    return "ok";
  }

  @contractMethod<string>()
  @methodObserver
  strictDecoratorAppliedLast(): string {
    return "ok";
  }

  parameters(
    @contractParameter<z.output<typeof userIdSchema>>() brandedAsString: string,
    @contractParameter<z.output<typeof userIdSchema>>() brandedExactly: z.output<
      typeof userIdSchema
    >,
    @contractParameter<z.output<typeof accountIdSchema>>() brandedNumberAsNumber: number,
    @contractParameter<z.output<typeof coercedSchema>>() coerced: number,
    @contractParameter<z.output<typeof transformedSchema>>() transformed: number,
    @contractParameter<z.output<typeof preprocessedSchema>>() preprocessed: string,
    @contractParameter<z.output<typeof defaultedSchema>>() defaulted: string,
    @contractParameter<z.output<typeof optionalSchema>>() optional: string | undefined,
    @contractParameter<z.output<typeof nullableSchema>>() nullable: string | null,
    @contractParameter<z.output<typeof unionSchema>>() union: string | number | null,
    @contractParameter<z.output<typeof anySchema>>() anyOutput: unknown,
    @contractParameter<z.output<typeof unknownSchema>>() unknownOutput: unknown,
    @contractParameter<z.output<typeof neverSchema>>() neverOutput: unknown,
    @parameterObserver @contractParameter<string>() decoratedFirst: string,
    @contractParameter<string>() @parameterObserver decoratedLast: string,
  ): void {
    void [
      brandedAsString,
      brandedExactly,
      brandedNumberAsNumber,
      coerced,
      transformed,
      preprocessed,
      defaulted,
      optional,
      nullable,
      union,
      anyOutput,
      unknownOutput,
      neverOutput,
      decoratedFirst,
      decoratedLast,
    ];
  }
}

class PositiveBaseController {
  @contractMethod<string>()
  value(): string {
    return "base";
  }
}

class PositiveOverrideController extends PositiveBaseController {
  @contractMethod<string>()
  override value(): "override" {
    return "override";
  }
}

class PositiveInheritedController extends PositiveBaseController {
  override value(): "inherited" {
    return "inherited";
  }
}

void PositiveController;
void PositiveInheritedController;
void PositiveOverrideController;
