import { Token } from '@croco/framework-context';

export abstract class SearchTransformAdapter<TOptions = unknown> {
  static readonly token = new Token<SearchTransformAdapter>('SearchTransformAdapter');

  abstract readonly id: string;
  abstract readonly defaultSuffix: string;

  abstract transform(input: string, options: TOptions): string;
}

export type SearchTransformRef<TOptions = unknown> = {
  id: string;
  defaultSuffix: string;
  _optionsType?: TOptions;
};
