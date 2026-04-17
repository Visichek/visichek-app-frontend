/**
 * Check-in feature module.
 *
 * Shared across:
 *   - Public kiosk flow at /register/[tenantId]
 *   - Receptionist approval UI at /app/visitors
 *   - Admin config UI at /app/settings/checkin-configs
 *
 * Endpoints live in ./lib/endpoints. Hooks are split by authorization
 * requirement in ./hooks. UI recipes are in ./components.
 */

export * from "./hooks";
export * from "./components";
export { describeCheckinError } from "./lib/errors";
export { checkinKeys } from "./lib/query-keys";
