import { describe, expect, it } from "vitest";

import type { RenderMode } from "@croco/meta-vite";

import { createCrocoPageConfig } from "../libs/createCrocoPages";

describe("createCrocoPageConfig", () => {
  it("기본값 확인 - ssr mode", () => {
    const config = createCrocoPageConfig();

    expect(config.mode).toBe("ssr");
  });

  it("ssr: false 옵션 전달 시 ssg mode 확인", () => {
    const config = createCrocoPageConfig({ ssr: false });

    expect(config.mode).toBe("ssg");
  });

  it("head 옵션 전달 시 head 포함 확인", () => {
    const head = () => ({ title: "Test", description: "desc" });
    const config = createCrocoPageConfig({ head });

    expect(config.head).toBe(head);
  });

  it("revalidate 옵션 전달 시 revalidateMs 포함 확인", () => {
    const config = createCrocoPageConfig({ revalidate: 60000 });

    expect(config.revalidateMs).toBe(60000);
  });

  it("meta-vite RenderMode 계약과 호환되는 mode를 반환한다", () => {
    const config = createCrocoPageConfig({ ssr: false });
    const mode: RenderMode = config.mode;

    expect(mode).toBe("ssg");
  });

  it("route registration은 meta-vite 경계에 남기고 path를 config에 섞지 않는다", () => {
    const config = createCrocoPageConfig({ path: "/dashboard", ssr: true });

    expect(config.mode).toBe("ssr");
    expect("path" in config).toBe(false);
  });
});
