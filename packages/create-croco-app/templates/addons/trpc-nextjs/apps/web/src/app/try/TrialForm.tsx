"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../server/routers";

const client = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});

function Form() {
  const [commandId, setCommandId] = useState<string>();
  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof client.product.create.mutate>[0]) =>
      client.product.create.mutate(input),
  });
  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const key = commandId ?? crypto.randomUUID();
        setCommandId(key);
        mutation.mutate({
          commandId: key,
          title: String(data.get("title")),
          audience: String(data.get("audience")),
        });
      }}
    >
      <label htmlFor="title">Your idea</label>
      <input
        id="title"
        name="title"
        maxLength={100}
        required
        placeholder="A neighborhood repair club"
      />
      <label htmlFor="audience">Who is it for?</label>
      <input
        id="audience"
        name="audience"
        maxLength={160}
        required
        placeholder="Neighbors who want to mend and share"
      />
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving your brief…" : "Create private brief"}
      </button>
      {mutation.isError ? (
        <div role="alert">
          <p>{mutation.error.message}</p>
          <p>
            Retry with the same inputs to check this command. To change the idea, start a new
            command.
          </p>
          <button
            type="button"
            onClick={() => {
              setCommandId(undefined);
              mutation.reset();
            }}
          >
            Start a new command
          </button>
        </div>
      ) : null}
      {mutation.data ? (
        <section aria-live="polite" aria-atomic="true">
          <h2>Brief saved.</h2>
          <p>
            Committed event: <code>{mutation.data.eventId}</code>
          </p>
          <p>
            Request correlation: <code>{mutation.data.correlationId}</code>
          </p>
          <p>Observation: {mutation.data.observation}. The saved result remains available.</p>
          <a className="button" href={`/results/${encodeURIComponent(mutation.data.id)}`}>
            Open private result
          </a>
        </section>
      ) : null}
    </form>
  );
}

export function TrialForm() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <Form />
    </QueryClientProvider>
  );
}
