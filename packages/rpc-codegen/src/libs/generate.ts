import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ParamIR, RouteIR } from '@croco/protocols-core';

export type GenerateClientOptions = {
  readonly reactQuery?: boolean;
};

type DomainRoutes = {
  readonly domain: string;
  readonly routes: RouteIR[];
};

export function generateClientFiles(routes: RouteIR[], outDir: string, options: GenerateClientOptions = {}): string[] {
  fs.mkdirSync(outDir, { recursive: true });

  return groupRoutesByDomain(routes).map((domainRoutes) => {
    const filePath = path.join(outDir, `${domainRoutes.domain}.ts`);
    const content = generateDomainClient(domainRoutes, options);

    fs.writeFileSync(filePath, content);

    return filePath;
  });
}

function groupRoutesByDomain(routes: RouteIR[]): DomainRoutes[] {
  const groups = new Map<string, RouteIR[]>();

  for (const route of routes) {
    const domain = getDomainName(route);
    groups.set(domain, [...(groups.get(domain) ?? []), route]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([domain, domainRoutes]) => ({ domain, routes: domainRoutes }));
}

function generateDomainClient(domainRoutes: DomainRoutes, options: GenerateClientOptions): string {
  const clientName = `${domainRoutes.domain}Client`;
  const inputTypes = domainRoutes.routes.map(generateInputType).filter((type) => type.length > 0);
  const clientMethods = domainRoutes.routes.map(generateClientMethod).join('\n');
  const imports = options.reactQuery ? "import { useMutation, useQuery } from '@tanstack/react-query';\n" : '';
  const hooks = options.reactQuery ? `\n${generateReactQueryHooks(domainRoutes, clientName)}` : '';

  return `${imports}${inputTypes.join('\n')}
export const ${clientName} = {
${clientMethods}
};
${hooks}`;
}

function generateInputType(route: RouteIR): string {
  if (!needsInput(route)) {
    return '';
  }

  return `export type ${getInputTypeName(route)} = Record<string, unknown>;`;
}

function generateClientMethod(route: RouteIR): string {
  const input = needsInput(route) ? `input${hasRequiredInput(route) ? '' : '?'}: ${getInputTypeName(route)}` : '';
  const fetchOptions = getFetchOptions(route);

  return `  ${route.methodName}: (${input}) => fetch(${getPathExpression(route)}, ${fetchOptions}).then((response) => response.json()),`;
}

function getFetchOptions(route: RouteIR): string {
  const options = [`method: '${route.httpMethod.toUpperCase()}'`];

  if (hasBody(route)) {
    options.push('body: JSON.stringify(input)');
  }

  return `{ ${options.join(', ')} }`;
}

function generateReactQueryHooks(domainRoutes: DomainRoutes, clientName: string): string {
  return domainRoutes.routes.map((route) => generateReactQueryHook(route, clientName)).join('\n');
}

function generateReactQueryHook(route: RouteIR, clientName: string): string {
  const hookName = `use${toPascalCase(route.methodName)}`;

  if (hasBody(route)) {
    return `export function ${hookName}() {
  return useMutation({ mutationFn: ${clientName}.${route.methodName} });
}`;
  }

  const input = needsInput(route) ? `input${hasRequiredInput(route) ? '' : '?'}: ${getInputTypeName(route)}` : '';
  const callInput = needsInput(route) ? 'input' : '';
  const queryKey = needsInput(route) ? `['${route.methodName}', input]` : `['${route.methodName}']`;

  return `export function ${hookName}(${input}) {
  return useQuery({ queryKey: ${queryKey}, queryFn: () => ${clientName}.${route.methodName}(${callInput}) });
}`;
}

function getPathExpression(route: RouteIR): string {
  const pathParams = route.params.filter((param) => param.kind === 'path' && param.name.length > 0);

  if (pathParams.length === 0) {
    return `'${route.path}'`;
  }

  const pathExpression = pathParams.reduce(
    (currentPath, param) => currentPath.split(`:${param.name}`).join(`\${input.${param.name}}`),
    route.path
  );

  return `\`${pathExpression}\``;
}

function needsInput(route: RouteIR): boolean {
  return route.params.some(isInputParam);
}

function hasRequiredInput(route: RouteIR): boolean {
  return hasBody(route) || route.params.some((param) => param.kind === 'path');
}

function hasBody(route: RouteIR): boolean {
  return route.params.some((param) => param.kind === 'body');
}

function isInputParam(param: ParamIR): boolean {
  return param.kind === 'path' || param.kind === 'query' || param.kind === 'body';
}

function getDomainName(route: RouteIR): string {
  const rawName = route.domain ?? route.controllerName.replace(/Controller$/, '');

  return toCamelCase(rawName);
}

function getInputTypeName(route: RouteIR): string {
  return `${toPascalCase(route.methodName)}Input`;
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);

  return `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`;
}

function toPascalCase(value: string): string {
  return value
    .replace(/Controller$/, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');
}
