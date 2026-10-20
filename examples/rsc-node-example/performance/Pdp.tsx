import React, { Suspense } from "react";
import PdpClient from "./PdpClient";
import { imagePath, loadPdp } from "./runtime";
import { profile } from "./profile.mjs";

async function Recommendation({ value }: { value: ReturnType<typeof loadPdp> }) {
  const data = await value;
  const result = await data.deferred;
  return (
    <section id="recommendation" aria-label="Recommendations" data-cache-source={result.source}>
      <h2>Keep exploring</h2>
      <p id="recommendation-content">{result.text}</p>
      <script
        id="pdp-cache-events"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data.inspect).replace(/</g, "\\u003c") }}
      />
    </section>
  );
}
export async function productPage(request: Request) {
  const dataPromise = loadPdp(request);
  const data = await dataPromise;
  const snapshot = JSON.stringify({ user: data.user, decision: data.decision ?? null });
  const widths = profile.image.widths;
  const imageSizes =
    new URL(request.url).searchParams.get("fault") === "image-policy"
      ? undefined
      : profile.image.sizes;
  return {
    data,
    node: (
      <main data-pdp-snapshot={snapshot}>
        <style>{`*{box-sizing:border-box}body{margin:0;background:#f7f4ed;color:#25332e;font:17px/1.55 system-ui}main{max-width:1100px;margin:auto;padding:32px 24px}nav{font-size:14px;margin-bottom:28px}h1{font-size:clamp(32px,5vw,58px);line-height:1.08;margin:12px 0 20px}.product{display:grid;grid-template-columns:1.1fr 1fr;gap:40px;align-items:center}.product img{width:100%;height:auto;display:block;border-radius:8px}button{font:inherit;padding:14px 24px;border:0;border-radius:5px;background:#254d3c;color:white;cursor:pointer}button:focus-visible{outline:3px solid #b77825;outline-offset:4px}#late-region{min-height:140px;margin-top:36px;border-top:1px solid #ccc;padding-top:20px}.gallery{margin-top:48px}.details{max-width:60ch;margin-top:48px}.gallery img{width:240px;max-width:100%;height:auto}@media(max-width:650px){main{padding:24px 20px}.product{grid-template-columns:1fr;gap:20px}}`}</style>
        <button type="button" data-testid="refresh">
          Refresh
        </button>
        <nav aria-label="Breadcrumb">Studio / Prints / Orbit</nav>
        <div className="product">
          <img
            id="hero"
            alt="Indigo orbital paths on warm ivory paper"
            width={profile.image.width}
            height={profile.image.height}
            sizes={imageSizes}
            src={imagePath(800)}
            srcSet={widths.map((w) => `${imagePath(w)} ${w}w`).join(", ")}
            fetchPriority="high"
            loading="eager"
          />
          <div>
            <p>THE ORBIT COLLECTION · SYNTHETIC LAB FIXTURE</p>
            <h1 id="product-title">{data.title}</h1>
            <p id="description">{data.description}</p>
            <PdpClient snapshot={snapshot} decision={data.decision} />
          </div>
        </div>
        <div id="late-region">
          <Suspense fallback={<p>Loading recommendations…</p>}>
            <Recommendation value={dataPromise} />
          </Suspense>
        </div>
        <section className="details" aria-label="Print details">
          <h2>Made for a quiet corner</h2>
          <p>
            The Orbit collection studies a single idea: paths that cross without losing their shape.
            The indigo lines and warm central point are drawn on an ivory field.
          </p>
          <h2>Paper and presentation</h2>
          <p>
            This synthetic product fixture describes a 40 × 30 cm unframed print on textured paper.
            A frame is not included. The preview keeps the artwork proportions visible on every
            screen.
          </p>
          <h2>Care for the print</h2>
          <p>
            Display away from direct sunlight and moisture. Handle with clean, dry hands and support
            the paper from underneath. Packaging and delivery details belong to the application’s
            current product facts.
          </p>
        </section>
        <section className="gallery" aria-label="Paper detail">
          <img
            alt="Detail of the orbital print"
            width={400}
            height={300}
            loading="lazy"
            src={imagePath(400)}
          />
        </section>
        <script
          type="application/json"
          id="pdp-diagnostics"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              publicReads: data.publicReads,
              serverMs: data.serverMs,
            }).replace(/</g, "\\u003c"),
          }}
        />
      </main>
    ),
  };
}
