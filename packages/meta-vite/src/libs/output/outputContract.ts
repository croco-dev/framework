import type { BuildArtifact, DeployTarget, EntryDescriptor, OutputContract } from '@croco/presentation-preset';

export type MetaOutputContractOptions = {
  readonly presetName: string;
  readonly clientEntry: string;
  readonly ssrEntry: string;
  readonly rscEntry: string;
};

export type MetaDeployTarget = DeployTarget;

type MetaEntryName = './client' | './ssr' | './rsc';

const META_ENTRY_ARTIFACTS = {
  './client': { main: 'client/index.js', types: 'client/index.d.ts' },
  './ssr': { main: 'ssr/entry.js', types: 'ssr/entry.d.ts' },
  './rsc': { main: 'rsc/entry.js', types: 'rsc/entry.d.ts' },
} as const satisfies Record<MetaEntryName, Pick<EntryDescriptor, 'main' | 'types'>>;

export function createMetaOutputContract(options: MetaOutputContractOptions): OutputContract {
  const entries = createEntries(options);

  return {
    presetName: options.presetName,
    buildTime: new Date().toISOString(),
    artifacts: createArtifacts(entries),
    entries,
    format: 'esm',
  };
}

function createEntries(options: MetaOutputContractOptions): readonly EntryDescriptor[] {
  return [
    createEntry('./client', options.clientEntry),
    createEntry('./ssr', options.ssrEntry),
    createEntry('./rsc', options.rscEntry),
  ];
}

function createEntry(exportName: MetaEntryName, sourcePath: string): EntryDescriptor {
  const artifact = META_ENTRY_ARTIFACTS[exportName];

  return {
    exportName,
    main: sourcePath,
    types: artifact.types,
  };
}

function createArtifacts(entries: readonly EntryDescriptor[]): readonly BuildArtifact[] {
  return [
    ...entries.map((entry) => createCodeArtifact(entry.main)),
    ...entries.map((entry) => createTypesArtifact(entry.types)),
    { path: 'client/index.html', format: 'esm', type: 'asset' },
    { path: 'client/style.css', format: 'esm', type: 'asset' },
  ];
}

function createCodeArtifact(path: string): BuildArtifact {
  return { path, format: 'esm', type: 'code' };
}

function createTypesArtifact(path: string): BuildArtifact {
  return { path, format: 'esm', type: 'types' };
}
