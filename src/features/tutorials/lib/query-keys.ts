/**
 * Stable query-key factory for tutorial-progress queries.
 *
 * There is a single per-user list (GET /v1/tutorials), so every reader
 * shares one cache entry and a mutation only has to invalidate `all`.
 */
export const tutorialKeys = {
  all: ["tutorials"] as const,
  list: () => ["tutorials", "list"] as const,
};
