import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import type { ButtonHTMLAttributes } from "react";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "style"> & {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  xstyle?: StyleXStyles;
};

export function Button({
  variant = "default",
  size = "md",
  xstyle,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      {...props}
      {...stylex.props(styles.base, variants[variant], sizes[size], xstyle)}
    />
  );
}

const styles = stylex.create({
  base: {
    alignItems: "center",
    borderRadius: 6,
    cursor: "pointer",
    display: "inline-flex",
    fontWeight: 600,
    justifyContent: "center",
    transitionDuration: "160ms",
    transitionProperty: "background-color, border-color, color, box-shadow",
    transitionTimingFunction: "ease",
  },
});

const variants = stylex.create({
  default: {
    backgroundColor: {
      default: "#0f172a",
      ":hover": "#1e293b",
    },
    borderColor: "transparent",
    borderStyle: "solid",
    borderWidth: 1,
    color: "#ffffff",
  },
  ghost: {
    backgroundColor: {
      default: "transparent",
      ":hover": "#e2e8f0",
    },
    borderColor: "transparent",
    borderStyle: "solid",
    borderWidth: 1,
    color: "#0f172a",
  },
  outline: {
    backgroundColor: {
      default: "transparent",
      ":hover": "#f1f5f9",
    },
    borderColor: "#cbd5e1",
    borderStyle: "solid",
    borderWidth: 1,
    color: "#0f172a",
  },
});

const sizes = stylex.create({
  sm: {
    fontSize: 14,
    minHeight: 32,
    paddingInline: 12,
  },
  md: {
    fontSize: 16,
    minHeight: 40,
    paddingInline: 16,
  },
  lg: {
    fontSize: 18,
    minHeight: 48,
    paddingInline: 24,
  },
});
