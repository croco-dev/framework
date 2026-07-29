import { readdir, stat } from "node:fs/promises";
import { parse, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { MigrationFileLoadProblem } from "./problems/MigrationFileLoadProblem";
import type { MigrationFile } from "./types";

export class MigrationScanner {
  private readonly migrationsDir: string;

  constructor(migrationsDir: string) {
    this.migrationsDir = migrationsDir;
  }

  async scan(): Promise<MigrationFile[]> {
    const entries = await readdir(this.migrationsDir);
    const files: MigrationFile[] = [];

    for (const entry of entries.sort()) {
      const fullPath = resolve(this.migrationsDir, entry);
      const stats = await stat(fullPath);

      if (!stats.isFile()) continue;

      const { ext, name } = parse(entry);
      if (ext !== ".ts" && ext !== ".js") continue;

      const match = name.match(/^(\d{14})_(.+)$/);
      if (!match) continue;

      const [, timestamp, migrationName] = match;
      const id = timestamp;

      const moduleUrl = pathToFileURL(fullPath).href;
      let module: Pick<MigrationFile, "up" | "down">;
      try {
        module = (await import(moduleUrl)) as Pick<MigrationFile, "up" | "down">;
      } catch (error) {
        throw new MigrationFileLoadProblem(moduleUrl, error);
      }

      files.push({
        id,
        name: migrationName,
        path: fullPath,
        up: module.up,
        down: module.down,
      });
    }

    return files.sort((a, b) => a.id.localeCompare(b.id));
  }
}
