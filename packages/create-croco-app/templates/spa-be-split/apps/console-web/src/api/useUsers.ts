import { useCallback, useEffect, useState } from "react";
import { ProblemClientError } from "@croco/frontend-problems";
import type { FrontendProblem } from "../ProblemNotice";
import { request } from "./client";

export type User = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
};

type UseUsersResult = {
  readonly users: readonly User[];
  readonly loading: boolean;
  readonly problem: FrontendProblem | null;
  readonly createUser: (input: Omit<User, "id">) => Promise<void>;
  readonly refresh: () => Promise<void>;
};

export function useUsers(): UseUsersResult {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<FrontendProblem | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setProblem(null);

    try {
      setUsers(await request<User[]>("/users"));
    } catch (caught) {
      setProblem(toFrontendProblem(caught, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(
    async (input: Omit<User, "id">) => {
      setProblem(null);

      try {
        await request<User>("/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        await refresh();
      } catch (caught) {
        setProblem(toFrontendProblem(caught, "Failed to create user"));
      }
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { users, loading, problem, createUser, refresh };
}

export function toFrontendProblem(caught: unknown, fallback: string): FrontendProblem {
  if (caught instanceof ProblemClientError) {
    return {
      code: caught.problem.code,
      status: caught.problem.status,
      detail: caught.problem.detail ?? caught.problem.title,
      recovery:
        typeof caught.problem.recovery === "string"
          ? caught.problem.recovery
          : "Retry the request or inspect the API Problem evidence.",
    };
  }

  return {
    code: "frontend/unexpected-api-failure",
    status: 0,
    detail: caught instanceof Error ? caught.message : fallback,
    recovery: "Check the API connection and retry the request.",
  };
}
