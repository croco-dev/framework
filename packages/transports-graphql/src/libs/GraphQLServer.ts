import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { Container, Context as FrameworkContext } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import { createYoga } from 'graphql-yoga';
import { SchemaCompiler } from './SchemaCompiler';
import type { GraphQLServerOptions } from './types';

type YogaHandler = (request: Request) => Promise<Response>;

export class GraphQLServer {
  private yogaHandler: YogaHandler | null = null;
  private server: Server | null = null;
  private initialized = false;

  constructor(private options: GraphQLServerOptions = {}) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const { schema, schemaOptions, context, graphqlEndpoint = '/graphql', cors, plugins } = this.options;

    let graphqlSchema = schema;

    if (!graphqlSchema && schemaOptions) {
      graphqlSchema = await SchemaCompiler.compileSchema(schemaOptions);
    }

    if (!graphqlSchema) {
      throw new Error('No schema provided. Provide either schema or schemaOptions.');
    }

    const yoga = createYoga({
      schema: graphqlSchema,
      graphqlEndpoint,
      cors,
      plugins,
      context: async ({ request }) => {
        if (typeof context === 'function') {
          return await context(request);
        }
        return context || {};
      },
    });

    this.yogaHandler = yoga.fetch.bind(yoga) as YogaHandler;

    this.initialized = true;
  }

  getHandler(): YogaHandler {
    if (!this.yogaHandler) {
      throw new Error('Server not initialized. Call initialize() first.');
    }
    const yoga = this.yogaHandler;
    return async (request: Request) => {
      const requestId = randomUUID();
      return FrameworkContext.run({ requestId }, () => yoga(request));
    };
  }

  async start(port: number): Promise<void> {
    await this.initialize();

    if (!this.yogaHandler) {
      throw new Error('Server not initialized.');
    }

    const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      const url = req.url ? new URL(req.url, `http://${req.headers.host}`) : new URL('http://localhost');
      const method = req.method || 'GET';

      const body = req.method !== 'GET' && req.method !== 'HEAD' ? await this.getBody(req) : undefined;

      const request = new Request(url, {
        method,
        headers: req.headers as HeadersInit,
        body,
      });

      if (!this.yogaHandler) {
        res.statusCode = 500;
        res.end('Server not initialized');
        return;
      }

      const yoga = this.yogaHandler;
      const response = await FrameworkContext.run({ requestId: randomUUID() }, () => yoga(request));

      res.statusCode = response.status;
      response.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value);
      });

      const responseBody = await response.text();
      res.end(responseBody);
    };

    this.server = createServer(handler);

    await new Promise<void>((resolve, reject) => {
      this.server?.listen(port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          try {
            const logger = Container.get(Logger);
            logger.info(
              `GraphQL Server running on http://localhost:${port}${this.options.graphqlEndpoint || '/graphql'}`
            );
          } catch {
            console.log(
              `GraphQL Server running on http://localhost:${port}${this.options.graphqlEndpoint || '/graphql'}`
            );
          }
          resolve();
        }
      });
    });
  }

  private getBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => {
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString());
      });
      req.on('error', reject);
    });
  }

  stop(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
