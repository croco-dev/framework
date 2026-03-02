'use client';
import { trpc } from '../lib/trpc';

export function HealthCheck() {
  const { data, isLoading, error } = trpc.health.useQuery();
  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  return <p>API Status: {data}</p>;
}
