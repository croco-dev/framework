import "reflect-metadata";
import { Problem } from "@croco/problems-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGuard } from "../libs/guards/AuthGuard";
import type { ExecutionContext } from "../libs/interfaces/ExecutionContext";

type TokenVerifier = (token: string) => Promise<unknown> | unknown;

describe("AuthGuard", () => {
  let mockVerifier!: ReturnType<typeof vi.fn>;
  let guard!: AuthGuard;
  let mockContext!: ExecutionContext;

  beforeEach(() => {
    mockVerifier = vi.fn();
    guard = new AuthGuard({ verifier: mockVerifier as TokenVerifier });

    mockContext = {
      getRequest: vi.fn().mockReturnValue({
        headers: {},
      }),
      getClass: vi.fn(),
      getHandler: vi.fn(),
      getPath: vi.fn(),
      getMethod: vi.fn(),
    } as unknown as ExecutionContext;
  });

  it("should allow access with valid token", async () => {
    const mockRequest = { headers: { authorization: "Bearer valid-token" }, user: undefined };
    (mockVerifier as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "123", name: "Test User" });
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockRequest.user).toEqual({ id: "123", name: "Test User" });
    expect(mockVerifier).toHaveBeenCalledWith("valid-token");
  });

  it("should deny access without Authorization header", async () => {
    mockContext.getRequest = vi.fn().mockReturnValue({ headers: {} });

    await expect(guard.canActivate(mockContext)).rejects.toBeInstanceOf(Problem);
    await expect(guard.canActivate(mockContext)).rejects.toThrow("Missing authorization header");
    await expect(guard.canActivate(mockContext)).rejects.toMatchObject({
      status: 401,
      code: "protocols-rest/auth-missing-header",
    });
    expect(mockVerifier).not.toHaveBeenCalled();
  });

  it("should deny access when request headers are unavailable", async () => {
    mockContext.getRequest = vi.fn().mockReturnValue(null);

    await expect(guard.canActivate(mockContext)).rejects.toMatchObject({
      status: 400,
      code: "protocols-rest/auth-invalid-request",
    });
    expect(mockVerifier).not.toHaveBeenCalled();
  });

  it("should deny access with invalid token", async () => {
    const mockRequest = { headers: { authorization: "Bearer invalid-token" } };
    const tokenError = Object.assign(new Error("Token expired"), { name: "ERR_JWT_EXPIRED" });
    (mockVerifier as ReturnType<typeof vi.fn>).mockRejectedValue(tokenError);
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    await expect(guard.canActivate(mockContext)).rejects.toThrow("Invalid or expired token");
    await expect(guard.canActivate(mockContext)).rejects.toMatchObject({
      status: 401,
      code: "protocols-rest/auth-invalid-token",
    });
    expect(mockVerifier).toHaveBeenCalledWith("invalid-token");
  });

  it("should surface verifier outages separately from invalid tokens", async () => {
    const mockRequest = { headers: { authorization: "Bearer service-token" } };
    (mockVerifier as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ECONNRESET"));
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      "Authentication verifier is unavailable",
    );
    await expect(guard.canActivate(mockContext)).rejects.toMatchObject({
      status: 500,
      code: "protocols-rest/auth-verifier-unavailable",
    });
  });

  it("should extract Bearer token correctly", async () => {
    const mockRequest = { headers: { authorization: "Bearer my-token" } };
    (mockVerifier as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "456" });
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockVerifier).toHaveBeenCalledWith("my-token");
  });

  it("should deny access with malformed token (no scheme)", async () => {
    const mockRequest = { headers: { authorization: "just-a-token" } };
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      "Invalid authorization header format",
    );
    await expect(guard.canActivate(mockContext)).rejects.toMatchObject({
      status: 400,
      code: "protocols-rest/auth-invalid-header-format",
    });
  });

  it("should deny access with wrong scheme", async () => {
    const mockRequest = { headers: { authorization: "Basic token" } };
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      "Invalid authorization header format",
    );
    await expect(guard.canActivate(mockContext)).rejects.toMatchObject({
      status: 400,
      code: "protocols-rest/auth-invalid-header-format",
    });
  });

  it("should use custom header name", async () => {
    const customVerifier = vi.fn();
    const customGuard = new AuthGuard({
      verifier: customVerifier as TokenVerifier,
      headerName: "x-auth-token",
    });
    const mockRequest = { headers: { "x-auth-token": "Bearer custom-token" }, user: undefined };
    (customVerifier as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "789" });
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    const result = await customGuard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(customVerifier).toHaveBeenCalledWith("custom-token");
  });

  it("should use custom scheme", async () => {
    const customVerifier = vi.fn();
    const customGuard = new AuthGuard({
      verifier: customVerifier as TokenVerifier,
      scheme: "Token",
    });
    const mockRequest = { headers: { authorization: "Token my-custom-token" }, user: undefined };
    (customVerifier as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "999" });
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    const result = await customGuard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(customVerifier).toHaveBeenCalledWith("my-custom-token");
  });

  it("should handle case-insensitive scheme matching", async () => {
    const mockRequest = { headers: { authorization: "bearer my-token" }, user: undefined };
    (mockVerifier as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "111" });
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockVerifier).toHaveBeenCalledWith("my-token");
  });

  it("should read authorization from Headers object", async () => {
    const request = new Request("https://example.com/protected", {
      headers: new Headers({ authorization: "Bearer headers-token" }),
    }) as unknown as { headers: Headers; user?: unknown };

    (mockVerifier as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "headers-user" });
    mockContext.getRequest = vi.fn().mockReturnValue(request);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockVerifier).toHaveBeenCalledWith("headers-token");
    expect(request.user).toEqual({ id: "headers-user" });
  });

  it("should deny access if verifier returns falsy value", async () => {
    const mockRequest = { headers: { authorization: "Bearer token" }, user: undefined };
    (mockVerifier as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    await expect(guard.canActivate(mockContext)).rejects.toThrow("Invalid or expired token");
    expect(mockRequest.user).toBeUndefined();
  });
});
