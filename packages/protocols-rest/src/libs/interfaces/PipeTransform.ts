export interface PipeTransform<T = unknown, R = unknown> {
  transform(value: T, metadata: ArgumentMetadata): R | Promise<R>;
}

export interface ArgumentMetadata {
  type: "param" | "query" | "body" | "header" | "custom";
  name?: string;
  metatype?: Function;
}
