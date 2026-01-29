export interface ExceptionFilter<TException = unknown, TContext = unknown> {
  catch(exception: TException, context: TContext): unknown;
}
