import { Problem, ProblemCategory } from "@croco/problems-core";

export class UnsupportedNodeVersionProblem extends Problem {
  readonly code = "create-croco-app/unsupported-node-version";
  readonly category = ProblemCategory.ValidationError;

  constructor(actualVersion: string, minimumVersion: string) {
    super(
      undefined,
      undefined,
      `Node.js ${actualVersion} is unsupported. create-croco-app requires Node.js >=${minimumVersion}.`,
      {
        extensions: {
          actualVersion,
          minimumVersion,
          recovery: `Install and activate Node.js ${minimumVersion} or newer, then rerun the command. With nvm: nvm install ${minimumVersion} && nvm use ${minimumVersion}.`,
        },
      },
    );
  }
}
