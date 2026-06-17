// Vault owns this directory — /src/storage
export { LocalStorageProvider, downloadExportedConversation } from './LocalStorageProvider';
export { conversationToMarkdown, conversationToHtml } from './exporters';
export { ServerStorageProvider } from './ServerStorageProvider';
export type { ServerStorageConfig } from './ServerStorageProvider';
export { StorageError } from './StorageError';
export type { StorageErrorCode } from './StorageError';
export { createStorageProvider, migrateLocalToServer } from './storageFactory';
export type { StorageConfig, MigrationResult } from './storageFactory';
export { GhostModeManager, ghostModeManager } from './GhostModeManager';
export type { GhostModeListener } from './GhostModeManager';
export { useGhostMode } from './useGhostMode';
export type { UseGhostModeReturn } from './useGhostMode';
export { useConversationStore } from './useConversationStore';
export type { UseConversationStoreReturn } from './useConversationStore';
// ExportFormat re-exported so Aria can import it from @/storage without
// reaching into @/types directly for this storage-specific type.
export type { ExportFormat } from '@/types/index';
// Schema versioning — storage-layer concern, not exported to /src/types/index.ts.
// MigrationError is exported so callers can catch typed migration failures.
// CURRENT_SCHEMA_VERSION is exported for diagnostic/testing use.
// StoredConversation type is intentionally NOT exported — it is an internal envelope.
export { MigrationError, CURRENT_SCHEMA_VERSION } from './migration';
