/**
 * Production Feature Flags
 * Controls availability of optional and upcoming modules across the application.
 */

export const FEATURES = {
  ROOM_SERVICE: import.meta.env?.VITE_ENABLE_ROOM_SERVICE === 'true',
  CRM: import.meta.env?.VITE_ENABLE_CRM === 'true',
  DINING_RESERVATIONS: import.meta.env?.VITE_ENABLE_RESERVATIONS === 'true'
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function isFeatureEnabled(feature: FeatureKey): boolean {
  return Boolean(FEATURES[feature]);
}
