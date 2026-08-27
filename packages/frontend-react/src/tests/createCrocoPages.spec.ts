import { describe, expect, expectTypeOf, it } from "vitest";

import { RouteRegistry, defineRoute } from "@croco/meta-vite";

import { createCrocoPageConfig } from "../libs/createCrocoPages";
import type { CrocoPageConfig } from "../libs/createCrocoPages";

describe("createCrocoPageConfig", () => {
  it("canonical options cannot be mixed with deprecated options", () => {
    // @ts-expect-error Canonical mode and deprecated ssr cannot be combined.
    createCrocoPageConfig({ mode: "ssr", ssr: true });
    // @ts-expect-error Canonical seconds and deprecated millisecond revalidate cannot be combined.
    createCrocoPageConfig({ mode: "isr", revalidate: 60_000, revalidateSeconds: 60 });
    // @ts-expect-error Canonical mode requires the explicitly named seconds option.
    createCrocoPageConfig({ mode: "isr", revalidate: 60 });
  });

  it("기본값 확인 - ssr mode", () => {
    const config = createCrocoPageConfig();

    expect(config.mode).toBe("ssr");
  });

  it.each(["ssr", "ssg", "isr", "rsc"] as const)("%s mode를 registry 경계까지 보존한다", (mode) => {
    const path = `/${mode}`;
    const registry = new RouteRegistry();
    const config = createCrocoPageConfig({ mode, path });

    registry.register(defineRoute({ ...config, component: () => null }));

    expect(config.mode).toBe(mode);
    expect(registry.getPageRoutes()).toEqual([expect.objectContaining({ mode, path })]);
  });

  it("path와 canonical head metadata를 보존한다", () => {
    const head = () => ({
      canonical: "https://example.com/dashboard",
      description: "desc",
      ogTitle: "Dashboard",
      title: "Test",
    });
    const config = createCrocoPageConfig({ head, path: "/dashboard" });
    const registry = new RouteRegistry();

    registry.register(defineRoute({ ...config, component: () => null }));
    const [route] = registry.getPageRoutes();

    expect(config.path).toBe("/dashboard");
    expect(config.head).toBe(head);
    expect(route?.head).toBe(head);
    expect(route?.head?.()).toEqual({
      canonical: "https://example.com/dashboard",
      description: "desc",
      ogTitle: "Dashboard",
      title: "Test",
    });
  });

  it("명시적인 초 단위 revalidate를 registry 경계에서 한 번만 변환한다", () => {
    const registry = new RouteRegistry();
    const config = createCrocoPageConfig({
      mode: "isr",
      path: "/blog",
      revalidateSeconds: 60,
    });

    registry.register(defineRoute({ ...config, component: () => null }));

    expect(config.revalidate).toBe(60);
    expect(registry.getPageRoutes()).toEqual([
      expect.objectContaining({
        mode: "isr",
        path: "/blog",
        revalidateMs: 60_000,
      }),
    ]);
  });

  it("deprecated boolean과 millisecond 입력을 canonical route config로 변환한다", () => {
    const config = createCrocoPageConfig({ path: "/legacy", revalidate: 60_000, ssr: false });

    expect(config).toEqual({ mode: "ssg", path: "/legacy", revalidate: 60 });
  });

  it("meta-vite page route input과 직접 조합되는 config를 반환한다", () => {
    const config = createCrocoPageConfig({ mode: "rsc", path: "/dashboard" });

    expectTypeOf(config).toMatchTypeOf<CrocoPageConfig>();
    expect(defineRoute({ ...config, component: () => null })).toMatchObject({
      mode: "rsc",
      path: "/dashboard",
    });
  });
});
