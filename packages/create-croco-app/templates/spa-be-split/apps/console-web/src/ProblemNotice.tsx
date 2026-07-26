export type FrontendProblem = {
  readonly code: string;
  readonly status: number;
  readonly detail: string;
  readonly recovery: string;
};

type ProblemNoticeProps = {
  readonly problem: FrontendProblem;
  readonly onRetry?: () => void;
};

export function ProblemNotice({ problem, onRetry }: ProblemNoticeProps) {
  return (
    <section role="alert" aria-labelledby="problem-title">
      <h2 id="problem-title">{problem.detail}</h2>
      <dl>
        <div>
          <dt>Problem code</dt>
          <dd>{problem.code}</dd>
        </div>
        <div>
          <dt>HTTP status</dt>
          <dd>{problem.status}</dd>
        </div>
      </dl>
      <p>{problem.recovery}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </section>
  );
}
