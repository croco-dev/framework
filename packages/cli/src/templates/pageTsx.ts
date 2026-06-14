export type PageTsxOptions = {
  readonly name: string;
};

export function pageTsx(options: PageTsxOptions): string {
  return `export default function ${options.name}Page() {
  return (
    <main>
      <h1>${options.name}</h1>
      <p>${options.name} page</p>
    </main>
  );
}
`;
}
