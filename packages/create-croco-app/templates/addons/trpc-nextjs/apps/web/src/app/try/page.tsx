import { requirePageIdentity } from "../../server/pageIdentity";
import { TrialForm } from "./TrialForm";

export const dynamic = "force-dynamic";

export default async function TryPage() {
  const identity = await requirePageIdentity();
  return (
    <main>
      <p className="eyebrow">
        {identity.userId} · {identity.tenantId}
      </p>
      <h1>Give your idea a direction.</h1>
      <p className="lead">Your inputs become a saved, private launch brief.</p>
      <TrialForm />
      <a href="/sign-in">Switch test workspace</a>
    </main>
  );
}
