import * as stylex from "@stylexjs/stylex";
import { HealthCheck } from "../components/health-check";

export default function Home() {
  return (
    <main {...stylex.props(styles.main)}>
      <HealthCheck />
    </main>
  );
}

const styles = stylex.create({
  main: {
    alignItems: "center",
    display: "flex",
    minHeight: "100vh",
    padding: 24,
  },
});
