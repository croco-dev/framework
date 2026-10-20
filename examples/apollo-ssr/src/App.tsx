import { useFragment, useMutation, useQuery } from "@apollo/client/react";
import {
  DiscountDocument,
  ProductCardFragmentDoc,
  ProductDetailDocument,
} from "./generated/graphql";

export function App({ onSwitch }: { onSwitch?: (target: "bob" | "south") => void }) {
  const { data, error, loading } = useQuery(ProductDetailDocument, {
    variables: { id: "p1", variant: "member" },
    fetchPolicy: "cache-first",
    errorPolicy: "all",
  });
  const [discount, mutation] = useMutation(DiscountDocument, {
    refetchQueries: [ProductDetailDocument],
    awaitRefetchQueries: true,
  });
  return (
    <main style={{ maxWidth: 560, padding: 24, margin: "auto", fontFamily: "system-ui" }}>
      <h1>Request-owned Apollo cache</h1>
      <p>Native queries, fragments and mutations</p>
      {loading ? <p role="status">Loading product…</p> : null}
      {error ? <p role="alert">Query failed: {error.message}</p> : null}
      {data?.product ? (
        <section>
          <ProductCard id={data.product.id} />
          <p>
            Member price:{" "}
            <strong data-testid="price">{data.product.quote?.amount ?? "Unavailable"}</strong>
          </p>
        </section>
      ) : null}
      <button
        disabled={mutation.loading || !data?.product}
        onClick={() => {
          void discount({ variables: { id: "p1", variant: "member" } }).catch(() => undefined);
        }}
      >
        Apply discount
      </button>
      {mutation.error ? <p role="alert">Discount failed: {mutation.error.message}</p> : null}
      <button onClick={() => onSwitch?.("bob")} style={{ marginLeft: 12 }}>
        Switch to Bob
      </button>
      <button onClick={() => onSwitch?.("south")}>Switch tenant</button>
    </main>
  );
}
function ProductCard({ id }: { id: string }) {
  const { data, complete } = useFragment({
    fragment: ProductCardFragmentDoc,
    from: { __typename: "Product", id },
  });
  return <h2>{complete ? data.name : "Product unavailable"}</h2>;
}
