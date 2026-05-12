export type PageSpecTsxOptions = {
  readonly name: string;
  readonly kebab: string;
};

export function pageSpecTsx(options: PageSpecTsxOptions): string {
  return `import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Page from './Page';

describe('${options.name}Page', () => {
  it('renders the page', () => {
    const { container } = render(<Page />);

    expect(container).toMatchSnapshot();
  });
});
`;
}
