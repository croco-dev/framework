import { beforeEach, describe, expect, it, vi } from "vitest";
import { FcmProvider } from "../index";

const firebase = vi.hoisted(() => ({
  applicationDefault: vi.fn(),
  cert: vi.fn(),
  initializeApp: vi.fn(),
  deleteApp: vi.fn(),
  getMessaging: vi.fn(),
}));
vi.mock("firebase-admin/app", () => firebase);
vi.mock("firebase-admin/messaging", () => ({ getMessaging: firebase.getMessaging }));

describe("FcmProvider Firebase app lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    firebase.applicationDefault.mockReturnValue({ fixture: "credential" });
    firebase.cert.mockReturnValue({ fixture: "certificate" });
    firebase.initializeApp.mockReturnValue({ fixture: "app" });
    firebase.getMessaging.mockReturnValue({ send: vi.fn().mockResolvedValue("accepted") });
    firebase.deleteApp.mockResolvedValue(undefined);
  });

  it("creates and disposes its own isolated Firebase app", async () => {
    const provider = new FcmProvider({
      projectId: "fixture-project",
      credential: { type: "application-default" },
    });
    expect(firebase.initializeApp).toHaveBeenCalledWith(
      { projectId: "fixture-project", credential: { fixture: "credential" } },
      expect.stringMatching(/^croco-fcm-/),
    );
    await provider.close();
    expect(firebase.deleteApp).toHaveBeenCalledWith({ fixture: "app" });
  });

  it("maps canonical fields inside the Firebase SDK boundary", async () => {
    const provider = new FcmProvider({
      projectId: "fixture-project",
      credential: { type: "application-default" },
    });
    const send = firebase.getMessaging.mock.results[0].value.send;
    await provider.send({
      to: "[redacted-token]",
      content: "Body",
      push: {
        title: "Title",
        body: "Body",
        deepLink: "app://inbox",
        data: { key: "value" },
        imageUrl: "https://example.test/image.png",
        ttlSeconds: 0,
        priority: "high",
        collapseKey: "inbox",
      },
    });
    expect(send).toHaveBeenCalledExactlyOnceWith({
      token: "[redacted-token]",
      notification: { title: "Title", body: "Body", imageUrl: "https://example.test/image.png" },
      data: { key: "value", deepLink: "app://inbox" },
      android: { ttl: 0, priority: "high", collapseKey: "inbox" },
      apns: {
        headers: { "apns-expiration": "0", "apns-priority": "10", "apns-collapse-id": "inbox" },
      },
      webpush: { headers: { TTL: "0", Urgency: "high" }, notification: { tag: "inbox" } },
    });
  });

  it("converts a positive TTL to platform units", async () => {
    const provider = new FcmProvider({
      projectId: "fixture-project",
      credential: { type: "application-default" },
    });
    const now = vi.spyOn(Date, "now").mockReturnValue(1000000);
    try {
      await provider.send({
        to: "[redacted-token]",
        content: "Body",
        push: { title: "Title", body: "Body", ttlSeconds: 60, priority: "normal" },
      });
      expect(firebase.getMessaging.mock.results[0].value.send).toHaveBeenCalledWith(
        expect.objectContaining({
          android: { ttl: 60000, priority: "normal" },
          apns: { headers: { "apns-expiration": "1060", "apns-priority": "5" } },
          webpush: { headers: { TTL: "60", Urgency: "normal" } },
        }),
      );
    } finally {
      now.mockRestore();
    }
  });

  it("passes explicit service-account config to Firebase without exposing its errors", () => {
    const config = {
      projectId: "fixture-project",
      credential: {
        type: "service-account" as const,
        clientEmail: "fixture@example.test",
        privateKey: "[redacted-private-key]",
      },
    };
    firebase.cert.mockImplementation(() => {
      throw new Error(config.credential.privateKey);
    });
    expect(() => new FcmProvider(config)).toThrow("FCM configuration failed: configuration");
    expect(firebase.initializeApp).not.toHaveBeenCalled();
  });

  it("leaves injected client lifecycle with the caller", async () => {
    const provider = new FcmProvider(
      { projectId: "fixture-project", credential: { type: "application-default" } },
      { send: vi.fn() },
    );
    await provider.close();
    expect(firebase.initializeApp).not.toHaveBeenCalled();
    expect(firebase.deleteApp).not.toHaveBeenCalled();
  });
});
