import type { Plugin } from "vite";
import { describe, expect, it, vi } from "vitest";
import { crocoMetaVitePlugin } from "../libs/vite/crocoMetaVitePlugin";

// `createRequire` decides which install the peer check consults. The mock
// records the anchors it is handed and only answers for one of them, so the
// test observes which install the check actually looked at.
const anchorsSeen: string[] = [];

vi.mock("node:module", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createRequire: (anchor: string) => ({
      resolve: (specifier: string) => {
        anchorsSeen.push(`${anchor} ${specifier}`);
        if (anchor.includes("/resolvable-project")) {
          return "/resolvable-project/node_modules/@vitejs/plugin-rsc/dist/index.js";
        }
        throw Object.assign(new Error(`Cannot find module '${specifier}'`), {
          code: "MODULE_NOT_FOUND",
        });
      },
    }),
  };
});

type ConfigEnvironmentHook = (name: string) => unknown;

describe("crocoMetaVitePlugin rsc peer resolution", () => {
  it("consults the Vite project root before the process cwd", () => {
    anchorsSeen.length = 0;
    const plugin = crocoMetaVitePlugin({ rsc: true })[0] as Plugin & {
      config?: (config: Record<string, unknown>) => unknown;
      configEnvironment?: ConfigEnvironmentHook;
    };

    // Vite passes the project root in the user config: `vite build <dir>` from
    // an unrelated working directory still reports the app's root here.
    plugin.config?.({ root: "/resolvable-project" });

    expect(() => plugin.configEnvironment?.("rsc")).not.toThrow();
    expect(anchorsSeen[0]).toBe("/resolvable-project/package.json @vitejs/plugin-rsc");
  });

  it("falls back to the cwd when the project root has no peer", () => {
    anchorsSeen.length = 0;
    const plugin = crocoMetaVitePlugin({ rsc: true })[0] as Plugin & {
      config?: (config: Record<string, unknown>) => unknown;
      configEnvironment?: ConfigEnvironmentHook;
    };

    plugin.config?.({ root: "/no-peer-here" });

    // Neither the project root nor the cwd resolves it, so the build fails —
    // and the reason is the resolution message from the last anchor consulted.
    expect(() => plugin.configEnvironment?.("rsc")).toThrow(
      /Cannot find module '@vitejs\/plugin-rsc'/,
    );
    expect(anchorsSeen[0]).toBe("/no-peer-here/package.json @vitejs/plugin-rsc");
    expect(anchorsSeen.at(-1)).toBe(`${process.cwd()}/package.json @vitejs/plugin-rsc`);
  });
});
