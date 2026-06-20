import { useCallback, useEffect, useState } from "react";
import { ProblemClientError } from "@croco/frontend-problems";
import { request } from "./client";

export type User = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
};

type UseUsersResult = {
  readonly users: readonly User[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly createUser: (input: Omit<User, "id">) => Promise<void>;
  readonly refresh: () => Promise<void>;
};

export function useUsers(): UseUsersResult {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setUsers(await request<User[]>("/users"));
    } catch (caught) {
      setError(toErrorMessage(caught, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(
    async (input: Omit<User, "id">) => {
      setError(null);

      try {
        await request<User>("/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        await refresh();
      } catch (caught) {
        setError(toErrorMessage(caught, "Failed to create user"));
      }
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { users, loading, error, createUser, refresh };
}

function toErrorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof ProblemClientError) {
    return caught.problem.detail ?? `${caught.problem.code}: ${caught.problem.title}`;
  }

  return caught instanceof Error ? caught.message : fallback;
}
