const { createServer } = require("node:http");
const { CancellationService } = require("@croco/billing-core");

// Real cancellation service and atomic in-memory CAS; provider and authority are
// credential-free boundaries. No request reaches a billing provider or database.
async function startCancellationFlowServer() {
  const contexts = new Map();
  let generation = 0;
  const server = createServer(async (request, response) => {
    const send = (value, status = 200) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(value));
    };
    try {
      if (request.url === "/") {
        response.writeHead(200, { "Content-Type": "text/html" });
        response.end('<div id="root"></div>');
        return;
      }
      if (request.url === "/favicon.ico") {
        response.writeHead(204).end();
        return;
      }
      if (request.url === "/create") {
        const id = String(++generation);
        const context = createContext();
        contexts.set(id, context);
        send(await context.service.createSession(context.identity, id));
        return;
      }
      const [, operation, id] = request.url.split("/");
      const context = contexts.get(id);
      if (!context) {
        send({ error: "unknown fixture" }, 404);
        return;
      }
      if (operation === "display") {
        await context.snapshotEntered;
        const result = await context.service.markDisplayed(context.identity, id);
        context.releaseSnapshot();
        send(result);
      } else if (operation === "decide") {
        let body = "";
        for await (const chunk of request) body += chunk;
        context.gateSnapshot = true;
        send(await context.service.decide(context.identity, id, JSON.parse(body)));
      } else if (operation === "state") {
        send({ session: context.current(), executions: context.executions });
      } else send({ error: "unknown operation" }, 404);
    } catch (error) {
      send({ error: error instanceof Error ? error.name : "unknown failure" }, 409);
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

function createContext() {
  let session;
  let entered;
  let released;
  const snapshotEntered = new Promise((resolve) => {
    entered = resolve;
  });
  const displaySaved = new Promise((resolve) => {
    released = resolve;
  });
  const identity = {
    appId: "app",
    environment: "test",
    tenantId: "tenant",
    subject: "member",
    subscriptionRef: "subscription",
  };
  const snapshot = {
    ...identity,
    revision: "r1",
    subscriptionStartedAt: "2025-01-01T00:00:00Z",
    status: "active",
    billingPeriod: "renewal",
    quote: {
      ref: "quote",
      expiresAt: "2099-01-01T00:00:00Z",
      refund: "partial",
      amount: "1250",
      currency: "USD",
    },
  };
  const context = {
    identity,
    executions: 0,
    gateSnapshot: false,
    snapshotEntered,
    releaseSnapshot: () => released(),
    current: () => structuredClone(session),
  };
  const store = {
    async createSession(value) {
      session = structuredClone(value);
    },
    async getSession() {
      return structuredClone(session);
    },
    async saveSession(value, revision) {
      if (session.revision !== revision) return false;
      session = structuredClone(value);
      return true;
    },
    async getPolicy() {
      return {
        ...identity,
        version: 1,
        entries: [
          {
            choiceId: "lower",
            label: "Lower plan",
            order: 1,
            enabled: true,
            billingPeriods: ["renewal"],
            refundKinds: ["partial"],
          },
        ],
      };
    },
    async savePolicy(value) {
      return value;
    },
    async listSessions() {
      return [structuredClone(session)];
    },
  };
  context.service = new CancellationService({
    store,
    authority: {
      async authorize() {},
      async authorizePolicy() {},
      async snapshot() {
        if (context.gateSnapshot) {
          context.gateSnapshot = false;
          entered();
          await displaySaved;
        }
        return structuredClone(snapshot);
      },
      async admit(_identity, _snapshot, operation) {
        return operation();
      },
    },
    choices: [
      {
        id: "lower",
        action: "change-plan",
        label: "Lower plan",
        consequence: "Lower monthly charge.",
      },
    ],
    actions: [
      {
        kind: "cancel",
        available: () => true,
        async execute({ commandId }) {
          context.executions++;
          return {
            commandId,
            providerOutcome: "confirmed",
            effect: "cancellation_scheduled",
            refundOutcome: "not_requested",
          };
        },
        async lookup({ commandId }) {
          return {
            commandId,
            providerOutcome: "confirmed",
            effect: "cancellation_scheduled",
            refundOutcome: "not_requested",
          };
        },
      },
    ],
  });
  return context;
}
module.exports = { startCancellationFlowServer };
