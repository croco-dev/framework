import type { DefinedTheme, ThemeMode } from "@astryxdesign/core/theme";

import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import type { ReactNode } from "react";

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
