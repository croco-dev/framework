import type { JourneyAction, JourneyActionIntent, JourneyContext, JourneyPredicate } from "./types";
/** Parse at the definition boundary and again at invocation to preserve typed application contracts. */
export function defineJourneyPredicate<Params>(
  parse: (params: Readonly<Record<string, unknown>>) => Params,
  evaluate: (context: JourneyContext, params: Params) => Promise<boolean | "unknown">,
): JourneyPredicate {
  return {
    validate: (params) => {
      parse(params);
    },
    evaluate: (context, params) => evaluate(context, parse(params)),
  };
}
export function defineJourneyAction<Params>(
  capability: string,
  parse: (params: Readonly<Record<string, unknown>>) => Params,
  dispatch: (
    context: JourneyContext,
    params: Params,
    intent: JourneyActionIntent,
  ) => Promise<"accepted" | "rejected" | "indeterminate">,
): JourneyAction {
  return {
    capability,
    validate: (params) => {
      parse(params);
    },
    dispatch: (context, params, intent) => dispatch(context, parse(params), intent),
  };
}
