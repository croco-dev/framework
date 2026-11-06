import * as fs from "node:fs";
import * as path from "node:path";

const repositoryRoot = path.resolve(__dirname, "../../../../..");

export function installPublishedDiPackages(root: string, names: readonly string[]): void {
  const crocoModules = path.join(root, "node_modules/@croco");
  fs.mkdirSync(crocoModules, { recursive: true });
  // Match published entrypoints without following workspace links back into implementation sources.
  for (const name of names) {
    const packageRoot = path.join(repositoryRoot, "packages", name);
    const installedRoot = path.join(crocoModules, name);
    const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
    fs.mkdirSync(installedRoot);
    fs.writeFileSync(
      path.join(installedRoot, "package.json"),
      JSON.stringify({ ...manifest, ...manifest.publishConfig }),
    );
    fs.cpSync(path.join(packageRoot, "dist"), path.join(installedRoot, "dist"), {
      recursive: true,
    });
  }
}
