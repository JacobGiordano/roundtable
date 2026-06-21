// Gate owns this directory — /src/auth

export { BUILTIN_MODEL_IDS } from './builtinModelIds';
export { getCredentials, saveCredentials, clearCredentials, hasCredential, CREDENTIAL_LABELS, MODEL_CREDENTIAL_MAP, getRequiredCredentialKeys } from './credentials';
export { useCredentials } from './useCredentials';
export type { CredentialState, UseCredentialsReturn } from './useCredentials';
export { ApiKeyPanel } from './ApiKeyPanel';
export type { ApiKeyPanelProps } from './ApiKeyPanel';
export { getThemePreference, saveThemePreference, setActiveTheme, clearThemePreference } from './theme';
export { getUserPreferences, saveUserPreferences } from './preferences';
export { useUserPreferences } from './useUserPreferences';
export { TokenCountControl } from './TokenCountControl';
export {
  getModelAccentColors,
  setModelAccentColor,
  clearModelAccentColor,
  clearAllModelAccentColors,
} from './accentColors';
export {
  // Server URL persistence
  getServerUrl,
  saveServerUrl,
  clearServerUrl,
  // Auth token persistence (write-only from outside this module — read via getActiveStorageProvider)
  clearAuthToken,
  // Login / logout
  login,
  logout,
  // Token refresh
  refreshToken,
  // Storage provider factory
  getActiveStorageProvider,
  // Auth state helpers
  isBackendConfigured,
  getBackendFallbackStatus,
  // Error class — exported so callers can instanceof-check without Arch involvement
  BackendAuthError,
} from './backendAuth';
export type { BackendAuthErrorCode } from './backendAuth';
export {
  getSidebarWidth,
  saveSidebarWidth,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
} from './sidebarWidth';
export {
  getModelVersions,
  getModelVersion,
  setModelVersion,
  clearModelVersion,
} from './modelVersion';
export {
  getProviderRoster,
  saveProviderRoster,
  addBuiltInProvider,
  addCustomProvider,
  updateCustomProvider,
  removeProvider,
  getProviderById,
} from './providerRoster';
