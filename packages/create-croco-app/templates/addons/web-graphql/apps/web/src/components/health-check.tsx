'use client';
import { gql, useQuery } from '@apollo/client';

const HEALTH_QUERY = gql`
  query {
    health
  }
`;

export function HealthCheck() {
  const { data, loading, error } = useQuery<{ health: string }>(HEALTH_QUERY);
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  return <p>API Status: {data?.health}</p>;
}
