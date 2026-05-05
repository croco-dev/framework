import { useCallback, useEffect, useState } from 'react';
import { request } from './client';

export type User = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
};

type UseUsersResult = {
  readonly users: readonly User[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly createUser: (input: Omit<User, 'id'>) => Promise<void>;
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
      setUsers(await request<User[]>('/users'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(
    async (input: Omit<User, 'id'>) => {
      await request<User>('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { users, loading, error, createUser, refresh };
}
