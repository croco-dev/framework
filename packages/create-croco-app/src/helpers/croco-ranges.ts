const EXTERNAL_CROCO_PACKAGE_RANGES = {
  "@croco/events-core": "^0.0.2",
  "@croco/framework-context": "^0.0.2",
  "@croco/frontend-cloudflare": "^0.0.2",
  "@croco/frontend-react": "^0.0.2",
  "@croco/frontend-vite": "^0.0.2",
  "@croco/meta-vite": "^0.0.2",
  "@croco/openapi-spec": "^0.0.3",
  "@croco/protocols-core": "^0.0.2",
  "@croco/protocols-rest": "^0.0.2",
  "@croco/ratelimit-core": "^0.0.2",
  "@croco/repository-core": "^0.0.2",
  "@croco/rpc-codegen": "^0.0.3",
  "@croco/telemetry-sdk-node": "^0.0.2",
  "@croco/testing": "^0.0.1",
  "@croco/transports-cloudflare-workers": "^0.0.2",
  "@croco/transports-http": "^0.0.2",
} as const satisfies Record<string, string>;

export function getExternalCrocoPackageRange(packageName: string): string | undefined {
  return EXTERNAL_CROCO_PACKAGE_RANGES[packageName as keyof typeof EXTERNAL_CROCO_PACKAGE_RANGES];
}
