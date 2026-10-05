/** Models offered in Settings. The first one is the default. Kept apart from the SDK so the UI does not bundle it. */
export const CLAUDE_MODELS = ["claude-opus-5-5", "claude-sonnet-5-5"] as const;
export type ClaudeModel = (typeof CLAUDE_MODELS)[number];
export const DEFAULT_CLAUDE_MODEL: ClaudeModel = "claude-opus-5-5";

export function isClaudeModel(value: unknown): value is ClaudeModel {
  return typeof value === "string" && (CLAUDE_MODELS as readonly string[]).includes(value);
}
