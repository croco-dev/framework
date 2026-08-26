import { Problem, ProblemCategory } from "@croco/problems-core";

declare const TRIGGER_HANDLER_CONTRACT: unique symbol;

type TriggerHandlerContract<Input, Result> = {
  readonly [TRIGGER_HANDLER_CONTRACT]: {
    readonly input: Input;
    readonly result: Result;
  };
};

export type WebhookHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

type CaseInsensitive<Value extends string> = Value extends ""
  ? ""
  : Value extends `${infer First}${infer Rest}`
    ? `${Lowercase<First> | Uppercase<First>}${CaseInsensitive<Rest>}`
    : Value;

export type WebhookHttpMethodInput = CaseInsensitive<WebhookHttpMethod>;

type NormalizedWebhookHttpMethod<Method extends WebhookHttpMethodInput> = Uppercase<Method> &
  WebhookHttpMethod;

const WEBHOOK_HTTP_METHODS = new Set<WebhookHttpMethod>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
]);

class UnsupportedWebhookMethodProblem extends Problem {
  constructor(method: string) {
    super(
      "triggers-core/unsupported-webhook-method",
      ProblemCategory.ValidationError,
      `Unsupported webhook HTTP method '${method}'`,
    );
  }
}

export type EventTriggerRef<
  Payload = unknown,
  Result = void,
  Name extends string = string,
> = TriggerHandlerContract<Payload, Result> & {
  readonly type: "event";
  readonly name: Name;
};

export type WebhookTriggerRef<
  Request = unknown,
  Result = void,
  Path extends string = string,
  Method extends WebhookHttpMethod = WebhookHttpMethod,
> = TriggerHandlerContract<Request, Result> & {
  readonly type: "webhook";
  readonly path: Path;
  readonly method: Method;
};

export type AnyEventTriggerRef = EventTriggerRef<unknown, unknown>;
export type AnyWebhookTriggerRef = WebhookTriggerRef<unknown, unknown>;

export type TriggerRefInput<Ref> =
  Ref extends TriggerHandlerContract<infer Input, unknown> ? Input : never;

export type TriggerRefResult<Ref> =
  Ref extends TriggerHandlerContract<unknown, infer Result> ? Result : never;

type AnyMethod = (...args: never[]) => unknown;

type IsAny<Value> = 0 extends 1 & Value ? true : false;

type IsEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type IsGenericOrOverloaded<Method extends AnyMethod> =
  IsEqual<Method, (...args: Parameters<Method>) => ReturnType<Method>> extends true ? false : true;

type IsCompatibleTriggerHandler<Method extends AnyMethod, Input, Result> =
  IsGenericOrOverloaded<Method> extends true
    ? false
    : Parameters<Method> extends readonly [infer First, ...unknown[]]
      ? IsAny<First> extends true
        ? false
        : IsAny<Awaited<ReturnType<Method>>> extends true
          ? false
          : [Input] extends [First]
            ? [Awaited<ReturnType<Method>>] extends [Result]
              ? true
              : false
            : false
      : false;

export type TypedTriggerMethodDecorator<Input, Result> = <
  Target extends object,
  Method extends AnyMethod,
>(
  target: Target,
  propertyKey: PropertyKey,
  descriptor: TypedPropertyDescriptor<Method> &
    (IsCompatibleTriggerHandler<Method, Input, Result> extends true ? unknown : never),
) => void | TypedPropertyDescriptor<Method>;

type EventTriggerFactory<Payload, Result> = <const Name extends string>(
  name: Name,
) => EventTriggerRef<Payload, Result, Name>;

type WebhookTriggerFactory<Request, Result> = <
  const Path extends string,
  const Method extends WebhookHttpMethodInput,
>(
  path: Path,
  method: Method,
) => WebhookTriggerRef<Request, Result, Path, NormalizedWebhookHttpMethod<Method>>;

function createEventTrigger<const Name extends string>(
  name: Name,
): EventTriggerRef<unknown, void, Name> {
  return Object.freeze({
    type: "event" as const,
    name,
  }) as EventTriggerRef<unknown, void, Name>;
}

function createWebhookTrigger<
  const Path extends string,
  const Method extends WebhookHttpMethodInput,
>(
  path: Path,
  method: Method,
): WebhookTriggerRef<unknown, void, Path, NormalizedWebhookHttpMethod<Method>> {
  return Object.freeze({
    type: "webhook" as const,
    path,
    method: normalizeWebhookHttpMethod(method),
  }) as WebhookTriggerRef<unknown, void, Path, NormalizedWebhookHttpMethod<Method>>;
}

export function normalizeWebhookHttpMethod(method: string): WebhookHttpMethod {
  const normalizedMethod = method.toUpperCase() as WebhookHttpMethod;
  if (!WEBHOOK_HTTP_METHODS.has(normalizedMethod)) {
    throw new UnsupportedWebhookMethodProblem(method);
  }

  return normalizedMethod;
}

/** Defines a serializable event trigger while retaining its handler payload and result contract. */
export function defineEventTrigger<Payload = unknown, Result = void>(): EventTriggerFactory<
  Payload,
  Result
>;
export function defineEventTrigger<const Name extends string>(
  name: Name,
): EventTriggerRef<unknown, void, Name>;
export function defineEventTrigger(
  name?: string,
): EventTriggerRef<unknown, void> | EventTriggerFactory<unknown, void> {
  return name === undefined ? createEventTrigger : createEventTrigger(name);
}

/** Defines a serializable webhook trigger while retaining its handler request and result contract. */
export function defineWebhookTrigger<Request = unknown, Result = void>(): WebhookTriggerFactory<
  Request,
  Result
>;
export function defineWebhookTrigger<
  const Path extends string,
  const Method extends WebhookHttpMethodInput,
>(
  path: Path,
  method: Method,
): WebhookTriggerRef<unknown, void, Path, NormalizedWebhookHttpMethod<Method>>;
export function defineWebhookTrigger(
  path?: string,
  method?: WebhookHttpMethodInput,
): WebhookTriggerRef<unknown, void> | WebhookTriggerFactory<unknown, void> {
  if (path === undefined) {
    return createWebhookTrigger;
  }
  if (method === undefined) {
    throw new UnsupportedWebhookMethodProblem("undefined");
  }

  return createWebhookTrigger(path, method);
}
