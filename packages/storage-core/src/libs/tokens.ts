import { Token } from "@croco/framework-context";
import type { StorageProvider } from "./types";

/**
 * Canonical application module token for the configured storage provider.
 */
export const STORAGE_PROVIDER_TOKEN = new Token<StorageProvider>("StorageProvider");
