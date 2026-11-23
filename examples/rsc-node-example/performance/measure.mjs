import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { once } from "node:events";
import { get as httpGet } from "node:http";
import { profile, configurations, assess, summarize } from "./profile.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, "..");
const requireApp = createRequire(join(app, "package.json"));
const requireDocs = createRequire(new URL("../../../packages/docs/package.json", import.meta.url));
const { chromium } = requireDocs("@playwright/test");
const output = process.argv[2]
  ? resolve(process.argv[2])
  : await mkdtemp(join(tmpdir(), "croco-pdp-lab-"));
await mkdir(output, { recursive: true });
const dependencyVersions = Object.fromEntries(
  ["react", "react-dom", "react-server-dom-webpack", "vite", "@vitejs/plugin-rsc"].map((name) => [
    name,
    requireApp(`${name}/package.json`).version,
  ]),
);
async function digestTree(directory, hash = createHash("sha256")) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    hash.update(entry.name);
    if (entry.isDirectory()) await digestTree(join(directory, entry.name), hash);
    else hash.update(await readFile(join(directory, entry.name)));
  }
  return hash;
}
const artifactHash = await digestTree(join(app, "dist"));
await digestTree(join(here, "catalog"), artifactHash);
artifactHash.update(await readFile(join(app, "server.ts")));
artifactHash.update(await readFile(join(here, "profile.mjs")));
const artifactSha256 = artifactHash.digest("hex");
const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: app,
  encoding: "utf8",
}).trim();
for (const name of [
  "meta-vite",
  "cache-core",
  "features-core",
  "frontend-react",
  "storage-cloudflare",
]) {
  const manifest = JSON.parse(
    await readFile(resolve(app, "../../packages", name, "package.json"), "utf8"),
  );
  dependencyVersions[manifest.name] = `${manifest.version}@${sourceRevision}`;
}
const server = spawn(process.execPath, ["dist/server/server.js"], {
  cwd: app,
  env: { ...process.env, NODE_ENV: "production", PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverErrors = "";
server.stderr.on("data", (data) => {
  serverErrors += data;
});
let browser;
let origin;
const results = [];
let report;
try {
  origin = await new Promise((resolveOrigin, reject) => {
    const timeout = setTimeout(
      () => reject(new TypeError(`PDP server startup timeout: ${serverErrors}`)),
      20000,
    );
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new TypeError(`PDP server exited ${code}: ${serverErrors}`));
    });
    server.stdout.on("data", (data) => {
      const match = /http:\/\/127\.0\.0\.1:\d+/.exec(String(data));
      if (match) {
        clearTimeout(timeout);
        resolveOrigin(match[0]);
      }
    });
  });
  const statusFor = (path) =>
    new Promise((resolveStatus, reject) => {
      httpGet(origin, { path }, (response) => {
        response.resume();
        response.on("end", () => resolveStatus(response.statusCode));
      }).on("error", reject);
    });
  const invalidTargetStatus = await statusFor(
    "http://127.0.0.1:9/products/orbit?configuration=baseline",
  );
  assert.equal(
    invalidTargetStatus,
    400,
    "Absolute request targets must not change internal fetch origins",
  );
  assert.equal(
    await statusFor("//127.0.0.1:9/products/orbit?configuration=baseline"),
    404,
    "Network-path targets must stay paths on the server origin, never another origin",
  );
  const clientBuild = JSON.parse(
    await readFile(join(app, "dist/client/croco-rsc-client-build.json"), "utf8"),
  );
  browser = await chromium.launch({ headless: true });
  dependencyVersions.chromium = browser.version();
  dependencyVersions.node = process.version;
  const conditionsBase = {
    profile: profile.id,
    artifactSha256,
    dependencyVersions,
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    network: profile.network,
    cpuSlowdown: profile.cpuSlowdown,
    fixture: "orbit-v1",
    user: "alice",
  };

  async function measure(
    configuration,
    cache,
    repetition,
    {
      fault,
      user = "alice",
      viewport = profile.viewport,
      reset = true,
      warmup = true,
      verifyPrivate = false,
    } = {},
  ) {
    if (reset) await fetch(`${origin}/lab/reset`, { method: "POST" });
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: profile.deviceScaleFactor,
    });
    await context.addCookies([{ name: "lab-user", value: user, url: origin }]);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, ...profile.network });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuSlowdown });
    await page.addInitScript(() => {
      window.pdpLab = { shellMs: null, heroMs: null, lcpMs: null, recommendationMs: null };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.pdpLab.lcpMs = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      const frame = () => {
        const title = document.getElementById("product-title");
        const cta = document.getElementById("trial-cta");
        const hero = document.getElementById("hero");
        if (
          title?.getBoundingClientRect().height &&
          cta?.getBoundingClientRect().height &&
          window.pdpLab.shellMs === null
        )
          window.pdpLab.shellMs = performance.now();
        if (
          hero?.complete &&
          hero.naturalWidth &&
          hero.getBoundingClientRect().height &&
          window.pdpLab.heroMs === null
        )
          window.pdpLab.heroMs = performance.now();
        if (
          document.getElementById("recommendation-content")?.getBoundingClientRect().height &&
          window.pdpLab.recommendationMs === null
        )
          window.pdpLab.recommendationMs = performance.now();
        if (
          window.pdpLab.shellMs === null ||
          window.pdpLab.heroMs === null ||
          window.pdpLab.recommendationMs === null
        )
          requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    if (fault === "js")
      await page.route("**/assets/*.js", async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body: (await response.text()) + "\n" + " ".repeat(400000),
        });
      });
    if (fault === "image")
      await page.route("**/cdn-cgi/**", async (route) => {
        const response = await route.fetch();
        await route.fulfill({ response, body: (await response.text()) + " ".repeat(150000) });
      });
    if (fault === "hydration" || fault === "private")
      await page.route("**/products/orbit?**", async (route) => {
        const response = await route.fetch();
        const html = await response.text();
        await route.fulfill({
          response,
          body:
            fault === "hydration"
              ? html.replace("data-pdp-snapshot=", "data-broken-snapshot=")
              : html.replaceAll("Saved inspiration for alice", "Saved inspiration for bob"),
        });
      });
    const url = `${origin}/products/orbit?configuration=${configuration}${fault === "personalization" || fault === "blocking" || fault === "deferred-blocking" || fault === "image-policy" || fault === "shared-private" ? `&fault=${fault}` : ""}`;
    let initialResponse;
    try {
      if (cache === "warm" && warmup) {
        await page.goto(url);
        await page.waitForFunction(
          () =>
            document.documentElement.dataset.pdpHydrated &&
            document.getElementById("recommendation"),
        );
      }
      initialResponse = await page.goto(url);
      await page.waitForFunction(
        () =>
          document.documentElement.dataset.pdpHydrated &&
          document.getElementById("recommendation") &&
          window.pdpLab.heroMs !== null &&
          window.pdpLab.lcpMs !== null,
      );
      if (configuration === "experiment" || configuration === "combined") {
        await page.waitForFunction(() => document.documentElement.dataset.pdpExposure);
      }
      const state = await page.evaluate(async () => {
        await document.getElementById("hero").decode();
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        const hero = document.getElementById("hero");
        const image = hero.getBoundingClientRect();
        const nav = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        const bytes = (select) =>
          resources.filter(select).reduce((total, r) => total + r.decodedBodySize, 0);
        // The document streams its Flight payload as base64 blocks between HTML chunks.
        const flightBlocks = [
          ...document.querySelectorAll('script[data-croco-rsc-flight="chunk"]'),
        ];
        return {
          ...window.pdpLab,
          hydrationReadyMs: performance.getEntriesByName("pdp:hydrated")[0]?.startTime,
          ttfbMs: nav.responseStart,
          htmlBytes: nav.decodedBodySize,
          flightBytes: flightBlocks.reduce(
            (total, block) => total + atob(JSON.parse(block.textContent)).length,
            0,
          ),
          jsBytes: bytes((r) => new URL(r.name).pathname.endsWith(".js")),
          imageBytes: bytes((r) => new URL(r.name).pathname.startsWith("/cdn-cgi/")),
          wireBytes: nav.transferSize + resources.reduce((total, r) => total + r.transferSize, 0),
          requests: resources.length + 1,
          exposure: document.documentElement.dataset.pdpExposure,
          snapshot: document.querySelector("main").dataset.pdpSnapshot,
          hydratedSnapshot: document.documentElement.dataset.pdpHydrated,
          image: {
            alt: hero.alt,
            width: image.width,
            height: image.height,
            naturalWidth: hero.naturalWidth,
            loading: hero.loading,
            priority: hero.fetchPriority,
            currentSrc: hero.currentSrc,
            sizes: hero.sizes,
            srcset: hero.srcset,
            widthAttribute: hero.getAttribute("width"),
            heightAttribute: hero.getAttribute("height"),
          },
          highPriorityImages: document.querySelectorAll("img[fetchpriority=high]").length,
          lazy: document.querySelector(".gallery img").loading,
          noOverflow: document.documentElement.scrollWidth <= innerWidth,
          recommendation: document.getElementById("recommendation-content").textContent,
          cacheSource: document.getElementById("recommendation").dataset.cacheSource,
          description: document.getElementById("description").textContent,
          experimentCopy: document.querySelector("[data-experiment-copy]").textContent,
          cacheEvents: JSON.parse(document.getElementById("pdp-cache-events").textContent),
          diagnostics: JSON.parse(document.getElementById("pdp-diagnostics").textContent),
        };
      });
      await page.locator("#trial-cta").evaluate((button) => {
        button.addEventListener(
          "click",
          () => {
            const started = performance.now();
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                window.pdpLab.interactionMs = performance.now() - started;
              }),
            );
          },
          { once: true },
        );
      });
      await page.getByRole("button", { name: "Preview this print" }).focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => window.pdpLab.interactionMs !== undefined);
      state.interactionMs = await page.evaluate(() => window.pdpLab.interactionMs);
      const title = await page.getByRole("heading", { level: 1 }).innerText();
      const selected = await page
        .getByRole("button", { name: "Preview this print" })
        .getAttribute("aria-pressed");
      state.correctness =
        initialResponse.status() === 200 &&
        initialResponse.headers()["cache-control"] === "private, no-store" &&
        title === "Orbit art print" &&
        selected === "true" &&
        state.snapshot === state.hydratedSnapshot &&
        state.noOverflow &&
        state.image.naturalWidth > 0 &&
        Math.abs(state.image.width / state.image.height - 4 / 3) < 0.01 &&
        state.image.widthAttribute === "800" &&
        state.image.heightAttribute === "600" &&
        state.image.alt.trim().length > 0 &&
        state.image.sizes === profile.image.sizes &&
        profile.image.widths.every((width) => state.image.srcset.includes(` ${width}w`)) &&
        state.image.loading === "eager" &&
        state.image.priority === "high" &&
        state.highPriorityImages === 1 &&
        state.lazy === "lazy" &&
        errors.length === 0;
      if (configuration === "personalization" || configuration === "combined")
        state.correctness &&=
          fault === "personalization"
            ? state.recommendation.includes("unavailable")
            : state.recommendation.includes(`for ${user}`) &&
              !state.recommendation.includes(`for ${user === "alice" ? "bob" : "alice"}`) &&
              state.cacheSource === (cache === "warm" ? "cache" : "render");
      if (configuration === "experiment" || configuration === "combined")
        state.correctness &&=
          state.exposure === "reported" &&
          JSON.parse(state.snapshot).decision?.status === "assigned" &&
          state.experimentCopy === JSON.parse(state.snapshot).decision?.value;
      state.errors = errors;
      state.conditions = {
        ...conditionsBase,
        user,
        viewport,
        cache,
        repetition,
        content: {
          title,
          description: state.description,
          supportingCopy: state.experimentCopy,
          recommendation: state.recommendation,
        },
      };
      if (verifyPrivate) {
        const html = await initialResponse.text();
        const flightResponse = await fetch(url, {
          headers: {
            accept: "text/x-component",
            "x-croco-rsc-client-manifest": clientBuild.clientManifestVersion,
            cookie: `lab-user=${user}`,
          },
        });
        const flight = await flightResponse.text();
        const isolated = (body) =>
          body.includes(`Saved inspiration for ${user}`) &&
          !body.includes(`Saved inspiration for ${user === "alice" ? "bob" : "alice"}`);
        state.privateRepresentations = {
          html: isolated(html),
          flight:
            flightResponse.status === 200 &&
            isolated(flight) &&
            flightResponse.headers.get("cache-control") === "private, no-store",
        };
        state.correctness &&=
          state.privateRepresentations.html && state.privateRepresentations.flight;
      }
      if (!fault && repetition === 0) {
        state.screenshot = join(output, `${configuration}-${cache}-${viewport.width}.png`);
        await page.screenshot({ path: state.screenshot, fullPage: true });
      }
      return state;
    } finally {
      await context.close();
    }
  }

  for (const configuration of configurations) {
    const measurements = [];
    const budgetResult = [];
    const artifactRef = `${configuration}.json`;
    try {
      for (const cache of ["cold", "warm"])
        for (let repetition = 0; repetition < profile.repetitions; repetition++) {
          const sample = await measure(configuration, cache, repetition);
          const baseline =
            configuration === "baseline"
              ? undefined
              : results[0]?.measurements?.find(
                  (m) => m.conditions.cache === cache && m.conditions.repetition === repetition,
                );
          measurements.push(sample);
          if (configuration !== "baseline")
            assert.ok(baseline, "Comparable baseline sample missing");
          budgetResult.push(assess(sample, baseline));
        }
      const result = {
        configuration,
        state: budgetResult.every((b) => b.state === "passed") ? "passed" : "failed",
        artifactRef,
        sourceRevision,
        dependencyVersions,
        measurements,
        budgetResult,
      };
      results.push(result);
    } catch (error) {
      results.push({
        configuration,
        state: "failed",
        artifactRef,
        sourceRevision,
        dependencyVersions,
        reason: String(error),
        measurements,
        budgetResult,
      });
    }
    await writeFile(join(output, artifactRef), JSON.stringify(results.at(-1), null, 2));
  }
  const baseline = results[0]?.measurements?.[0];
  assert.ok(baseline, "A measured baseline is mandatory");
  const negativeControls = {};
  for (const fault of ["js", "image"]) {
    const sample = await measure("baseline", "cold", 0, { fault });
    const verdict = assess(sample, baseline);
    assert.ok(
      verdict.diagnostics.includes(`PDP_BUDGET_EXCEEDED:${fault}Bytes`),
      `${fault} regression escaped detection`,
    );
    negativeControls[fault] = { sample, verdict };
  }
  const blockingSample = await measure("baseline", "cold", 0, { fault: "blocking" });
  const blockingVerdict = assess(blockingSample, baseline);
  assert.ok(blockingVerdict.diagnostics.includes("PDP_REGRESSION:ttfbMs"));
  negativeControls.blocking = { sample: blockingSample, verdict: blockingVerdict };
  const deferredSample = await measure("combined", "cold", 0, { fault: "deferred-blocking" });
  const deferredVerdict = assess(deferredSample, baseline);
  // A slow optional source delays only the late region: the shell must still
  // hydrate on time, so hydration-ready time is not allowed to regress with it.
  assert.ok(deferredVerdict.diagnostics.includes("PDP_REGRESSION:recommendationMs"));
  assert.ok(
    !deferredVerdict.diagnostics.includes("PDP_REGRESSION:hydrationReadyMs"),
    "A slow optional source must not delay hydration of the critical shell",
  );
  negativeControls.deferredBlocking = { sample: deferredSample, verdict: deferredVerdict };
  for (const fault of ["hydration", "private", "image-policy"]) {
    const sample = await measure("combined", "cold", 0, { fault });
    const verdict = assess(sample, baseline);
    assert.ok(
      verdict.diagnostics.includes("PDP_CORRECTNESS_FAILED"),
      `${fault} incorrectness escaped detection`,
    );
    negativeControls[fault] = { sample, verdict };
  }
  const fallback = await measure("combined", "cold", 0, { fault: "personalization" });
  assert.equal(
    fallback.correctness,
    true,
    "Optional failure must leave the real critical PDP usable",
  );
  async function crossUserSequence(fault) {
    const sequence = [];
    for (const [index, user] of ["alice", "bob", "alice"].entries())
      sequence.push(
        await measure("combined", index === 0 ? "cold" : "warm", 0, {
          user,
          fault,
          reset: index === 0,
          warmup: false,
          verifyPrivate: true,
        }),
      );
    return sequence;
  }
  const crossUser = await crossUserSequence();
  assert.deepEqual(
    crossUser.map((sample) => sample.cacheSource),
    ["render", "cache", "cache"],
  );
  assert.ok(
    crossUser.every((sample) => sample.correctness),
    "Alice → Bob → Alice must reuse public cache while isolating HTML and Flight private values",
  );
  const sharedPrivate = await crossUserSequence("shared-private");
  assert.equal(sharedPrivate[1].cacheSource, "cache");
  assert.equal(
    sharedPrivate[1].correctness,
    false,
    "Shared private cache regression escaped detection",
  );
  assert.deepEqual(sharedPrivate[1].privateRepresentations, { html: false, flight: false });
  negativeControls.sharedPrivate = { sequence: sharedPrivate, detected: true };
  const desktop = await measure("combined", "cold", 0, { viewport: { width: 1280, height: 900 } });
  assert.equal(desktop.correctness, true);
  // Hold the real optional fetch open. Before release the shell must hydrate and
  // the CTA must answer the keyboard; after release the same UI takes the late
  // result without remounting. Ordering is structural: nothing waits on a timer.
  async function heldRecommendation(outcome) {
    await fetch(`${origin}/lab/defer`, { method: "POST" });
    const context = await browser.newContext({ viewport: profile.viewport });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    const flightRequests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.endsWith(".rsc")) flightRequests.push(request.url());
    });
    const navigation = page.goto(`${origin}/products/orbit?configuration=combined`, {
      waitUntil: "load",
    });
    try {
      await page.getByRole("heading", { name: "Orbit art print", exact: true }).waitFor();
      await page.waitForFunction(
        () =>
          document.documentElement.dataset.pdpHydrated &&
          document.documentElement.dataset.pdpExposure,
      );
      const cta = page.getByRole("button", { name: "Preview this print" });
      await cta.focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () => document.getElementById("trial-cta").getAttribute("aria-pressed") === "true",
      );
      const held = {
        recommendations: await page.locator("#recommendation").count(),
        fallbackVisible: await page.getByText("Loading recommendations…").isVisible(),
        status: await page.getByRole("status").innerText(),
        exposure: await page.evaluate(() => document.documentElement.dataset.pdpExposure),
      };
      assert.deepEqual(
        held,
        {
          recommendations: 0,
          fallbackVisible: true,
          status: "Preview selected",
          exposure: "reported",
        },
        "The CTA must work while the recommendation is still held",
      );
      const before = await page.locator("#hero").boundingBox();

      await fetch(
        `${origin}/lab/resume${outcome === "unavailable" ? "?outcome=unavailable" : ""}`,
        { method: "POST" },
      );
      await navigation;
      await page.locator("#recommendation-content").waitFor();
      const released = {
        recommendation: await page.locator("#recommendation-content").innerText(),
        pressed: await cta.getAttribute("aria-pressed"),
        status: await page.getByRole("status").innerText(),
      };
      assert.deepEqual(
        released,
        {
          recommendation:
            outcome === "unavailable"
              ? "Recommendations unavailable"
              : "More orbital studies: Saved inspiration for alice",
          pressed: "true",
          status: "Preview selected",
        },
        "The late result must update the same UI without resetting the CTA",
      );
      assert.deepEqual(
        await page.locator("#hero").boundingBox(),
        before,
        "Deferred content must not shift the hero",
      );
      // Hydration used the Flight bytes written into the document, not a second request.
      const flightRequestsDuringHydration = flightRequests.length;
      assert.equal(flightRequestsDuringHydration, 0);

      if (outcome === "available") {
        const snapshotBeforeRefresh = await page.locator("main").getAttribute("data-pdp-snapshot");
        await page.evaluate(() => {
          delete document.documentElement.dataset.pdpExposure;
        });
        await page.getByRole("button", { name: "Refresh", exact: true }).click();
        await page.waitForFunction(
          (previous) =>
            document.querySelector("main").dataset.pdpSnapshot !== previous &&
            document.querySelector("main").dataset.pdpSnapshot ===
              document.documentElement.dataset.pdpHydrated &&
            document.documentElement.dataset.pdpExposure === "reported",
          snapshotBeforeRefresh,
        );
      }
      assert.deepEqual(errors, []);
      return { outcome, held, released, flightRequestsDuringHydration };
    } finally {
      await fetch(`${origin}/lab/resume`, { method: "POST" });
      await navigation.catch(() => undefined);
      await context.close();
    }
  }
  const earlyInteraction = [
    await heldRecommendation("available"),
    await heldRecommendation("unavailable"),
  ];
  const alice = await measure("combined", "cold", 0);
  const receipt = JSON.parse(alice.snapshot).decision.receipt;
  const exposureBody = JSON.stringify({
    receipt,
    displayInstanceId: randomUUID(),
    occurredAt: new Date().toISOString(),
  });
  const expose = (cookie, body = exposureBody, requestOrigin = origin) =>
    fetch(`${origin}/lab/expose`, {
      method: "POST",
      headers: { origin: requestOrigin, cookie, "content-type": "application/json" },
      body,
    });
  assert.equal((await expose("lab-user=alice")).status, 204);
  assert.equal((await expose("lab-user=bob")).status, 403);
  assert.equal(
    (await expose("lab-user=alice", exposureBody, "https://foreign.invalid")).status,
    403,
  );
  assert.equal((await expose("lab-user=alice", "{}")).status, 400);
  assert.equal((await expose("lab-user=alice", "x".repeat(8193))).status, 413);
  const missing = await fetch(`${origin}/products/missing`);
  assert.equal(missing.status, 404);
  const stale = await fetch(`${origin}/products/orbit.rsc`, {
    headers: { "x-croco-rsc-client-manifest": "stale" },
  });
  assert.equal(stale.status, 400);
  assert.equal(serverErrors, "");
  report = {
    kind: "synthetic-lab",
    sourceRevision,
    artifactSha256,
    profile,
    dependencyVersions,
    results,
    negativeControls,
    correctness: {
      fallback,
      crossUser,
      invalidTargetStatus,
      desktop,
      earlyInteraction,
      exposureStatuses: [204, 403, 403, 400, 413],
      missingStatus: 404,
      staleManifestStatus: 400,
    },
    toolState: results.every((r) => r.state === "passed") ? "passed" : "failed",
    deploymentCertification: "not-performed",
  };
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(output, "report.md"), summarize(results));
  // Same report bytes in the inspector: no second calculation or fabricated values.
  const escape = (text) =>
    text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  await writeFile(
    join(output, "inspector.html"),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PDP lab inspector</title><style>body{font:16px system-ui;max-width:1100px;padding:24px;margin:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>PDP lab inspector</h1><p>Synthetic lab. No field INP or deployment certification.</p><pre>${escape(summarize(results))}</pre><details><summary>Inspect the exact JSON evidence</summary><pre>${escape(JSON.stringify(report, null, 2))}</pre></details></html>`,
  );
  const inspector = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await inspector.goto(pathToFileURL(join(output, "inspector.html")).href);
  for (const row of results)
    assert.ok(
      (await inspector.locator("body").innerText()).includes(`${row.configuration} | ${row.state}`),
    );
  await inspector.getByText("Inspect the exact JSON evidence").click();
  assert.ok((await inspector.locator("details pre").innerText()).includes(artifactSha256));
  await inspector.getByText("Inspect the exact JSON evidence").click();
  assert.equal(
    await inspector.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  );
  await inspector.screenshot({ path: join(output, "inspector.png"), fullPage: true });
  await inspector.close();
  console.log(
    JSON.stringify({
      output,
      state: report.toolState,
      results: results.map(({ configuration, state }) => ({ configuration, state })),
    }),
  );
  assert.equal(report.toolState, "passed", `Inspect ${output}/report.json`);
} catch (error) {
  for (const configuration of configurations)
    if (!results.some((r) => r.configuration === configuration))
      results.push({
        configuration,
        state: "not_run",
        artifactRef: "failure.json",
        dependencyVersions,
        reason: "Execution stopped before this configuration",
      });
  await writeFile(
    join(output, "failure.json"),
    JSON.stringify(
      {
        state: "failed",
        reason: String(error),
        sourceRevision,
        artifactSha256,
        results,
        serverErrors,
      },
      null,
      2,
    ),
  );
  await writeFile(
    join(output, "report.json"),
    JSON.stringify(
      {
        ...report,
        kind: "synthetic-lab",
        toolState: "failed",
        reason: String(error),
        sourceRevision,
        artifactSha256,
        results,
      },
      null,
      2,
    ),
  );
  console.error(`PDP_LAB_FAILED: ${output}/failure.json`);
  throw error;
} finally {
  await browser?.close();
  if (server.exitCode === null && server.signalCode === null) {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    await exited;
  }
}
