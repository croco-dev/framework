import React from "react";
import type { RuntimeContext } from "@croco/meta-vite";

type PageProps = {
  readonly request: Request;
  readonly context?: RuntimeContext;
};

export default function Page({ context }: PageProps) {
  return (
    <div>
      <h1>Welcome to {{ projectName }}</h1>
      <p>Hello from {{ projectName }}!</p>
      <p>Runtime: {context?.platform ?? "unknown"}</p>
      <p>Worker env: {context?.env ? "bound" : "missing"}</p>
    </div>
  );
}
