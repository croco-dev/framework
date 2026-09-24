# Compile-time application DI

Croco keeps the `@Component`, `@Controller`, `@GraphQLResolver`, and `@Inject` authoring surface while moving dependency interpretation into the TypeScript build.

## Build and runtime boundary

1. `@croco/esbuild-plugin` scans the configured server source roots. Candidate recognition uses resolved decorator symbols, not names or string matching.
2. The compiler resolves constructor class types and static `@Inject` references without importing application modules or invoking constructors, factories, lifecycle hooks, or lazy token callbacks.
3. One analysis graph produces `.croco/di.generated.ts` and `.croco/di.manifest.json`. The generated TypeScript contains the actual imports, constructor calls, property assignments, scopes, dependency reasons, source positions, compiler/schema versions, and input hash.
4. The server build attaches the validated definition graph to `createApplicationRuntime(...)`. The runtime installs it directly in its application-owned `ContainerScope`; only that scope creates singleton, request, and transient instances.
5. Disposing the application releases generated singletons and rejects retained callbacks through the existing runtime lifecycle guard.

Importing a decorated application file only records decorator metadata needed by non-DI features. It does not register a provider or create an instance. Importing the generated module is also side-effect free; the server transform passes the graph as an argument when the entry creates its application runtime.

## Defaults and inspection

The default source root is `src`. Tests, fixtures, benchmarks, scripts, generated output, client-only files, and `node_modules` are excluded. `scan.dirs` and `scan.exclude` override these boundaries. Browser builds never receive the server graph.

The manifest records both the selected candidates and the effective exclusion rules. It contains no generated timestamp or absolute source path, so identical inputs produce identical code, manifests, and hashes across workspaces.

Selected libraries publish a `croco.di-package-descriptor.v1` JSON descriptor next to their compiled generated graph. The application build links only descriptors named by `di.packageDescriptors`; it does not scan all installed packages. A descriptor records the package/version, graph export, providers, roots, compiler version, and input hash. Duplicate token ids, conflicting versions of the same selected package, cycles, and lifetime captures are validated together with application providers before the application graph is written.

## Supported dependency syntax

| Authoring syntax                       | Result                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `constructor(service: PricingService)` | Resolves a unique concrete exported class symbol.                                                       |
| `@Inject(PAYMENT_GATEWAY)`             | Resolves the referenced exported Croco token.                                                           |
| `@Inject(() => Service)`               | Reads the returned source reference without calling the function.                                       |
| `@InjectOptional(TOKEN)`               | Emits an optional lookup; a missing binding passes `undefined` so a parameter default can apply.        |
| property `@Inject` / `@InjectMany`     | Emits an explicit post-construction property assignment for identifier properties.                      |
| direct `new Service(fake)`             | Remains the preferred unit-test path.                                                                   |
| module/plugin `useFactory`             | Remains the boundary for SDK clients, secrets, and values that cannot be constructed from source types. |

The compiler rejects non-exported/default providers, interface/union/generic/primitive parameters without a token, computed tokens, unsupported property targets, missing or ambiguous providers, eager cycles, singleton-to-request captures, and private cross-module access with stable source locations. Provider inheritance is deliberately unsupported in the first compiler schema: an inherited provider fails compilation instead of silently dropping base constructor or property injection. It never substitutes `undefined` or falls back to runtime reflection.

Bindings and module boundaries are build inputs, not runtime mutations. A binding names the exported token and an already discovered class provider. `multiple` preserves declaration order for `@InjectMany`; `override` replaces the original provider before graph validation. Module definitions assign token IDs to one owner and explicitly declare imports and exported tokens. The compiler rejects duplicate ownership, unknown providers or modules, and access to a provider that its owning module did not export.

```typescript typecheck
import { crocoPlugin } from "@croco/esbuild-plugin";

crocoPlugin({
  di: {
    bindings: [
      {
        token: { moduleSpecifier: "./src/payments/tokens", exportName: "PAYMENT_GATEWAY" },
        useExisting: {
          moduleSpecifier: "./src/payments/StripePaymentGateway",
          exportName: "StripePaymentGateway",
        },
      },
    ],
    modules: [
      {
        id: "payments",
        providers: [
          "app:src/payments/tokens#PAYMENT_GATEWAY",
          "app:src/payments/StripePaymentGateway#StripePaymentGateway",
        ],
        exports: ["app:src/payments/tokens#PAYMENT_GATEWAY"],
      },
    ],
  },
});
```

Application token IDs use `app:<source-path-without-extension>#<export-name>`. Package descriptors use `package:<package-name>#<export-name>`.

## Migration from TypeDI

| Previous pattern                              | Migration                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `@Service()`                                  | `@Component()` and include the file in the app server scan root.                                                                            |
| `Container.get(Service)` in business code     | Constructor-inject `Service`; resolve roots only at the host/application boundary.                                                          |
| `Container.set(TOKEN, value)` in tests        | Construct the unit directly or provide a typed module/application override in that test graph.                                              |
| TypeDI `Token<T>`                             | Import `Token<T>` from `@croco/framework-context`. Identity is the exported declaration symbol plus generated token id, not the debug name. |
| dynamic token callback/options                | Replace with a static token reference or an explicit module/plugin factory.                                                                 |
| property injection with computed/private keys | Move the dependency to the constructor or an identifier property supported by generated assignment.                                         |

`reflect-metadata` can remain enabled for route, GraphQL, tracing, or other non-DI decorators. Generated DI factories do not consume `design:type` or `design:paramtypes`.

## HMR and concurrent work

Each graph has a stable `graphId` and content-derived `inputHash`. A successful rebuild replaces the definition used by newly created application scopes. Existing scopes retain their previous definitions and instances until their in-flight work ends and the scope is disposed. A failed generation does not write or install a new graph.
