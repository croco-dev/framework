export type SampleUser = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
};

export type CreateSampleUserInput = {
  readonly name: string;
  readonly email: string;
};
