import { posix } from "node:path";

export function normalizeTypeDocMergeModel(model, packageDirectory) {
  if (!model || typeof model !== "object") {
    throw new Error("TypeDoc model must be an object");
  }
  const entries = model.files?.entries;
  if (!entries || typeof entries !== "object") {
    throw new Error(`TypeDoc model for ${packageDirectory} is missing files.entries`);
  }

  for (const [id, filePath] of Object.entries(entries)) {
    if (typeof filePath !== "string") {
      throw new Error(`TypeDoc model for ${packageDirectory} has a non-string file entry: ${id}`);
    }
    entries[id] = posix.join("..", packageDirectory, filePath);
  }
  return model;
}
