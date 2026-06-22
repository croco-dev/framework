export interface PipeTransform<T = unknown, R = unknown> {
  transform(value: T, metadata: ArgumentMetadata): R | Promise<R>;
}

export interface ArgumentMetadata {
  type: "body" | "query" | "header" | "custom" | "param";
  name?: string;
  metatype?: Function;
}
