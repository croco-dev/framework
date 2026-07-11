import type { DefinedTheme, ThemeMode } from "@astryxdesign/core/theme";

import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme as neutralSourceTheme } from "@astryxdesign/theme-neutral";
import type { ReactNode } from "react";

const neutralTheme = { ...neutralSourceTheme, __built: true } satisfies DefinedTheme;

export type AstryxProviderProps = {
  readonly children?: ReactNode;
  readonly mode?: ThemeMode;
  readonly theme?: DefinedTheme;
};

export function AstryxProvider({
  children,
  mode = "system",
  theme = neutralTheme,
}: AstryxProviderProps) {
  return (
    <div data-croco-ui-profile="astryx">
      <Theme mode={mode} theme={theme}>
        {children}
      </Theme>
    </div>
  );
}
