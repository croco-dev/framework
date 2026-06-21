import { PageDataProvider } from "@croco/frontend-react";
import React from "react";
import ReactDOM from "react-dom/client";
import Page from "./pages/index/+Page";

const rootElement = document.getElementById("root");
const pageData = { data: { message: "Hello from {{projectName}}!" } };

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <PageDataProvider value={pageData}>
      <Page />
    </PageDataProvider>
  </React.StrictMode>,
);
