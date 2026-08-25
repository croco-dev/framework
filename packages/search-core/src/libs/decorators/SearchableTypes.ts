export type SearchableOptions = {
  index?: string;
  autoSync?: boolean;
};

export type SearchableMetadata = {
  index: string;
  autoSync: boolean;
  target: Function;
  sourceLocation?: SearchableSourceLocation;
};

export type SearchableSourceLocation = {
  readonly path: string;
  readonly line: number;
  readonly column: number;
};

export type SearchableIndexDeclaration = {
  readonly targetName: string;
  readonly sourceLocation?: SearchableSourceLocation;
};
