export type HttpExceptionFilterResponse = {
  status: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

export type ExceptionFilterResult = Response | HttpExceptionFilterResponse | undefined;

export interface ExceptionFilter<TException = unknown, TContext = unknown> {
  catch(exception: TException, context: TContext): ExceptionFilterResult;
}
