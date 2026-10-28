import { useSyncExternalStore } from "react";
import type { ComponentType } from "react";
import App from "./App";

type PageRoute = {
  readonly path: string;
  readonly Component: ComponentType;
};

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function getLocation(): string {
  return window.location.href;
}

export function AppRoutes({ routes }: { readonly routes: readonly PageRoute[] }) {
  const location = useSyncExternalStore(subscribe, getLocation);
  const pathname = new URL(location).pathname;
  const Page =
    routes.find((route) => new URL(route.path, window.location.origin).pathname === pathname)
      ?.Component ?? App;

  return <Page key={location} />;
}
