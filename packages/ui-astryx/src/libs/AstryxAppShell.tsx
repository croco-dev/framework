import type { AppShellProps } from "@astryxdesign/core/AppShell";

import { AppShell } from "@astryxdesign/core/AppShell";
import * as React from "react";
import type { ReactNode } from "react";

export type AstryxAppShellProps = {
  readonly appName: string;
  readonly banner?: ReactNode;
  readonly children?: ReactNode;
  readonly contentPadding?: AppShellProps["contentPadding"];
  readonly height?: AppShellProps["height"];
  readonly navigation?: ReactNode;
  readonly sideNavigation?: ReactNode;
};

export function AstryxAppShell({
  appName,
  banner,
  children,
  contentPadding = 4,
  height = "auto",
  navigation,
  sideNavigation,
}: AstryxAppShellProps) {
  const topNav = navigation ?? <strong data-croco-app-name>{appName}</strong>;

  return (
    <AppShell
      banner={banner}
      contentPadding={contentPadding}
      height={height}
      mobileNav={sideNavigation === undefined ? false : undefined}
      sideNav={sideNavigation}
      topNav={topNav}
    >
      {children}
    </AppShell>
  );
}
