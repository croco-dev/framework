import type { ProblemDetails } from "./Problem";
import type { ProblemExtensions } from "./ProblemExtensions";
import { ProblemDetailsParseProblem } from "./problems/ProblemDetailsParseProblem";
import { validateExtensions } from "./validators/validateExtensions";

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
    const { type, title, status, detail, instance, code, ...extensions } = problem;
    const result: SerializedProblem = { type, title, status, code };

    if (detail !== undefined) {
      result.detail = detail;
    }

    if (instance !== undefined) {
      result.instance = instance;
    }

    const extensionKeys = Object.keys(extensions);
    if (extensionKeys.length > 0) {
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
    const result: ProblemDetails = {
      type: serialized.type,
      title: serialized.title,
      status: serialized.status,
      code: serialized.code,
    };

    if (serialized.detail !== undefined) {
      result.detail = serialized.detail;
    }

    if (serialized.instance !== undefined) {
      result.instance = serialized.instance;
    }

    if (serialized.extensions !== undefined) {
      Object.assign(result, serialized.extensions);
    }

    return result;
  },

  /**
   * JSON 객체를 ProblemDetails로 파싱합니다.
   * 필수 필드(type, title, status, code)와 선택적 필드를 검증합니다.
   * @param json - 파싱할 JSON 객체
   * @returns ProblemDetails
   * @throws {Error} 필수 필드가 없거나 타입이 잘못된 경우
   */
  fromJson(json: unknown): ProblemDetails {
    if (typeof json !== "object" || json === null) {
      throw new ProblemDetailsParseProblem("Expected object for ProblemDetails");
    }

    const obj = json as Record<string, unknown>;
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

    const knownFields = new Set(["type", "title", "status", "code", "detail", "instance"]);
    const extensions: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (!knownFields.has(key)) {
        extensions[key] = value;
      }
    }

    if (Object.keys(extensions).length > 0) {
      validateExtensions(extensions);
      Object.assign(result, extensions);
    }

    return result;
  },
};
