import { gql } from "@apollo/client";
import { describe, expect, it, vi } from "vitest";
import { createApolloSession, serializeApolloHydration } from "../apollo";

const query = gql`
  query Product($variant: String!) {
    product {
      __typename
      id
      quote(variant: $variant) {
        __typename
        amount
      }
    }
  }
`;
const options = {
  endpoint: "https://api.example/graphql",
  allowedOrigins: ["https://api.example"],
  owner: "owner-a",
  ssr: true,
  ownership: "client" as const,
};
const data = (amount: string) => ({
  product: { __typename: "Product", id: "p1", quote: { __typename: "Quote", amount } },
});

describe("ApolloSession", () => {
  it("restores native read policies without applying them twice during hydration", () => {
    const policy = {
      typePolicies: { Quote: { fields: { amount: { read: (value: string) => `$${value}` } } } },
    };
    const server = createApolloSession({ ...options, cache: policy });
    server.client.writeQuery({ query, variables: { variant: "member" }, data: data("17.00") });
    const hydration = server.extract();
    const browser = createApolloSession({ ...options, ssr: false, cache: policy, hydration });
    expect(browser.client.readQuery({ query, variables: { variant: "member" } })).toEqual(
      data("$17.00"),
    );
    server.dispose();
    browser.dispose();
  });
  it("keeps partial errors visible and refuses to hydrate their cached nulls as success", async () => {
    const session = createApolloSession({
      ...options,
      fetch: async () =>
        Response.json({
          data: { product: null },
          errors: [{ message: "permission denied", path: ["product"] }],
        }),
    });
    const result = await session.client.query({
      query,
      variables: { variant: "member" },
      errorPolicy: "all",
    });
    expect(result.data).toEqual({ product: null });
    expect(result.error).toBeDefined();
    expect(() => session.extract()).toThrow("failed operations");
    session.dispose();
  });
  it("keeps private requests separate and preserves native entity normalization and argument keys", () => {
    const a = createApolloSession(options);
    const b = createApolloSession({ ...options, owner: "owner-b" });
    a.client.writeQuery({ query, variables: { variant: "member" }, data: data("17.00") });
    a.client.writeQuery({ query, variables: { variant: "standard" }, data: data("26.00") });
    b.client.writeQuery({ query, variables: { variant: "member" }, data: data("31.00") });
    expect(a.client.readQuery({ query, variables: { variant: "member" } })).toEqual(data("17.00"));
    expect(a.client.readQuery({ query, variables: { variant: "standard" } })).toEqual(
      data("26.00"),
    );
    expect(b.client.readQuery({ query, variables: { variant: "member" } })).toEqual(data("31.00"));
    expect(a.client.cache.extract()).toHaveProperty("Product:p1");
    a.dispose();
    b.dispose();
  });

  it("hydrates only client-owned cache, escapes script terminators, and rejects stale owners", () => {
    const server = createApolloSession(options);
    const secret = gql`
      query Secret {
        serverOnly
      }
    `;
    server.client.writeQuery({
      query,
      variables: { variant: "member" },
      data: data("</script><script>secret</script>"),
    });
    const serverOnly = createApolloSession({ ...options, ownership: "server" });
    serverOnly.client.writeQuery({ query: secret, data: { serverOnly: "do-not-ship" } });
    expect(() => serverOnly.extract()).toThrow("Server-only owners");
    const state = server.extract();
    expect(state).not.toContain("<");
    expect(state).not.toContain("do-not-ship");
    const browser = createApolloSession({ ...options, ssr: false, hydration: state });
    expect(browser.client.readQuery({ query, variables: { variant: "member" } })).toEqual(
      data("</script><script>secret</script>"),
    );
    expect(browser.client.readQuery({ query: secret })).toBeNull();
    expect(() =>
      createApolloSession({ ...options, ownership: "server", hydration: state }),
    ).toThrow("Server-only owners");
    serverOnly.dispose();
    expect(() => createApolloSession({ ...options, owner: "owner-b", hydration: state })).toThrow(
      "another cache owner",
    );
    server.dispose();
    browser.dispose();
  });

  it("rejects server objects, accessors, cycles and prototype keys", () => {
    const server = createApolloSession(options);
    for (const value of [
      new Date(),
      { token: undefined },
      { value: Infinity },
      JSON.parse('{"__proto__":{}}'),
    ]) {
      expect(() => serializeApolloHydration(value)).toThrow();
    }
    const getter = vi.fn(() => "secret");
    expect(() =>
      serializeApolloHydration(
        Object.defineProperty({}, "token", { get: getter, enumerable: true }),
      ),
    ).toThrow();
    expect(getter).not.toHaveBeenCalled();
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => serializeApolloHydration(cycle)).toThrow();
    server.dispose();
  });

  it("retains application field policies for native pagination", () => {
    const session = createApolloSession({
      ...options,
      cache: {
        typePolicies: {
          Query: {
            fields: {
              items: {
                keyArgs: false,
                merge: (previous = [], incoming: unknown[]) => [...previous, ...incoming],
              },
            },
          },
        },
      },
    });
    const items = gql`
      query Items($offset: Int!) {
        items(offset: $offset)
      }
    `;
    session.client.writeQuery({ query: items, variables: { offset: 0 }, data: { items: ["one"] } });
    session.client.writeQuery({ query: items, variables: { offset: 1 }, data: { items: ["two"] } });
    expect(session.client.readQuery({ query: items, variables: { offset: 0 } })).toEqual({
      items: ["one", "two"],
    });
    const browser = createApolloSession({
      ...options,
      ssr: false,
      cache: {
        typePolicies: {
          Query: {
            fields: {
              items: {
                keyArgs: false,
                merge: (previous = [], incoming: unknown[]) => [...previous, ...incoming],
              },
            },
          },
        },
      },
      hydration: session.extract(),
    });
    expect(browser.client.readQuery({ query: items, variables: { offset: 0 } })).toEqual({
      items: ["one", "two"],
    });
    browser.dispose();
    session.dispose();
  });

  it("fixes credential destination and identity even when operation context tries to override them", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const transport: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ data: data("17.00") });
    };
    expect(() =>
      createApolloSession({ ...options, endpoint: "https://evil.example/graphql" }),
    ).toThrow();
    const session = createApolloSession({
      ...options,
      headers: { authorization: "Bearer server-secret", "x-tenant-id": "tenant-a" },
      fetch: transport,
    });
    await session.client.query({
      query,
      variables: { variant: "member" },
      context: {
        headers: {
          authorization: "Bearer attacker",
          cookie: "attacker",
          "x-tenant-id": "tenant-b",
        },
        fetchOptions: { redirect: "follow", credentials: "include" },
      },
    });
    expect(new Headers(calls[0].init?.headers).get("authorization")).toBe("Bearer server-secret");
    expect(new Headers(calls[0].init?.headers).get("cookie")).toBeNull();
    expect(new Headers(calls[0].init?.headers).get("x-tenant-id")).toBe("tenant-a");
    expect(calls[0].init?.redirect).toBe("error");
    expect(calls[0].init?.credentials).toBe("omit");
    await expect(
      session.client.query({
        query,
        variables: { variant: "standard" },
        context: { uri: "https://evil.example/graphql" },
      }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(1);
    session.dispose();
  });

  it("rejects redirect responses rather than sending credentials to their destination", async () => {
    const transport = vi.fn<typeof fetch>(async () => {
      throw new TypeError("redirect rejected");
    });
    const session = createApolloSession({ ...options, fetch: transport });
    await expect(session.client.query({ query, variables: { variant: "member" } })).rejects.toThrow(
      "redirect rejected",
    );
    expect(transport.mock.calls[0][1]?.redirect).toBe("error");
    session.dispose();
  });

  it("fences a delayed old response during login or tenant transition, even if a transport ignores abort", async () => {
    let finish: (value: Response) => void = () => {
      throw new Error("not started");
    };
    let started: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const old = createApolloSession({
      ...options,
      fetch: async () => {
        started();
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      },
    });
    const result = old.client.query({ query, variables: { variant: "member" } }).then(
      () => "success",
      () => "cancelled",
    );
    await ready;
    old.dispose();
    const next = createApolloSession({ ...options, owner: "owner-b" });
    next.client.writeQuery({ query, variables: { variant: "member" }, data: data("31.00") });
    finish(Response.json({ data: data("17.00") }));
    expect(await result).toBe("cancelled");
    expect(old.client.cache.extract()).toEqual({});
    expect(next.client.readQuery({ query, variables: { variant: "member" } })).toEqual(
      data("31.00"),
    );
    expect(() => old.extract()).toThrow("disposed");
    next.dispose();
  });
});
