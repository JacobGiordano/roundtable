/**
 * types.ts — Shared type definitions for the Roundtable backend.
 *
 * These types mirror the shapes defined in /src/types/index.ts on the client.
 * They are duplicated here intentionally — the backend is a standalone Node.js
 * package with its own package.json, and importing from the React client bundle
 * would pull in Vite, browser globals, and other incompatible dependencies.
 *
 * When /src/types/index.ts changes, update these types to match.
 */

export type ModelId = 'claude' | 'gpt-5.5' | 'gemini' | 'grok' | 'deepseek' | 'mistral';

export type MessageRole = 'user' | 'assistant';

export type InteractionMode = 'parallel' | 'manual' | 'auto-chain';

export type ExportFormat = 'markdown' | 'html' | 'json';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelError {
  code: string;
  message: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  modelId?: ModelId;
  timestamp: number;
  tokenUsage?: TokenUsage;
  targetModelId?: ModelId;
  isStreaming?: boolean;
  error?: ModelError;
}

export interface ModelConfig {
  modelId: ModelId;
  name: string;
  color: string;
  systemPrompt?: string;
  isActive: boolean;
}

export interface Conversation {
  id: string;
  title?: string;
  messages: Message[];
  models: ModelConfig[];
  interactionMode: InteractionMode;
  isGhost: boolean;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
  groupId?: string;
}

export interface ExportedConversation {
  content: string;
  filename: string;
  mimeType: string;
}
