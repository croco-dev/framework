import type {
  GraphQLCallHandler,
  GraphQLInterceptor,
  GraphQLInterceptorContext,
} from "../types/InterceptorTypes";

export class InterceptorChain {
  private readonly interceptors: GraphQLInterceptor[];

  constructor(interceptors: GraphQLInterceptor[]) {
    this.interceptors = interceptors;
  }

  async execute<T>(context: GraphQLInterceptorContext, finalHandler: () => Promise<T>): Promise<T> {
    const dispatch = async (index: number): Promise<T> => {
      if (index >= this.interceptors.length) {
        return finalHandler();
      }

      const interceptor = this.interceptors[index];

      const callHandler: GraphQLCallHandler<T> = {
        handle: () => dispatch(index + 1),
      };

      return interceptor.intercept(context, callHandler) as Promise<T>;
    };

    return dispatch(0);
  }

  static async execute<T>(
    interceptors: GraphQLInterceptor[],
    context: GraphQLInterceptorContext,
    finalHandler: () => Promise<T>,
  ): Promise<T> {
    const chain = new InterceptorChain(interceptors);
    return chain.execute(context, finalHandler);
  }
}
