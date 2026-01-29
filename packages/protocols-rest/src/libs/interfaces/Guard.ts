export interface Guard<TContext = unknown> {
  canActivate(context: TContext): boolean | Promise<boolean>;
}
