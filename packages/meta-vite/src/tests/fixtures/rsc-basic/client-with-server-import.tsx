"use client";

import { serverOnlyModuleReference } from "./server-only-module";

export default function ClientWithServerImport() {
  return <div>Client imports {serverOnlyModuleReference}</div>;
}
