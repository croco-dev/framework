import { notFound } from "next/navigation";
import { PRODUCT } from "../../../server/product/ProductTrials";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  if ((await params).id !== PRODUCT.id) notFound();
  return (
    <main>
      <p className="eyebrow">FROM IDEA TO A CLEAR FIRST STEP</p>
      <h1>
        A launch brief.
        <br />
        Built around your idea.
      </h1>
      <p className="lead">{PRODUCT.description}</p>
      <div className="card">
        <p className="eyebrow">{PRODUCT.title}</p>
        <h2>Start with your audience.</h2>
        <p>Name your idea and who it helps. Generate a brief you can return to privately.</p>
        <a className="button" href="/sign-in">
          Try the template
        </a>
        <p className="note">
          Free synthetic exercise. Your result is stored locally, without an external account.
        </p>
      </div>
    </main>
  );
}
