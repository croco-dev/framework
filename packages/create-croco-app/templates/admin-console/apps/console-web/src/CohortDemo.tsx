import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { CohortBuilder } from "@croco/admin-react";
import type { CohortAdminPreview, CohortAdminHistory, CohortBuilderState } from "@croco/admin-core";
import type { CohortDefinition, CohortRegistration } from "@croco/cohort-core";

type Configuration = {
  definition: CohortDefinition;
  registration: CohortRegistration;
  asOf: string;
  history: readonly CohortAdminHistory[];
};
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/cohort-demo${path}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  if (!response.ok) {
    const problem = (await response.json()) as { code: string };
    throw Object.assign(new Error("Cohort request failed"), { code: problem.code });
  }
  return response.json() as Promise<T>;
}
export function CohortDemo() {
  const [configuration, setConfiguration] = useState<Configuration>();
  const [state, setState] = useState<CohortBuilderState>({ kind: "loading" });
  useEffect(() => {
    void request<Configuration>("")
      .then((value) => {
        setConfiguration(value);
        setState({ kind: "ready", history: value.history });
      })
      .catch(() => setState({ kind: "failed", code: "COHORT_DEMO_UNAVAILABLE" }));
  }, []);
  if (!configuration)
    return (
      <p role={state.kind === "failed" ? "alert" : "status"}>
        {state.kind === "failed" ? state.code : "Loading cohort demo…"}
      </p>
    );
  const onPreview: NonNullable<ComponentProps<typeof CohortBuilder>["onPreview"]> = async (
    input,
  ) => {
    const preview = await request<CohortAdminPreview>("/preview", input);
    setState((current) => ({
      kind: "ready",
      preview,
      history: current.kind === "ready" ? current.history : [],
    }));
  };
  const onPublish: NonNullable<ComponentProps<typeof CohortBuilder>["onPublish"]> = async (
    input,
  ) => {
    const publication = await request<CohortAdminHistory>("/publish", input);
    setState((current) => ({
      kind: "ready",
      preview: current.kind === "ready" ? current.preview : undefined,
      history: [
        publication,
        ...(current.kind === "ready"
          ? current.history.filter(
              (entry) => entry.snapshot.snapshotId !== publication.snapshot.snapshotId,
            )
          : []),
      ],
    }));
  };
  return (
    <>
      <p>
        Synthetic local source · server evaluation · published membership consumed through
        AudienceSource. Demo data resets on restart.
      </p>
      <CohortBuilder
        definition={configuration.definition}
        registration={configuration.registration}
        asOf={configuration.asOf}
        state={state}
        actor="demo-operator"
        canPreview
        canPublish
        onPreview={onPreview}
        onPublish={onPublish}
      />
    </>
  );
}
