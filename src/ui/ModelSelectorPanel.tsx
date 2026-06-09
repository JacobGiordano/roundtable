import { useState, useRef, useCallback, useEffect } from 'react';
import type { ModelConfig, ModelId, SessionTokenUsage, TokenCountVisibility } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps a ModelId to the inline style for its accent dot. */
function getModelDotStyle(modelId: ModelId): React.CSSProperties {
  switch (modelId) {
    case 'claude':  return { backgroundColor: 'var(--accent-claude)' };
    case 'gpt-5.5': return { backgroundColor: 'var(--accent-gpt)' };
    default:        return { backgroundColor: 'var(--accent-other)' };
  }
}

/** Default placeholder text for the system prompt textarea. */
const SYSTEM_PROMPT_PLACEHOLDER =
  'Give this model a persona, set context, or restrict its behavior…';

// ─── ModelPill ────────────────────────────────────────────────────────────────

interface ModelPillProps {
  model: ModelConfig;
  isLastActive: boolean;
  onToggle: (modelId: ModelId) => void;
}

/**
 * A toggleable pill representing one model in the selector panel.
 * Active: filled background + full-opacity dot.
 * Inactive: transparent background + 40%-opacity dot + muted label.
 * Last-active: clicking triggers a brief shake instead of deactivating.
 */
function ModelPill({ model, isLastActive, onToggle }: ModelPillProps) {
  const [isShaking, setIsShaking] = useState(false);

  const handleClick = useCallback(() => {
    if (model.isActive && isLastActive) {
      // Can't deactivate the last model — shake feedback
      setIsShaking(true);
      return;
    }
    onToggle(model.modelId);
  }, [model.isActive, model.modelId, isLastActive, onToggle]);

  const handleAnimationEnd = useCallback(() => {
    setIsShaking(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  const isActive = model.isActive;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      aria-label={`${model.name} — ${isActive ? 'active, click to deactivate' : 'inactive, click to activate'}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onAnimationEnd={handleAnimationEnd}
      className={[
        'inline-flex items-center gap-2 h-8 rounded-full',
        'px-3',
        'text-[13px] font-medium',
        'border',
        'transition-[background-color,border-color,opacity] duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
        'cursor-pointer select-none',
        isActive
          ? 'bg-hover border-border text-text-primary'
          : 'bg-transparent border-border-subtle text-text-muted',
        isShaking ? 'pill-shake' : '',
      ].join(' ')}
    >
      {/* Color dot */}
      <span
        className="w-[7px] h-[7px] rounded-full flex-shrink-0 transition-opacity duration-fast"
        style={{
          ...getModelDotStyle(model.modelId),
          opacity: isActive ? 1 : 0.4,
        }}
        aria-hidden="true"
      />
      {/* Label */}
      {model.name}
    </button>
  );
}

// ─── AddModelButton ───────────────────────────────────────────────────────────

interface AddModelButtonProps {
  availableModels: ModelConfig[];
  onAdd: (modelId: ModelId) => void;
}

/**
 * Dashed-border pill that opens a dropdown of inactive models to add back.
 * Hidden when all models are already active.
 */
function AddModelButton({ availableModels, onAdd }: AddModelButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleOutside(e: MouseEvent) {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  if (availableModels.length === 0) return null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Add model to conversation"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={[
          'inline-flex items-center gap-2 h-8 rounded-full',
          'px-3',
          'text-[13px] font-medium text-text-muted',
          'border border-dashed border-border',
          'transition-[border-color] duration-fast hover:border-border-strong',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          'cursor-pointer select-none',
        ].join(' ')}
      >
        <span aria-hidden="true" className="text-[14px] leading-none">+</span>
        Add model
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label="Available models"
          className={[
            'absolute bottom-full left-0 mb-2',
            'w-[220px] max-h-[240px] overflow-y-auto',
            'bg-card border border-border rounded-md shadow-md',
            'py-1 z-10',
          ].join(' ')}
        >
          {availableModels.map((model) => (
            <button
              key={model.modelId}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                onAdd(model.modelId);
                setIsOpen(false);
              }}
              className={[
                'w-full flex items-center gap-3 h-10 px-3',
                'text-left cursor-pointer',
                'hover:bg-hover',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:bg-hover',
              ].join(' ')}
            >
              <span
                className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                style={getModelDotStyle(model.modelId)}
                aria-hidden="true"
              />
              <span className="text-[14px] text-text-primary flex-1">{model.name}</span>
              <span className="text-[12px] text-text-muted">
                {model.modelId === 'claude' ? 'Anthropic' : model.modelId === 'gpt-5.5' ? 'OpenAI' : 'Other'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ChevronIcon ──────────────────────────────────────────────────────────────

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      className="transition-transform duration-fast flex-shrink-0"
      style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <path
        d="M1.5 3.5L5 7L8.5 3.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── SystemPromptRow ──────────────────────────────────────────────────────────

interface SystemPromptRowProps {
  model: ModelConfig;
  onUpdate: (modelId: ModelId, value: string) => void;
}

/**
 * A single row in the system prompt section. Shows the model name, a color dot,
 * an expandable textarea for the system prompt, and a clear button when
 * a prompt is set.
 */
function SystemPromptRow({ model, onUpdate }: SystemPromptRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasPrompt = Boolean(model.systemPrompt && model.systemPrompt.trim().length > 0);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (next) {
        // Focus textarea once it mounts
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
      return next;
    });
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate(model.modelId, e.target.value);
      // Auto-resize
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    },
    [model.modelId, onUpdate],
  );

  const handleClear = useCallback(() => {
    onUpdate(model.modelId, '');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  }, [model.modelId, onUpdate]);

  const rowId = `system-prompt-${model.modelId}`;

  return (
    <div className="border-b border-border-subtle last:border-b-0">
      {/* Header row — always visible */}
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={rowId}
        onClick={handleToggle}
        className={[
          'w-full flex items-center gap-2 h-9 px-1',
          'text-left cursor-pointer select-none',
          'hover:bg-hover rounded',
          'transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
        ].join(' ')}
      >
        {/* Color dot */}
        <span
          className="w-[7px] h-[7px] rounded-full flex-shrink-0"
          style={getModelDotStyle(model.modelId)}
          aria-hidden="true"
        />

        {/* Model name */}
        <span className="text-[13px] font-medium text-text-primary flex-1">
          {model.name}
        </span>

        {/* "Set" badge — shown when a prompt exists and row is collapsed */}
        {hasPrompt && !isExpanded && (
          <span
            className={[
              'text-[10px] font-semibold uppercase tracking-wider',
              'px-[6px] py-[2px] rounded-full',
              'bg-hover text-text-secondary border border-border-subtle',
            ].join(' ')}
            aria-label="System prompt is set"
          >
            Set
          </span>
        )}

        {/* Chevron */}
        <ChevronIcon isOpen={isExpanded} />
      </button>

      {/* Expandable body */}
      {isExpanded && (
        <div
          id={rowId}
          className="pb-3 pt-1 px-1"
        >
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={model.systemPrompt ?? ''}
              onChange={handleChange}
              placeholder={SYSTEM_PROMPT_PLACEHOLDER}
              rows={3}
              aria-label={`System prompt for ${model.name}`}
              className={[
                'w-full resize-none rounded-md',
                'bg-input border border-border',
                'text-[13px] leading-[1.5] text-text-primary',
                'placeholder:text-text-muted',
                'px-3 py-2',
                'min-h-[72px] max-h-[160px]',
                'transition-[border-color] duration-fast',
                'focus:outline-none focus:border-border-strong',
                hasPrompt ? 'pr-10' : '',
              ].join(' ')}
              style={{ overflowY: 'auto' }}
            />

            {/* Clear button — only shown when prompt is non-empty */}
            {hasPrompt && (
              <button
                type="button"
                onClick={handleClear}
                aria-label={`Clear system prompt for ${model.name}`}
                title="Clear system prompt"
                className={[
                  'absolute top-2 right-2',
                  'w-5 h-5 flex items-center justify-center',
                  'rounded text-text-muted',
                  'hover:text-text-primary hover:bg-hover',
                  'transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                ].join(' ')}
              >
                {/* × icon */}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path
                    d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Character hint */}
          <p className="mt-1 text-[11px] text-text-muted">
            Sent as the system message before every reply from {model.name}.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── SessionTokenSection ──────────────────────────────────────────────────────

interface SessionTokenSectionProps {
  /**
   * Per-model session totals. Computed from all messages in the active
   * conversation via getSessionTokenUsage() from @/models (documented exception).
   */
  sessionUsage: SessionTokenUsage[];
  activeModels: ModelConfig[];
  /**
   * Controls token count rendering per UserPreferences.tokenCountVisibility:
   *   'always' — section rendered; counts always visible when expanded
   *   'active' — section rendered (default); standard collapse/expand behavior
   *   'never'  — section removed from DOM entirely (null return)
   */
  tokenCountVisibility?: TokenCountVisibility;
}

/**
 * Collapsible section showing per-model token usage totals for the session.
 * Hidden by default — user expands on demand (progressive disclosure).
 * Sits below the System Prompts section in the ModelSelectorPanel slide-up panel.
 */
function SessionTokenSection({
  sessionUsage,
  activeModels,
  tokenCountVisibility = 'active',
}: SessionTokenSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback(() => setIsExpanded((prev) => !prev), []);

  // 'never': remove from DOM entirely (not CSS hidden — fully absent from accessibility tree)
  if (tokenCountVisibility === 'never') return null;

  // Only show section if we have any usage data at all
  if (sessionUsage.length === 0) return null;

  const sessionTotal = sessionUsage.reduce((sum, u) => sum + u.totalTokens, 0);

  return (
    <div className="mt-4 pt-4 border-t border-border-subtle">
      {/* Section header — always visible, acts as the toggle */}
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={handleToggle}
        className={[
          'w-full flex items-center justify-between',
          'cursor-pointer select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
          'rounded',
          'hover:bg-hover transition-colors duration-fast',
          'px-1 py-[2px]',
          'mb-1',
        ].join(' ')}
      >
        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.06em]">
          Token usage
        </p>
        <div className="flex items-center gap-2">
          {/* Session total — always visible as a quick summary */}
          <span className="text-[11px] text-text-muted tabular-nums">
            {sessionTotal.toLocaleString()} total
          </span>
          <ChevronIcon isOpen={isExpanded} />
        </div>
      </button>

      {/* Per-model breakdown — revealed on expand */}
      {isExpanded && (
        <div className="rounded-md border border-border-subtle overflow-hidden">
          {sessionUsage.map((usage, i) => {
            // Find the display name for this modelId
            const modelConfig = activeModels.find((m) => m.modelId === usage.modelId);
            const displayName = modelConfig?.name ?? usage.modelId;

            return (
              <div
                key={usage.modelId}
                className={[
                  'flex items-center gap-2 px-3 py-2',
                  i < sessionUsage.length - 1 ? 'border-b border-border-subtle' : '',
                ].join(' ')}
              >
                {/* Color dot */}
                <span
                  className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                  style={getModelDotStyle(usage.modelId)}
                  aria-hidden="true"
                />

                {/* Model name */}
                <span className="text-[12px] text-text-secondary flex-1 font-medium">
                  {displayName}
                </span>

                {/* Per-model token breakdown */}
                <div className="flex items-center gap-3 text-[11px] text-text-muted tabular-nums">
                  <span title="Input tokens">
                    ↑ {usage.inputTokens.toLocaleString()}
                  </span>
                  <span title="Output tokens">
                    ↓ {usage.outputTokens.toLocaleString()}
                  </span>
                  <span
                    className="font-medium text-text-secondary"
                    title="Total tokens this session"
                  >
                    {usage.totalTokens.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ModelSelectorPanel ───────────────────────────────────────────────────────

interface ModelSelectorPanelProps {
  models: ModelConfig[];
  onToggleModel: (modelId: ModelId) => void;
  onAddModel: (modelId: ModelId) => void;
  /** Called when the user edits or clears a model's system prompt. */
  onUpdateSystemPrompt: (modelId: ModelId, value: string) => void;
  /**
   * Per-model token usage totals for the current session.
   * Computed by App via getSessionTokenUsage() from @/models (documented exception).
   * Empty array when no tokens have been used yet.
   */
  sessionUsage: SessionTokenUsage[];
  /**
   * Controls token count rendering per UserPreferences.tokenCountVisibility.
   * Threaded from App → AppLayout → ModelSelectorPanel → SessionTokenSection.
   * Defaults to 'active' when omitted.
   */
  tokenCountVisibility?: TokenCountVisibility;
}

/**
 * Full model selector: trigger chip + slide-up panel with pills.
 * Sits directly above the InputBar in AppLayout.
 * Phase 2: includes a per-model system prompt sub-section.
 */
export function ModelSelectorPanel({
  models,
  onToggleModel,
  onAddModel,
  onUpdateSystemPrompt,
  sessionUsage,
  tokenCountVisibility,
}: ModelSelectorPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const activeModels = models.filter((m) => m.isActive);
  const inactiveModels = models.filter((m) => !m.isActive);
  const activeCount = activeModels.length;

  // Count how many active models have a system prompt set
  const promptsSetCount = activeModels.filter(
    (m) => m.systemPrompt && m.systemPrompt.trim().length > 0,
  ).length;

  const handleTriggerClick = useCallback(() => {
    if (isOpen) {
      // Trigger closing animation
      setIsClosing(true);
      setIsOpen(false);
    } else {
      setIsClosing(false);
      setIsOpen(true);
    }
  }, [isOpen]);

  const handleTransitionEnd = useCallback(() => {
    if (isClosing) {
      setIsClosing(false);
    }
  }, [isClosing]);

  // Determine panel class
  const panelClass = [
    'model-selector-panel',
    isOpen ? 'is-open' : '',
    isClosing ? 'is-closing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="w-full">
      {/* Slide-up panel — appears between thread and trigger */}
      <div
        className={panelClass}
        onTransitionEnd={handleTransitionEnd}
        aria-hidden={!isOpen && !isClosing}
      >
        <div
          className={[
            'bg-sidebar border border-border rounded-lg shadow-lg',
            'p-4 mb-2',
          ].join(' ')}
        >
          {/* ── Active models section ── */}
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.06em] mb-2">
            Active models
          </p>

          {/* Pills row */}
          <div className="flex flex-wrap gap-[6px]" role="group" aria-label="Model toggles">
            {models.map((model) => (
              <ModelPill
                key={model.modelId}
                model={model}
                isLastActive={model.isActive && activeCount === 1}
                onToggle={onToggleModel}
              />
            ))}
            <AddModelButton availableModels={inactiveModels} onAdd={onAddModel} />
          </div>

          {/* ── System prompts section ── */}
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.06em]">
                System prompts
              </p>
              {promptsSetCount > 0 && (
                <span className="text-[11px] text-text-muted">
                  {promptsSetCount} of {activeCount} set
                </span>
              )}
            </div>

            <div className="rounded-md border border-border-subtle overflow-hidden">
              {activeModels.map((model) => (
                <SystemPromptRow
                  key={model.modelId}
                  model={model}
                  onUpdate={onUpdateSystemPrompt}
                />
              ))}
            </div>
          </div>

          {/* ── Token usage section ── */}
          <SessionTokenSection
            sessionUsage={sessionUsage}
            activeModels={activeModels}
            tokenCountVisibility={tokenCountVisibility}
          />
        </div>
      </div>

      {/* Trigger chip */}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="model-selector-panel"
        onClick={handleTriggerClick}
        className={[
          'inline-flex items-center gap-[6px]',
          'h-6 px-[10px]',
          'text-[12px] font-medium text-text-secondary',
          'bg-transparent border border-border-subtle rounded-full',
          'hover:border-border transition-[border-color] duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          'cursor-pointer select-none',
          'mb-2',
        ].join(' ')}
      >
        {activeCount} {activeCount === 1 ? 'model' : 'models'}
        <ChevronIcon isOpen={isOpen} />
      </button>
    </div>
  );
}
