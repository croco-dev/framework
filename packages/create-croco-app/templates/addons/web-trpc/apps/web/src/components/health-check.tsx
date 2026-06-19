"use client";
import * as stylex from "@stylexjs/stylex";
import { trpc } from "../lib/trpc";

export function HealthCheck() {
  const { data, isLoading, error } = trpc.health.useQuery();
  if (isLoading) return <p {...stylex.props(styles.message, styles.muted)}>Loading...</p>;
  if (error)
    return <p {...stylex.props(styles.message, styles.error)}>Unable to check API status.</p>;

  return (
    <section {...stylex.props(styles.card)}>
      <span {...stylex.props(styles.label)}>API Status</span>
      <strong {...stylex.props(styles.value)}>{data}</strong>
    </section>
  );
}

const styles = stylex.create({
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ef",
    borderRadius: 12,
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
    display: "grid",
    gap: 8,
    maxWidth: 420,
    paddingBlock: 28,
    paddingInline: 32,
    width: "100%",
  },
  error: {
    color: "#b42318",
  },
  label: {
    color: "#475569",
    fontSize: 14,
    fontWeight: 600,
  },
  message: {
    fontSize: 16,
    margin: 0,
  },
  muted: {
    color: "#64748b",
  },
  value: {
    color: "#0f172a",
    fontSize: 28,
    lineHeight: 1.15,
  },
});
