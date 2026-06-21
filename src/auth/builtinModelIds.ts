/**
 * Gate — builtinModelIds.ts
 *
 * Canonical runtime set of BuiltInModelId values.
 *
 * Single-source rule (enforced here): any Gate module that needs a runtime
 * collection of BuiltInModelId values must import BUILTIN_MODEL_IDS from this
 * file — never re-enumerate the members locally. Adding a new BuiltInModelId
 * to /src/types/index.ts requires adding the new value here; this file is then
 * the only Gate file that needs updating for the new member.
 *
 * The one allowed exception is MODEL_CREDENTIAL_MAP in @/auth/credentials:
 * its Record<BuiltInModelId, ...> type enforces exhaustiveness at compile time
 * and is safe as a separate declaration (documented in /src/types/index.ts).
 *
 * @see BuiltInModelId in /src/types/index.ts for the closed union.
 */

import type { BuiltInModelId } from '@/types';

/**
 * Runtime set of all built-in model identifiers that ship with Roundtable.
 *
 * Use this for:
 *   - Deserialization guards (e.g. checking whether a stored string is a
 *     known built-in before casting)
 *   - Collision detection when generating custom provider IDs
 *   - Any iteration over the built-in model roster at runtime
 *
 * Do NOT use this as a source of truth for display names, credential keys, or
 * colors — those are Atlas's MODEL_REGISTRY and Gate's MODEL_CREDENTIAL_MAP,
 * respectively.
 *
 * ReadonlySet<BuiltInModelId>: the TypeScript type ensures members match the
 * closed union; Set.has() provides O(1) membership tests at runtime.
 */
export const BUILTIN_MODEL_IDS: ReadonlySet<BuiltInModelId> = new Set<BuiltInModelId>([
  'claude',
  'gpt-5.5',
  'gemini',
  'grok',
  'deepseek',
  'mistral',
]);
