// Vault owns this directory — /src/storage
export { LocalStorageProvider, downloadExportedConversation } from './LocalStorageProvider';
export { conversationToMarkdown, conversationToHtml, buildExportedConversation } from './exporters';
// ExportOptions re-exported so Aria can import it from @/storage for the export dialog (Wave 3).
// The canonical definition is now in @/types/index (Arch PR for #453); re-exported here
// so existing Aria imports from @/storage remain valid without change.
export type { ExportOptions } from '@/types/index';
// Browser file I/O primitives — Aria imports these for the #305 setup export/import feature.
export { downloadJSON, readJSONFile } from './fileio';
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
// Conversation defaults — last-used model roster + interaction mode persisted for
// new conversation init. Aria calls these when creating a new conversation and when
// leaving an existing one (ghost-mode guard belongs in Aria, not here).
export { getConversationDefaults, saveConversationDefaults } from './conversationDefaults';
// Storage usage utilities — issue #494 (unbounded base64 attachment storage).
// getStorageUsage() is NOT on the StorageProvider contract (requires Arch types PR).
// It is exported here as a standalone utility for the companion UI issue #495.
// evictOldGeneratedImages() is used internally by LocalStorageProvider but is also
// exported for testing. StorageUsage is the result type for getStorageUsage().
export {
  getStorageUsage,
  evictOldGeneratedImages,
  estimateLocalStorageBytes,
  isStorageNearCapacity,
  STORAGE_QUOTA_FLOOR_BYTES,
  STORAGE_WARN_THRESHOLD,
  GENERATED_IMAGE_KEEP_COUNT,
} from './storageUsage';
export type { StorageUsage } from './storageUsage';
