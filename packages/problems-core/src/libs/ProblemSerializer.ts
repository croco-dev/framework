import { InvalidExtensionsProblem } from "./Problem";
import { ProblemDetailsParseProblem } from "./problems/ProblemDetailsParseProblem";
import { copyValidatedProblemExtensions } from "./validators/copyProblemExtensions";
import { validateExtensions } from "./validators/validateExtensions";
import type { ProblemDetails } from "./Problem";
import type { ProblemExtensions } from "./ProblemExtensions";

const PROBLEM_FIELDS = new Set(["type", "title", "status", "detail", "instance", "code"]);
const SERIALIZED_PROBLEM_FIELDS = new Set([...PROBLEM_FIELDS, "extensions"]);

export type SerializedProblem = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  extensions?: ProblemExtensions;
};

/**
 * Problem Details를 문자열과 JSON 객체 사이에서 직렬화하고 역직렬화하는 유틸리티입니다.
 */
export const ProblemSerializer = {
  /**
   * ProblemDetails를 SerializedProblem으로 변환합니다.
   * 확장 필드는 별도의 extensions 속성으로 분리됩니다.
   * @param problem - 직렬화할 ProblemDetails
   * @returns SerializedProblem
   */
  serialize(problem: ProblemDetails): SerializedProblem {
    const snapshot = snapshotOwnDataProperties(problem, PROBLEM_FIELDS);
    const type = snapshot["type"] as string;
    const title = snapshot["title"] as string;
    const status = snapshot["status"] as number;
    const detail = snapshot["detail"];
    const instance = snapshot["instance"];
    const code = snapshot["code"] as string;
    const result: SerializedProblem = { type, title, status, code };

    if (detail !== undefined) {
      result.detail = detail as string;
    }

    if (instance !== undefined) {
      result.instance = instance as string;
    }

    const extensions = collectExtensionProperties(snapshot, PROBLEM_FIELDS);
    if (Reflect.ownKeys(extensions).length > 0) {
      result.extensions = validateExtensions(extensions);
    }

    return result;
  },

  /**
   * SerializedProblem을 ProblemDetails로 변환합니다.
   * @param serialized - 역직렬화할 SerializedProblem
   * @returns ProblemDetails
   */
  deserialize(serialized: SerializedProblem): ProblemDetails {
    const snapshot = snapshotOwnDataProperties(serialized, SERIALIZED_PROBLEM_FIELDS);
    const result: ProblemDetails = {
      type: snapshot["type"] as string,
      title: snapshot["title"] as string,
      status: snapshot["status"] as number,
      code: snapshot["code"] as string,
    };

    const detail = snapshot["detail"];
    if (detail !== undefined) {
      result.detail = detail as string;
    }

    const instance = snapshot["instance"];
    if (instance !== undefined) {
      result.instance = instance as string;
    }

    const extensions = snapshot["extensions"];
    if (extensions !== undefined) {
      copyValidatedProblemExtensions(result, validateExtensions(extensions));
    }

    return result;
  },

  /**
   * JSON 객체를 ProblemDetails로 파싱합니다.
   * 필수 필드(type, title, status, code)와 선택적 필드를 검증합니다.
   * @param json - 파싱할 JSON 객체
   * @returns ProblemDetails
   * @throws {ProblemDetailsParseProblem} 필수 필드가 없거나 타입이 잘못된 경우
   * @throws {InvalidExtensionsProblem} 확장 필드가 JSON-safe하지 않은 경우
   */
  fromJson(json: unknown): ProblemDetails {
    if (typeof json !== "object" || json === null) {
      throw new ProblemDetailsParseProblem("Expected object for ProblemDetails");
    }

    const obj = snapshotOwnDataProperties(json, PROBLEM_FIELDS);
    const type = obj["type"];
    const title = obj["title"];
    const status = obj["status"];
    const code = obj["code"];

    if (typeof type !== "string" || type.length === 0) {
      throw new ProblemDetailsParseProblem('Missing or invalid "type" field');
    }
    if (typeof title !== "string" || title.length === 0) {
      throw new ProblemDetailsParseProblem('Missing or invalid "title" field');
    }
    if (typeof status !== "number" || !Number.isInteger(status) || status < 100 || status > 599) {
      throw new ProblemDetailsParseProblem('Missing or invalid "status" field');
    }
    if (typeof code !== "string" || code.length === 0) {
      throw new ProblemDetailsParseProblem('Missing or invalid "code" field');
    }

    const result: ProblemDetails = {
      type,
      title,
      status,
      code,
    };

    const detail = obj["detail"];
    if (detail !== undefined) {
      if (typeof detail !== "string") {
        throw new ProblemDetailsParseProblem('Invalid "detail" field');
      }
      result.detail = detail;
    }

    const instance = obj["instance"];
    if (instance !== undefined) {
      if (typeof instance !== "string") {
        throw new ProblemDetailsParseProblem('Invalid "instance" field');
      }
      result.instance = instance;
    }

    const extensions = collectExtensionProperties(obj, PROBLEM_FIELDS);

    if (Reflect.ownKeys(extensions).length > 0) {
      copyValidatedProblemExtensions(result, validateExtensions(extensions));
    }

    return result;
  },
};

function snapshotOwnDataProperties(
  value: object,
  knownFields: ReadonlySet<string>,
): Record<PropertyKey, unknown> {
  let keys: readonly PropertyKey[];

  try {
    keys = Reflect.ownKeys(value);
  } catch {
    throw new ProblemDetailsParseProblem("ProblemDetails could not be inspected safely");
  }

  const snapshot: Record<PropertyKey, unknown> = {};

  for (const key of keys) {
    let descriptor: PropertyDescriptor | undefined;

    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      throwInspectionProblem(key, knownFields, "could not be inspected safely");
    }

    if (descriptor === undefined || !("value" in descriptor)) {
      throwInspectionProblem(key, knownFields, "must be a data property");
    }

    Object.defineProperty(snapshot, key, {
      configurable: true,
      enumerable: descriptor.enumerable === true,
      value: descriptor.value,
      writable: true,
    });
  }

  return snapshot;
}

function collectExtensionProperties(
  snapshot: Record<PropertyKey, unknown>,
  knownFields: ReadonlySet<string>,
): ProblemExtensions {
  const extensions: ProblemExtensions = {};

  for (const key of Reflect.ownKeys(snapshot)) {
    if (typeof key === "string" && knownFields.has(key)) {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(snapshot, key);
    if (descriptor) {
      Object.defineProperty(extensions, key, descriptor);
    }
  }

  return extensions;
}

function throwInspectionProblem(
  key: PropertyKey,
  knownFields: ReadonlySet<string>,
  reason: string,
): never {
  if (typeof key === "string" && knownFields.has(key)) {
    throw new ProblemDetailsParseProblem(`Invalid "${key}" field`);
  }

  throw new InvalidExtensionsProblem("extensions", reason);
}
