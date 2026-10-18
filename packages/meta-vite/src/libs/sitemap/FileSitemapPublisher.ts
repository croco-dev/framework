import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { SitemapProblem } from "./SitemapProblem";
import type { StorageProvider } from "@croco/storage-core";
import type { SitemapGeneration, SitemapPublication, SitemapPublisher } from "./types";

function missing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function publication(value: unknown): value is SitemapPublication {
  if (
    !record(value) ||
    typeof value.generationId !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.generationId) ||
    typeof value.revision !== "string" ||
    !/^[A-Za-z0-9._:-]{1,256}$/.test(value.revision) ||
    typeof value.actorId !== "string" ||
    !value.actorId.trim() ||
    typeof value.idempotencyKey !== "string" ||
    !value.idempotencyKey.trim() ||
    typeof value.index !== "string" ||
    !record(value.report)
  )
    return false;
  const report = value.report;
  return (
    report.revision === value.revision &&
    report.sourceComplete === true &&
    count(report.scanned) &&
    count(report.included) &&
    count(report.lastmodUnknown) &&
    record(report.excluded) &&
    [
      "publication",
      "indexability",
      "tenant",
      "url",
      "canonical",
      "duplicate",
      "canonical-conflict",
      "locale",
    ].every((key) => count((report.excluded as Record<string, unknown>)[key])) &&
    Array.isArray(report.files) &&
    report.files.every(
      (file: unknown) =>
        record(file) &&
        typeof file.name === "string" &&
        /^sitemap-\d{5}\.xml$/.test(file.name) &&
        count(file.bytes) &&
        count(file.urls),
    )
  );
}

/**
 * POSIX publication coordinator. Every writer for one site must share this directory.
 * Optional StorageProvider stores XML; the shared filesystem still owns the atomic pointer.
 * A crashed lock fails closed and needs operator inspection before removal. No lease expiry.
 */
export class FileSitemapPublisher implements SitemapPublisher {
  private readonly directory: string;

  constructor(
    directory: string,
    private readonly storage?: Pick<StorageProvider, "put" | "get">,
  ) {
    this.directory = resolve(directory);
  }

  async current(): Promise<SitemapPublication | null> {
    try {
      const envelope: unknown = JSON.parse(
        await readFile(join(this.directory, "current.json"), "utf8"),
      );
      if (!record(envelope) || envelope.schemaVersion !== 1 || !publication(envelope.publication))
        throw new SitemapProblem("storage");
      if (
        (await this.completedIndex(envelope.publication.generationId)) !==
        envelope.publication.index
      )
        throw new SitemapProblem("storage");
      return envelope.publication;
    } catch (error) {
      if (missing(error)) return null;
      throw new SitemapProblem("storage");
    }
  }

  async publish(
    generation: SitemapGeneration,
    command: {
      actorId: string;
      idempotencyKey: string;
      expectedGenerationId: string | null;
    },
  ): Promise<SitemapPublication> {
    try {
      return await this.publishGeneration(generation, command);
    } catch (error) {
      if (error instanceof SitemapProblem) throw error;
      throw new SitemapProblem("storage");
    }
  }

  private async publishGeneration(
    generation: SitemapGeneration,
    command: Parameters<SitemapPublisher["publish"]>[1],
  ): Promise<SitemapPublication> {
    if (
      !/^[a-f0-9]{64}$/.test(generation.id) ||
      !generation.report.sourceComplete ||
      !command.actorId.trim() ||
      !command.idempotencyKey.trim()
    )
      throw new SitemapProblem("access");
    try {
      await mkdir(this.directory, { recursive: true });
    } catch {
      throw new SitemapProblem("storage");
    }
    const lock = join(this.directory, "publish.lock");
    try {
      await mkdir(lock);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST")
        throw new SitemapProblem("conflict");
      throw new SitemapProblem("storage");
    }
    const temporary = join(this.directory, `current-${randomUUID()}.tmp`);
    try {
      const current = await this.current();
      if (current?.idempotencyKey === command.idempotencyKey) {
        if (current.generationId !== generation.id || current.actorId !== command.actorId)
          throw new SitemapProblem("conflict");
        return current;
      }
      if ((current?.generationId ?? null) !== command.expectedGenerationId)
        throw new SitemapProblem("conflict");
      const completed = await this.completedIndex(generation.id);
      if (completed !== null && completed !== generation.index)
        throw new SitemapProblem("conflict");
      if (completed === null) {
        for (const file of generation.files) {
          if (!/^sitemap-\d{5}\.xml$/.test(file.name)) throw new SitemapProblem("storage");
          await this.put(generation.id, file.name, file.xml);
        }
        await this.put(generation.id, "index.xml", generation.index);
        // Keep the completion marker on the coordinating filesystem: a provider may
        // leave a partially written object after rejecting a put. Completed objects
        // are never rewritten, even when publishing again with another command key.
        const path = join(this.directory, "sitemaps", generation.id);
        await mkdir(path, { recursive: true });
        const marker = join(path, `complete-${randomUUID()}.tmp`);
        try {
          await writeFile(marker, generation.index);
          await rename(marker, join(path, "complete.xml"));
        } finally {
          await rm(marker, { force: true });
        }
      }
      const publication: SitemapPublication = {
        generationId: generation.id,
        revision: generation.revision,
        actorId: command.actorId,
        idempotencyKey: command.idempotencyKey,
        report: generation.report,
        index: generation.index,
      };
      await writeFile(temporary, JSON.stringify({ schemaVersion: 1, publication }), {
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporary, join(this.directory, "current.json"));
      return publication;
    } finally {
      await rm(temporary, { force: true });
      await rm(lock, { recursive: true });
    }
  }

  private async completedIndex(id: string): Promise<string | null> {
    try {
      return await readFile(join(this.directory, "sitemaps", id, "complete.xml"), "utf8");
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  private async put(id: string, name: string, xml: string): Promise<void> {
    const key = `sitemaps/${id}/${name}`;
    if (this.storage) {
      await this.storage.put(key, new TextEncoder().encode(xml), {
        contentType: "application/xml; charset=utf-8",
        cacheControl: "public, max-age=31536000, immutable",
        isPublic: false,
      });
    } else {
      const directory = join(this.directory, "sitemaps", id);
      await mkdir(directory, { recursive: true });
      // Even a repeated generation never exposes a partially overwritten shard.
      const temporary = join(directory, `${name}-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, xml);
        await rename(temporary, join(directory, name));
      } finally {
        await rm(temporary, { force: true });
      }
    }
  }

  async read(generationId: string, name: string): Promise<string | null> {
    if (!/^[a-f0-9]{64}$/.test(generationId) || !/^sitemap-\d{5}\.xml$/.test(name)) return null;
    try {
      if ((await this.completedIndex(generationId)) === null) return null;
      if (this.storage) {
        return new TextDecoder("utf-8", { fatal: true }).decode(
          await this.storage.get(`sitemaps/${generationId}/${name}`),
        );
      }
      await readFile(join(this.directory, "sitemaps", generationId, "index.xml"));
      return await readFile(join(this.directory, "sitemaps", generationId, name), "utf8");
    } catch (error) {
      if (
        missing(error) ||
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "STORAGE_FILE_NOT_FOUND")
      )
        return null;
      throw new SitemapProblem("storage");
    }
  }
}
