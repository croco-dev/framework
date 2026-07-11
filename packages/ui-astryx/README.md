# @croco/ui-astryx

`@croco/ui-astryx` is the Astryx UI profile adapter for Croco React applications. It keeps
`@croco/frontend-react` provider-neutral while giving generated applications a typed Astryx theme,
application shell, Problem Details view, and session-state presentation.

Astryx `0.1.4` is beta software. This package intentionally exposes a small adapter surface and does
not claim that every Croco presentation path is covered.

## Install

```bash
pnpm add @croco/ui-astryx react react-dom
```

Import the packaged prebuilt CSS once, before rendering the application:

```tsx
import "@croco/ui-astryx/styles.css";
```

That stylesheet preserves Astryx's required cascade order:

1. `@astryxdesign/core/reset.css`
2. `@astryxdesign/core/astryx.css`
3. `@astryxdesign/theme-neutral/theme.css`

No StyleX compiler, Vite plugin, Babel plugin, or PostCSS plugin is required for this consumer path.

## Generated application shell

```tsx
import { AstryxAppShell, AstryxAuthState, AstryxProvider } from "@croco/ui-astryx";

export function App() {
  return (
    <AstryxProvider>
      <AstryxAppShell appName="Croco Console">
        <AstryxAuthState state="signed-out" detail="Sign in to continue." />
      </AstryxAppShell>
    </AstryxProvider>
  );
}
```

`AstryxProvider` uses Astryx's neutral theme by default and accepts `system`, `light`, or `dark` mode.
`AstryxAppShell` accepts React nodes for top and side navigation instead of imposing a router.

## Croco Problem Details

```tsx
import type { ProblemDetails } from "@croco/problems-core";
import { AstryxProblemView } from "@croco/ui-astryx";

declare function refetch(): Promise<void>;

export function Failure({ problem }: { problem: ProblemDetails }) {
  return (
    <AstryxProblemView
      problem={problem}
      recoveryActions={[{ id: "retry", label: "Retry", onRecover: () => refetch() }]}
    />
  );
}
```

The view preserves RFC 7807 `type`, `title`, `status`, `detail`, `instance`, and Croco's stable
`code`. Recovery actions can be restricted to specific Problem codes.

## Session contracts

Use `toAstryxAuthStateProps` to map the provider-neutral `FrontendSessionState` from
`@croco/frontend-react` into the generated UI's explicit state model:

```tsx
const sessionState = useAuthBridgeState().session;

return <AstryxAuthState {...toAstryxAuthStateProps(sessionState)} />;
```

The mapping keeps `loading`, `signed-in`, `signed-out`, and provider `unavailable` states distinct.
An unavailable identity provider is never presented as an ordinary signed-out session.
