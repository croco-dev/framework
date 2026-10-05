import { notFound } from "next/navigation";
import { application } from "../../../server/application";
import { ProductTrials, TrialProblem } from "../../../server/product/ProductTrials";
import type { TrialResult } from "../../../server/product/ProductTrials";
import { requirePageIdentity } from "../../../server/pageIdentity";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await requirePageIdentity();
  const id = (await params).id;
  let result: TrialResult;
  try {
    result = await application.run(() => application.get(ProductTrials).get(identity, id));
  } catch (error) {
    if (error instanceof TrialProblem && error.status === 404) notFound();
    throw error;
  }
  return (
    <main>
      <p className="eyebrow">
        PRIVATE · {identity.userId} · {identity.tenantId}
      </p>
      <h1>{result.title}</h1>
      <p className="lead">For {result.audience}</p>
      <section className="card">
        <h2>Your launch brief</h2>
        <p className="brief">{result.brief}</p>
        <p className="note">Saved {result.createdAt}</p>
        <p>
          Committed event: <code>{result.eventId}</code>
        </p>
        <p>
          Request correlation: <code>{result.correlationId}</code>
        </p>
      </section>
      <a href="/try">Create another brief</a>
    </main>
  );
}
