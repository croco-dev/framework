function Component(_options?: { readonly scope?: "singleton" | "request" | "transient" }) {
  return (_target: new (...args: never[]) => unknown): void => {};
}

function RegisterEvent() {
  return (_target: new (...args: never[]) => unknown): void => {};
}

function RegisterEventHandler(
  _eventClass: new (...args: never[]) => unknown,
  _options?: { readonly eventName?: string },
) {
  return (_target: new (...args: never[]) => unknown): void => {};
}

@RegisterEvent()
export class UserCreatedEvent {}

@Component({ scope: "request" })
export class UserRepository {}

@Component()
export class UserService {
  constructor(private readonly repository: UserRepository) {}
}

@RegisterEventHandler(UserCreatedEvent, { eventName: "user.created" })
@Component()
export class UserCreatedHandler {
  constructor(private readonly service: UserService) {}
}

export type PublicUserDto = {
  readonly id: string;
};
