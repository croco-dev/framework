import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

import { PageDataProvider } from "@croco/frontend-react";
import { Problem, ProblemCategory } from "@croco/problems-core";

import Page from "./pages/index/+Page";

class MissingHydrationRootProblem extends Problem {
  public constructor() {
    super(
      "create-croco-app/web-meta-vite-fullstack-missing-hydration-root",
      ProblemCategory.ValidationError,
      "Croco hydration root element not found",
    );
  }
}

const pageData = {
  data: { message: "Hello from {{projectName}}!" },
  title: "{{projectName}}",
  urlOriginal: window.location.pathname,
};

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new MissingHydrationRootProblem();
}

hydrateRoot(
  rootElement,
  <StrictMode>
    <PageDataProvider value={pageData}>
      <Page />
    </PageDataProvider>
  </StrictMode>,
);
