'use server';

import { readPackageMarker } from './server-only-module';

export default function RscWithServerImport() {
  return <div>RSC server module available: {String(readPackageMarker())}</div>;
}
