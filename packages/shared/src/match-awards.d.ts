export type MatchAwardRuleCode =
  | "lie_flat"
  | "breaker"
  | "herbalist"
  | "healer"
  | "pianist"
  | "binder"
  | "pressure"
  | "stiff"
  | "ghost"
  | "tough"
  | "violence"
  | "assist"
  | "support"
  | "talker"
  | "rich"
  | "cty"
  | "demolition"
  | "soul";

export declare const matchAwardRuleDescriptions: Record<MatchAwardRuleCode, string>;
export declare function getMatchAwardRuleDescription(code: string): string;
