type AnyMethod = (...args: never[]) => unknown;

declare const contractMethodDecoratorBrand: unique symbol;

type IsAny<Value> = 0 extends 1 & Value ? true : false;

type IsUnknown<Value> =
  IsAny<Value> extends true
    ? false
    : unknown extends Value
      ? [keyof Value] extends [never]
        ? true
        : false
      : false;

type IsNever<Value> = [Value] extends [never] ? true : false;

type IsVoid<Value> = IsEqual<Value, void>;

type IsEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type IsGenericOrOverloaded<Method extends AnyMethod> =
  IsEqual<Method, (...args: Parameters<Method>) => ReturnType<Method>> extends true ? false : true;

type MethodAt<Target, Key extends PropertyKey> =
  Target extends Record<Key, infer Method extends AnyMethod> ? Method : never;

type AwaitedReturn<Method extends AnyMethod> = Awaited<ReturnType<Method>>;

type AcceptsHandlerReturn<Method extends AnyMethod, Expected> =
  IsGenericOrOverloaded<Method> extends true
    ? false
    : IsAny<AwaitedReturn<Method>> extends true
      ? false
      : IsNever<AwaitedReturn<Method>> extends true
        ? false
        : IsVoid<AwaitedReturn<Method>> extends true
          ? false
          : [AwaitedReturn<Method>] extends [Expected]
            ? true
            : false;

type TupleIndexes<Values extends readonly unknown[]> =
  Exclude<keyof Values, keyof (readonly unknown[])> extends infer Index
    ? Index extends `${infer NumericIndex extends number}`
      ? NumericIndex
      : never
    : never;

type AcceptedParameterIndexes<Method, Expected> = Method extends (
  ...args: infer Parameters
) => unknown
  ? {
      [Index in TupleIndexes<Parameters>]: IsAny<Parameters[Index]> extends true
        ? never
        : IsAny<Expected> extends true
          ? IsUnknown<Parameters[Index]> extends true
            ? Index
            : never
          : [Expected] extends [Parameters[Index]]
            ? Index
            : never;
    }[TupleIndexes<Parameters>]
  : never;

type IsStaticTarget<Target> = Target extends { readonly prototype: object } ? true : false;

/** Ensures the decorated sync or async return annotation fits the contract handler-return slot. */
export type ContractMethodDecorator<Expected> = {
  <Target extends object, Key extends PropertyKey>(
    target: Target &
      Record<Key, AnyMethod> &
      (IsStaticTarget<Target> extends true ? never : unknown),
    propertyKey: Key,
    descriptor: TypedPropertyDescriptor<MethodAt<Target, Key>> &
      (AcceptsHandlerReturn<MethodAt<Target, Key>, Expected> extends true ? unknown : never),
  ): void;
  readonly [contractMethodDecoratorBrand]?: Expected;
};

/** Ensures the parsed contract output is assignable to the decorated parameter annotation. */
export type ContractParameterDecorator<Expected> = <
  Target extends object,
  Key extends PropertyKey,
  Index extends number,
>(
  target: Target & Record<Key, AnyMethod>,
  propertyKey: Key,
  parameterIndex: Index &
    (IsStaticTarget<Target> extends true
      ? never
      : IsGenericOrOverloaded<MethodAt<Target, Key>> extends true
        ? never
        : Index extends AcceptedParameterIndexes<MethodAt<Target, Key>, Expected>
          ? unknown
          : never),
) => void;
