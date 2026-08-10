import { z } from "zod";

import { contractMethod, contractParameter } from "./prototype";

const userIdSchema = z.string().brand<"UserId">();
const accountIdSchema = z.number().brand<"AccountId">();
const otherIdSchema = z.string().brand<"OtherId">();
const coercedSchema = z.coerce.number();
const transformedSchema = z.string().transform((value) => value.length);
const preprocessedSchema = z.preprocess((value) => String(value), z.string());
const defaultedSchema = z.string().default("default");
const optionalSchema = z.string().optional();
const nullableSchema = z.string().nullable();
const unionSchema = z.union([z.string(), z.number()]);
const anySchema = z.any();

class InvalidMethodController {
  // @ts-expect-error number is not accepted by a string handler-return slot.
  @contractMethod<string>()
  incompatibleSync(): number {
    return 1;
  }

  // @ts-expect-error Promise<number> is not accepted by a string handler-return slot.
  @contractMethod<string>()
  async incompatibleAsync(): Promise<number> {
    return 1;
  }

  // @ts-expect-error the complete annotated union must fit the handler-return slot.
  @contractMethod<string>()
  incompatibleUnion(): string | number {
    return "value";
  }

  // @ts-expect-error any cannot disable contract-bound method validation.
  @contractMethod<string>()
  anyEscape(): any {
    return "value";
  }

  // @ts-expect-error unknown is not accepted by a narrower handler-return slot.
  @contractMethod<string>()
  unknownEscape(): unknown {
    return "value";
  }

  // @ts-expect-error never cannot vacuously satisfy a handler-return slot.
  @contractMethod<string>()
  neverEscape(): never {
    throw new Error("fixture only");
  }

  // @ts-expect-error void hides the value required by the handler-return slot.
  @contractMethod<unknown>()
  voidEscape(): void {}

  // @ts-expect-error generic methods do not expose a stable decorated return annotation.
  @contractMethod<string>()
  generic<Value extends string>(value: Value): Value {
    return value;
  }

  overloaded(value: string): string;
  overloaded(value: number): number;
  // @ts-expect-error overloaded implementations do not expose the decorated annotation.
  @contractMethod<string>()
  overloaded(value: string | number): string | number {
    return value;
  }

  // @ts-expect-error strict contract methods must be public instance methods.
  @contractMethod<string>()
  protected protectedMethod(): string {
    return "value";
  }

  // @ts-expect-error strict contract methods must be public instance methods.
  @contractMethod<string>()
  private privateMethod(): string {
    return "value";
  }

  // @ts-expect-error static methods do not participate in controller instance metadata.
  @contractMethod<string>()
  static staticMethod(): string {
    return "value";
  }
}

class InvalidParameterController {
  invalidBrand(
    // @ts-expect-error UserId cannot be delivered to an unrelated brand.
    @contractParameter<z.output<typeof userIdSchema>>() value: z.output<typeof otherIdSchema>,
  ): void {
    void value;
  }

  invalidNumberBrand(
    // @ts-expect-error a branded number cannot be delivered to string.
    @contractParameter<z.output<typeof accountIdSchema>>() value: string,
  ): void {
    void value;
  }

  invalidTransform(
    // @ts-expect-error transformed number output cannot be delivered to string.
    @contractParameter<z.output<typeof transformedSchema>>() value: string,
  ): void {
    void value;
  }

  invalidCoercion(
    // @ts-expect-error coerced number output cannot be delivered to string.
    @contractParameter<z.output<typeof coercedSchema>>() value: string,
  ): void {
    void value;
  }

  invalidPreprocess(
    // @ts-expect-error preprocessed string output cannot be delivered to number.
    @contractParameter<z.output<typeof preprocessedSchema>>() value: number,
  ): void {
    void value;
  }

  invalidDefault(
    // @ts-expect-error a defaulted string output cannot be delivered to number.
    @contractParameter<z.output<typeof defaultedSchema>>() value: number,
  ): void {
    void value;
  }

  invalidOptional(
    // @ts-expect-error optional output includes undefined.
    @contractParameter<z.output<typeof optionalSchema>>() value: string,
  ): void {
    void value;
  }

  invalidNullable(
    // @ts-expect-error nullable output includes null.
    @contractParameter<z.output<typeof nullableSchema>>() value: string,
  ): void {
    void value;
  }

  invalidUnion(
    // @ts-expect-error the complete parsed union must fit the parameter annotation.
    @contractParameter<z.output<typeof unionSchema>>() value: string,
  ): void {
    void value;
  }

  invalidAnyAnnotation(
    // @ts-expect-error annotation-side any cannot disable strict validation.
    @contractParameter<number>() value: any,
  ): void {
    void value;
  }

  invalidAnyOutput(
    // @ts-expect-error unconstrained output may only be delivered to unknown.
    @contractParameter<z.output<typeof anySchema>>() value: string,
  ): void {
    void value;
  }

  invalidNever(
    // @ts-expect-error a parsed number cannot be delivered to never.
    @contractParameter<number>() value: never,
  ): void {
    void value;
  }

  invalidGeneric<Value extends number>(
    // @ts-expect-error a generic slot may be instantiated with a narrower subtype.
    @contractParameter<number>() value: Value,
  ): void {
    void value;
  }

  overloaded(value: number): void;
  overloaded(value: string): void;
  overloaded(
    // @ts-expect-error overloaded implementations hide the decorated annotation.
    @contractParameter<number>() value: number | string,
  ): void {
    void value;
  }

  protected invalidProtected(
    // @ts-expect-error strict contract parameters must belong to public instance methods.
    @contractParameter<number>() value: number,
  ): void {
    void value;
  }

  private invalidPrivate(
    // @ts-expect-error strict contract parameters must belong to public instance methods.
    @contractParameter<number>() value: number,
  ): void {
    void value;
  }

  static invalidStatic(
    // @ts-expect-error static parameters do not participate in controller instance metadata.
    @contractParameter<number>() value: number,
  ): void {
    void value;
  }
}

class ContractParameterBaseController {
  handle(@contractParameter<string | number>() value: string | number): void {
    void value;
  }
}

class InvalidRedecoratedOverrideController extends ContractParameterBaseController {
  override handle(
    // @ts-expect-error repeating the strict decorator catches unsafe override narrowing.
    @contractParameter<string | number>() value: string,
  ): void {
    void value;
  }
}

void InvalidMethodController;
void InvalidParameterController;
void InvalidRedecoratedOverrideController;
