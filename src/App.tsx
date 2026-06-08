import { useState } from 'react';
import type { Conversation, InteractionMode, Message, ModelConfig, ModelId } from '@/types';
import { AppLayout } from '@/ui/AppLayout';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_MODELS: ModelConfig[] = [
  {
    modelId: 'claude',
    name: 'Claude',
    color: 'accent-claude',
    isActive: true,
  },
  {
    modelId: 'gpt-5.5',
    name: 'GPT-5.5',
    color: 'accent-gpt',
    isActive: true,
  },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'What are the key differences between React and Vue?',
    timestamp: Date.now() - 120_000,
  },
  {
    id: 'msg-2',
    role: 'assistant',
    modelId: 'claude',
    content:
      'React and Vue are both excellent front-end frameworks, but they differ in several key ways:\n\n**React** is a library, not a full framework — it focuses solely on the view layer and relies on the ecosystem for routing, state management, etc. Its JSX syntax blends HTML with JavaScript, giving you the full power of the language in your templates.\n\n**Vue** is a more batteries-included progressive framework. Its single-file components (`.vue` files) keep template, script, and styles neatly separated. Many developers find Vue\'s template syntax more approachable because it looks closer to standard HTML.',
    timestamp: Date.now() - 110_000,
    tokenUsage: { inputTokens: 24, outputTokens: 112, totalTokens: 136 },
  },
  {
    id: 'msg-3',
    role: 'assistant',
    modelId: 'gpt-5.5',
    content:
      "Great question! Here's my take:\n\n- **React** uses a virtual DOM and one-way data flow. Its ecosystem (Redux, React Router, etc.) is massive and battle-tested in large-scale production apps at Meta, Airbnb, and countless others.\n\n- **Vue** offers two-way data binding out of the box and a gentler learning curve. Vue 3's Composition API brings it closer to React Hooks conceptually, while keeping its ergonomic template system.\n\nFor new projects today, both are strong choices. React tends to dominate in US tech companies; Vue has strong adoption in China and among developers who prioritize DX.",
    timestamp: Date.now() - 108_000,
    tokenUsage: { inputTokens: 24, outputTokens: 138, totalTokens: 162 },
  },
  {
    id: 'msg-4',
    role: 'user',
    content: 'Which would you recommend for a new project in 2025?',
    timestamp: Date.now() - 60_000,
  },
  {
    id: 'msg-5',
    role: 'assistant',
    modelId: 'claude',
    content: 'For 2025, I\'d lean toward **React** for most new projects — primarily because of its ecosystem depth and the talent pool. If you\'re building something data-intensive, Server Components in React 19 are a game-changer. That said, if your team already knows Vue, there\'s no compelling reason to switch.',
    timestamp: Date.now() - 50_000,
    isStreaming: false,
    tokenUsage: { inputTokens: 18, outputTokens: 72, totalTokens: 90 },
  },
  {
    id: 'msg-6',
    role: 'assistant',
    modelId: 'gpt-5.5',
    content: 'Agreed with Claude here. React with Next.js is the dominant full-stack choice in 2025. The new compiler and partial pre-rendering are genuinely impressive. Vue with Nuxt is a close second and arguably has better defaults out of the box. Pick based on your team\'s familiarity.',
    timestamp: Date.now() - 48_000,
    isStreaming: false,
    tokenUsage: { inputTokens: 18, outputTokens: 85, totalTokens: 103 },
  },
];

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    title: 'React vs Vue comparison',
    messages: INITIAL_MESSAGES,
    models: MOCK_MODELS,
    interactionMode: 'parallel',
    isGhost: false,
    createdAt: Date.now() - 120_000,
    updatedAt: Date.now() - 48_000,
  },
  {
    id: 'conv-2',
    title: 'TypeScript generics deep dive',
    messages: [
      {
        id: 'conv2-msg-1',
        role: 'user',
        content: 'Explain TypeScript generics with examples',
        timestamp: Date.now() - 3_600_000,
      },
    ],
    models: MOCK_MODELS,
    interactionMode: 'parallel',
    isGhost: false,
    createdAt: Date.now() - 3_600_000,
    updatedAt: Date.now() - 3_600_000,
  },
];

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState<string>('conv-1');
  // Per-conversation model state lives on the conversation; for the mock we
  // keep a top-level models array that mirrors the active conversation's models.
  const [models, setModels] = useState<ModelConfig[]>(MOCK_MODELS);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConversation?.messages ?? [];

  // Derive active models from the shared models array
  const activeModels = models.filter((m) => m.isActive);

  const handleSend = (content: string) => {
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === activeConversationId
          ? { ...conv, messages: [...conv.messages, userMessage], updatedAt: Date.now() }
          : conv,
      ),
    );
  };

  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      messages: [],
      models: models,
      interactionMode: 'parallel',
      isGhost: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
  };

  const handleToggleModel = (modelId: ModelId) => {
    setModels((prev) => {
      const activeCount = prev.filter((m) => m.isActive).length;
      return prev.map((m) => {
        if (m.modelId !== modelId) return m;
        // Guard: cannot deactivate the last active model
        if (m.isActive && activeCount === 1) return m;
        return { ...m, isActive: !m.isActive };
      });
    });
  };

  const handleAddModel = (modelId: ModelId) => {
    setModels((prev) =>
      prev.map((m) => (m.modelId === modelId ? { ...m, isActive: true } : m)),
    );
  };

  /** Persists the chosen interaction mode on the active conversation. */
  const handleModeChange = (mode: InteractionMode) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === activeConversationId
          ? { ...conv, interactionMode: mode, updatedAt: Date.now() }
          : conv,
      ),
    );
  };

  return (
    <AppLayout
      conversations={conversations}
      activeConversationId={activeConversationId}
      activeModels={activeModels}
      allModels={models}
      messages={messages}
      isStreaming={false}
      isGhostMode={false}
      onSend={handleSend}
      onSelectConversation={setActiveConversationId}
      onNewConversation={handleNewConversation}
      onToggleModel={handleToggleModel}
      onAddModel={handleAddModel}
      activeMode={activeConversation?.interactionMode ?? 'parallel'}
      onModeChange={handleModeChange}
    />
  );
}
