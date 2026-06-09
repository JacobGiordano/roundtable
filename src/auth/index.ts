// Gate owns this directory — /src/auth

export { getCredentials, saveCredentials, clearCredentials, hasCredential, CREDENTIAL_LABELS, MODEL_CREDENTIAL_MAP, getRequiredCredentialKeys } from './credentials';
export { useCredentials } from './useCredentials';
export type { CredentialState, UseCredentialsReturn } from './useCredentials';
export { ApiKeyPanel } from './ApiKeyPanel';
export type { ApiKeyPanelProps } from './ApiKeyPanel';
export { getThemePreference, saveThemePreference, setActiveTheme, clearThemePreference } from './theme';
export { getUserPreferences, saveUserPreferences } from './preferences';
export { useUserPreferences } from './useUserPreferences';
export { TokenCountControl } from './TokenCountControl';
