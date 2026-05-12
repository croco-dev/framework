import type { Rule } from "eslint";
import noCrossDomainImport from "./rules/no-cross-domain-import.ts";
import noDatasourceImport from "./rules/no-datasource-import.ts";
import typeGraphqlExplicitType from "./rules/type-graphql-explicit-type.ts";

const plugin: { rules: Record<string, Rule.RuleModule> } = {
  rules: {
    "no-cross-domain-import": noCrossDomainImport,
    "no-datasource-import": noDatasourceImport,
    "type-graphql-explicit-type": typeGraphqlExplicitType,
  },
};

export default plugin;
export { noCrossDomainImport, noDatasourceImport, typeGraphqlExplicitType };
