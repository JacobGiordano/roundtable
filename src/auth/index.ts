// Gate owns this directory — /src/auth

export { BUILTIN_MODEL_IDS } from './builtinModelIds';
export { getCredentials, saveCredentials, clearCredentials, hasCredential, isCustomProviderReady, CREDENTIAL_LABELS, MODEL_CREDENTIAL_MAP, getRequiredCredentialKeys } from './credentials';
export { useCredentials } from './useCredentials';
export type { CredentialState, UseCredentialsReturn } from './useCredentials';
export { ApiKeyPanel } from './ApiKeyPanel';
export type { ApiKeyPanelProps } from './ApiKeyPanel';
export { getThemePreference, saveThemePreference, setActiveTheme, clearThemePreference, saveCustomTheme, getActiveTheme } from './theme';
// ActiveTheme is exported from @/types (Arch owns it) — not re-exported here.
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
  getSidebarOpen,
  setSidebarOpen,
  clearSidebarOpen,
} from './sidebarOpen';
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
export { testCredential, testCustomCredential } from './credentialTest';
export type { TestResult } from './credentialTest';
export { getBackendConfig, saveBackendConfig, clearBackendConfig } from './backendConfig';
export type { BackendConfig } from './backendConfig';
export { validateCustomTheme } from './themeValidation';
export type { ValidationResult } from './themeValidation';
export {
  getUserAccentColor,
  setUserAccentColor,
  clearUserAccentColor,
} from './userAccentColor';
export { exportSetup, importSetup, SETUP_SCHEMA_VERSION } from './setupExport';
