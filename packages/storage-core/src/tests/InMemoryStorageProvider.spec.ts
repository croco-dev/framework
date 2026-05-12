import { Readable } from "node:stream";
import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryStorageProvider } from "../libs/InMemoryStorageProvider";
import { FileNotFoundProblem } from "../libs/problems/FileNotFoundProblem";
import { InvalidKeyProblem } from "../libs/problems/InvalidKeyProblem";

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

    it("Readable 스트림으로 파일 업로드 성공", async () => {
      const stream = Readable.from(Buffer.from("Stream content"));
      await provider.put("test/stream.txt", stream);

      const result = await provider.get("test/stream.txt");
      expect(result).toEqual(Buffer.from("Stream content"));
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
      expect(stream).toBeInstanceOf(Readable);

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }
      expect(Buffer.concat(chunks)).toEqual(buffer);
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
      const url = await provider.getSignedUrl("test/signed.txt", { expiresIn: 3600 });

      expect(url).toContain("https://cdn.example.com/test/signed.txt?expires=");
      const expires = parseInt(url.split("expires=")[1], 10);
      expect(expires).toBeGreaterThan(Date.now());
    });

    it("존재하지 않는 파일로 서명된 URL 생성 시도 시 FileNotFoundProblem throw", async () => {
      await expect(
        provider.getSignedUrl("nonexistent/file.txt", { expiresIn: 3600 }),
      ).rejects.toThrow(FileNotFoundProblem);
    });

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
