import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvalidSignedUrlExpiryProblem,
  MAX_SIGNED_URL_EXPIRY_SECONDS,
} from "../libs/problems/InvalidSignedUrlExpiryProblem";
import { InMemoryStorageProvider } from "../libs/InMemoryStorageProvider";
import { FileNotFoundProblem } from "../libs/problems/FileNotFoundProblem";
import { InvalidKeyProblem } from "../libs/problems/InvalidKeyProblem";
import { readStorageStream } from "../libs/storageBody";
import { StorageOperationAbortedProblem } from "../libs/problems/StorageOperationAbortedProblem";

const INVALID_SIGNED_URL_EXPIRY_MESSAGE = `Signed URL expiry must be a positive safe integer no greater than ${MAX_SIGNED_URL_EXPIRY_SECONDS} seconds`;

const INVALID_SIGNED_URL_EXPIRIES = [
  -1,
  0,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  MAX_SIGNED_URL_EXPIRY_SECONDS + 1,
  Number.MAX_SAFE_INTEGER + 1,
] as const;

describe("InMemoryStorageProvider", () => {
  let provider!: InMemoryStorageProvider;

  beforeEach(() => {
    provider = new InMemoryStorageProvider("https://cdn.example.com");
  });

  describe("put()", () => {
    it("Buffer로 파일 업로드 성공", async () => {
      const buffer = Buffer.from("Hello, World!");
      await provider.put("test/file.txt", buffer, { contentType: "text/plain" });

      const result = await provider.get("test/file.txt");
      expect(result).toEqual(buffer);
    });

    it("Web ReadableStream으로 파일 업로드 성공", async () => {
      const data = new TextEncoder().encode("Stream content");
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });
      await provider.put("test/stream.txt", stream);

      const result = await provider.get("test/stream.txt");
      expect(result).toEqual(data);
    });

    it("메타데이터 함께 저장", async () => {
      const buffer = Buffer.from("Metadata test");
      await provider.put("test/meta.txt", buffer, {
        contentType: "text/plain",
        metadata: { author: "test-user" },
      });

      const metadata = await provider.getMetadata("test/meta.txt");
      expect(metadata.size).toBe(13);
      expect(metadata.contentType).toBe("text/plain");
      expect(metadata.metadata).toEqual({ author: "test-user" });
      expect(metadata.lastModified).toBeInstanceOf(Date);
    });

    it("빈 키로 업로드 시도 시 InvalidKeyProblem throw", async () => {
      await expect(provider.put("", Buffer.from("data"))).rejects.toThrow(InvalidKeyProblem);
    });

    it("/로 시작하는 키로 업로드 시도 시 InvalidKeyProblem throw", async () => {
      await expect(provider.put("/invalid/key", Buffer.from("data"))).rejects.toThrow(
        InvalidKeyProblem,
      );
    });

    it("/로 끝나는 키로 업로드 시도 시 InvalidKeyProblem throw", async () => {
      await expect(provider.put("invalid/key/", Buffer.from("data"))).rejects.toThrow(
        InvalidKeyProblem,
      );
    });

    it("//를 포함하는 키로 업로드 시도 시 InvalidKeyProblem throw", async () => {
      await expect(provider.put("invalid//key", Buffer.from("data"))).rejects.toThrow(
        InvalidKeyProblem,
      );
    });

    it("스트림 업로드 중 취소되면 원인을 보존하고 객체를 저장하지 않음", async () => {
      const controller = new AbortController();
      const reason = new Error("request deadline reached");
      const source = new ReadableStream<Uint8Array>({ pull() {} });

      const upload = provider.put("test/aborted-stream.txt", source, {
        signal: controller.signal,
      });
      controller.abort(reason);

      await expect(upload).rejects.toMatchObject({
        cause: reason,
        code: "STORAGE_OPERATION_ABORTED",
        extensions: {
          key: "test/aborted-stream.txt",
          operation: "put",
        },
      });
      await expect(provider.exists("test/aborted-stream.txt")).resolves.toBe(false);
    });

    it("스트림 업로드 중 non-Error 취소 사유도 cause chain에 보존", async () => {
      const controller = new AbortController();
      const reason = { deadline: 5000, source: "request" };
      const source = new ReadableStream<Uint8Array>({ pull() {} });

      const upload = provider.put("test/structured-abort.txt", source, {
        signal: controller.signal,
      });
      controller.abort(reason);

      await expect(upload).rejects.toSatisfy((error: unknown) => {
        if (!(error instanceof StorageOperationAbortedProblem) || !(error.cause instanceof Error)) {
          return false;
        }

        return Reflect.get(error.cause, "cause") === reason;
      });
      await expect(provider.exists("test/structured-abort.txt")).resolves.toBe(false);
    });

    it("호출자 signal 없이 발생한 AbortError를 취소 Problem으로 오분류하지 않음", async () => {
      const sourceError = new DOMException("provider stream aborted", "AbortError");
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(sourceError);
        },
      });

      await expect(provider.put("test/provider-abort.txt", source)).rejects.toMatchObject({
        cause: sourceError,
        code: "STORAGE_UPLOAD_FAILED",
      });
    });
  });

  describe("operation cancellation", () => {
    it("이미 취소된 signal을 모든 비동기 연산에서 동일한 Problem으로 거부", async () => {
      await provider.put("test/cancellation.txt", Buffer.from("content"));
      const controller = new AbortController();
      const reason = new Error("caller disconnected");
      controller.abort(reason);

      const operations = [
        provider.put("test/new.txt", Buffer.from("new"), { signal: controller.signal }),
        provider.get("test/cancellation.txt", { signal: controller.signal }),
        provider.getStream("test/cancellation.txt", { signal: controller.signal }),
        provider.delete("test/cancellation.txt", { signal: controller.signal }),
        provider.exists("test/cancellation.txt", { signal: controller.signal }),
        provider.getSignedUrl("test/cancellation.txt", {
          expiresIn: 60,
          signal: controller.signal,
        }),
        provider.getMetadata("test/cancellation.txt", { signal: controller.signal }),
      ];

      for (const operation of operations) {
        await expect(operation).rejects.toBeInstanceOf(StorageOperationAbortedProblem);
        await expect(operation).rejects.toMatchObject({
          cause: reason,
          code: "STORAGE_OPERATION_ABORTED",
        });
      }

      await expect(provider.get("test/cancellation.txt")).resolves.toEqual(Buffer.from("content"));
      await expect(provider.exists("test/new.txt")).resolves.toBe(false);
    });

    it.each([
      ["primitive", "shutdown deadline"],
      ["structured", { source: "request", deadline: 5000 }],
    ])("%s abort reason을 Error cause에 손실 없이 보존", async (_name, reason) => {
      const controller = new AbortController();
      controller.abort(reason);

      const operation = provider.get("test/cancellation.txt", { signal: controller.signal });

      await expect(operation).rejects.toSatisfy((error: unknown) => {
        if (!(error instanceof StorageOperationAbortedProblem) || !(error.cause instanceof Error)) {
          return false;
        }

        return Reflect.get(error.cause, "cause") === reason;
      });
    });
  });

  describe("get()", () => {
    it("저장된 파일 조회 성공", async () => {
      const buffer = Buffer.from("Get test content");
      await provider.put("test/get.txt", buffer);

      const result = await provider.get("test/get.txt");
      expect(result).toEqual(buffer);
    });

    it("존재하지 않는 파일 조회 시 FileNotFoundProblem throw", async () => {
      await expect(provider.get("nonexistent/file.txt")).rejects.toThrow(FileNotFoundProblem);
    });

    it("유효하지 않은 키로 조회 시 InvalidKeyProblem throw", async () => {
      await expect(provider.get("")).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe("getStream()", () => {
    it("저장된 파일 스트림 반환", async () => {
      const buffer = Buffer.from("Stream test content");
      await provider.put("test/stream.txt", buffer);

      const stream = await provider.getStream("test/stream.txt");
      expect(stream).toBeInstanceOf(ReadableStream);
      expect(await readStorageStream(stream)).toEqual(new Uint8Array(buffer));
    });

    it("존재하지 않는 파일 스트림 조회 시 FileNotFoundProblem throw", async () => {
      await expect(provider.getStream("nonexistent/file.txt")).rejects.toThrow(FileNotFoundProblem);
    });

    it("유효하지 않은 키로 스트림 조회 시 InvalidKeyProblem throw", async () => {
      await expect(provider.getStream("/invalid")).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe("delete()", () => {
    it("저장된 파일 삭제 성공", async () => {
      await provider.put("test/delete.txt", Buffer.from("Delete me"));
      await provider.delete("test/delete.txt");

      const exists = await provider.exists("test/delete.txt");
      expect(exists).toBe(false);
    });

    it("존재하지 않는 파일 삭제 시 FileNotFoundProblem throw", async () => {
      await expect(provider.delete("nonexistent/file.txt")).rejects.toThrow(FileNotFoundProblem);
    });

    it("유효하지 않은 키로 삭제 시도 시 InvalidKeyProblem throw", async () => {
      await expect(provider.delete("key//end")).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe("exists()", () => {
    it("존재하는 파일 확인 시 true 반환", async () => {
      await provider.put("test/exists.txt", Buffer.from("I exist"));
      const result = await provider.exists("test/exists.txt");
      expect(result).toBe(true);
    });

    it("존재하지 않는 파일 확인 시 false 반환", async () => {
      const result = await provider.exists("nonexistent/file.txt");
      expect(result).toBe(false);
    });

    it("유효하지 않은 키로 확인 시도 시 InvalidKeyProblem throw", async () => {
      await expect(provider.exists("//invalid")).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe("getPublicUrl()", () => {
    it("공개 URL 생성", () => {
      const url = provider.getPublicUrl("test/public.txt");
      expect(url).toBe("https://cdn.example.com/test/public.txt");
    });

    it("유효하지 않은 키로 URL 생성 시도 시 InvalidKeyProblem throw", () => {
      expect(() => provider.getPublicUrl("/invalid")).toThrow(InvalidKeyProblem);
    });

    it("기본 baseUrl 사용", () => {
      const defaultProvider = new InMemoryStorageProvider();
      const url = defaultProvider.getPublicUrl("test/file.txt");
      expect(url).toBe("https://example.com/test/file.txt");
    });
  });

  describe("getSignedUrl()", () => {
    it("서명된 URL 생성", async () => {
      await provider.put("test/signed.txt", Buffer.from("Signed content"));
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);
      const url = await provider.getSignedUrl("test/signed.txt", {
        expiresIn: MAX_SIGNED_URL_EXPIRY_SECONDS,
      });

      expect(url).toContain("https://cdn.example.com/test/signed.txt?expires=");
      const expires = parseInt(url.split("expires=")[1], 10);
      expect(expires).toBe(now + MAX_SIGNED_URL_EXPIRY_SECONDS * 1000);
      vi.restoreAllMocks();
    });

    it("존재하지 않는 파일로 서명된 URL 생성 시도 시 FileNotFoundProblem throw", async () => {
      await expect(
        provider.getSignedUrl("nonexistent/file.txt", { expiresIn: 3600 }),
      ).rejects.toThrow(FileNotFoundProblem);
    });

    it.each(INVALID_SIGNED_URL_EXPIRIES)(
      "잘못된 만료 시간 %s를 안정적인 Problem 계약으로 거부",
      async (expiresIn) => {
        const rejection = provider.getSignedUrl("test/signed.txt", { expiresIn });

        await expect(rejection).rejects.toThrow(InvalidSignedUrlExpiryProblem);
        await expect(rejection).rejects.toMatchObject({
          code: "STORAGE_INVALID_SIGNED_URL_EXPIRY",
          message: INVALID_SIGNED_URL_EXPIRY_MESSAGE,
        });
      },
    );

    it("유효하지 않은 키로 서명된 URL 생성 시도 시 InvalidKeyProblem throw", async () => {
      await expect(provider.getSignedUrl("invalid//key", { expiresIn: 3600 })).rejects.toThrow(
        InvalidKeyProblem,
      );
    });
  });

  describe("getMetadata()", () => {
    it("저장된 메타데이터 조회", async () => {
      await provider.put("test/metadata.txt", Buffer.from("Metadata test"), {
        contentType: "application/json",
        metadata: { key: "value" },
      });

      const metadata = await provider.getMetadata("test/metadata.txt");
      expect(metadata.size).toBe(13);
      expect(metadata.contentType).toBe("application/json");
      expect(metadata.metadata).toEqual({ key: "value" });
      expect(metadata.lastModified).toBeInstanceOf(Date);
    });

    it("메타데이터 없이 저장된 파일의 기본 메타데이터 조회", async () => {
      await provider.put("test/nometa.txt", Buffer.from("No metadata"));

      const metadata = await provider.getMetadata("test/nometa.txt");
      expect(metadata.size).toBe(11);
      expect(metadata.contentType).toBeUndefined();
      expect(metadata.lastModified).toBeInstanceOf(Date);
    });

    it("존재하지 않는 파일 메타데이터 조회 시 FileNotFoundProblem throw", async () => {
      await expect(provider.getMetadata("nonexistent/file.txt")).rejects.toThrow(
        FileNotFoundProblem,
      );
    });

    it("유효하지 않은 키로 메타데이터 조회 시도 시 InvalidKeyProblem throw", async () => {
      await expect(provider.getMetadata("/invalid")).rejects.toThrow(InvalidKeyProblem);
    });
  });

  describe("clear()", () => {
    it("모든 데이터 초기화", async () => {
      await provider.put("test/file1.txt", Buffer.from("File 1"));
      await provider.put("test/file2.txt", Buffer.from("File 2"));

      provider.clear();

      expect(await provider.exists("test/file1.txt")).toBe(false);
      expect(await provider.exists("test/file2.txt")).toBe(false);
    });
  });
});
