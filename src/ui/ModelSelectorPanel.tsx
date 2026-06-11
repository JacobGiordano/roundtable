import { useState, useRef, useCallback, useEffect } from 'react';
import type { ModelConfig, ModelId, ModelAccentColors, ModelVersionOption, SessionTokenUsage, TokenCountVisibility } from '@/types';
// Cross-agent exception: MODEL_REGISTRY is a pure data export from @/models —
// read-only registry of all model display metadata including providerName and
// availableVersions. Imported so ModelSelectorPanel can render version pickers
// without requiring these static lists to be threaded through ModelConfig.
import { MODEL_REGISTRY } from '@/models';
// Gate cross-agent exception: getModelAccentColors is called to seed the
// initial accentColors state and to refresh it after any color save/clear
// triggered by AccentColorPicker. Aria reads the result; Gate owns the store.
import { getModelAccentColors } from '@/auth';
import { AccentColorPicker } from './AccentColorPicker';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Lookup map from modelId → providerName, built once from MODEL_REGISTRY.
 * Used by AddModelButton to render the correct provider label for any model
 * without hardcoding per-model ternaries.
 */
const PROVIDER_NAME_BY_MODEL_ID = new Map(
  MODEL_REGISTRY.map((entry) => [entry.modelId, entry.providerName]),
);

/**
 * Lookup map from modelId → availableVersions[], built once from MODEL_REGISTRY.
 * Used by ModelVersionRow to render the version picker without importing from @/models
 * directly inside the component body.
 */
const AVAILABLE_VERSIONS_BY_MODEL_ID = new Map<ModelId, ModelVersionOption[]>(
  MODEL_REGISTRY.map((entry) => [entry.modelId, entry.availableVersions]),
);

/**
 * Returns the inline style for a model accent dot.
 * Reads color directly from ModelConfig.color — no modelId switch needed.
 * accent-other is used only when color is genuinely absent (unknown model).
 */
function getModelDotStyle(model: ModelConfig): React.CSSProperties {
  return { backgroundColor: `var(--${model.color ?? 'accent-other'})` };
}

/** Default placeholder text for the system prompt textarea. */
const SYSTEM_PROMPT_PLACEHOLDER =
  'Give this model a persona, set context, or restrict its behavior…';

// ─── PaletteIcon ─────────────────────────────────────────────────────────────

/** 14×14 SVG palette icon for the accent color trigger. */
function PaletteIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      {/* Palette body */}
      <path
        d="M7 1.5A5.5 5.5 0 1 0 12.5 7c0-.83-.17-1.5-1-1.5H10a1.5 1.5 0 0 1 0-3 5.5 5.5 0 0 0-3-1Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Colour dots on the palette */}
      <circle cx="4.5" cy="5" r="0.75" fill="currentColor" />
      <circle cx="4.5" cy="9" r="0.75" fill="currentColor" />
      <circle cx="7"   cy="10.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

// ─── ModelPill ────────────────────────────────────────────────────────────────

interface ModelPillProps {
  model: ModelConfig;
  isLastActive: boolean;
  onToggle: (modelId: ModelId) => void;
  /**
   * When provided the pill renders in "Model Selector Panel context" —
   * it shows a palette icon affordance for accent color customization.
   * When undefined the pill renders without the palette icon (other contexts).
   */
  onOpenColorPicker?: (modelId: ModelId, anchorRect: DOMRect) => void;
  /**
   * Whether a custom accent color is currently stored for this model.
   * When true, the palette icon is always visible (not just on hover)
   * and its color reflects the active custom accent.
   */
  isOverrideActive?: boolean;
}

/**
 * A toggleable pill representing one model in the selector panel.
 * Active: filled background + full-opacity dot.
 * Inactive: transparent background + 40%-opacity dot + muted label.
 * Last-active: clicking triggers a brief shake instead of deactivating.
 *
 * When onOpenColorPicker is provided (Model Selector Panel context only):
 * - Pill has position:relative and right padding of 28px.
 * - A palette icon button is absolutely positioned at right:8px.
 * - Icon is opacity-0 normally, opacity-100 on pill hover/focus.
 * - If isOverrideActive, icon is always visible with the model's accent color.
 */
function ModelPill({
  model,
  isLastActive,
  onToggle,
  onOpenColorPicker,
  isOverrideActive = false,
}: ModelPillProps) {
  const [isShaking, setIsShaking] = useState(false);
  const [isPillHovered, setIsPillHovered] = useState(false);
  const paletteButtonRef = useRef<HTMLButtonElement>(null);

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

  const handlePaletteClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation(); // don't toggle the pill
      if (!onOpenColorPicker || !paletteButtonRef.current) return;
      const rect = paletteButtonRef.current.getBoundingClientRect();
      onOpenColorPicker(model.modelId, rect);
    },
    [model.modelId, onOpenColorPicker],
  );

  const handlePaletteKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (!onOpenColorPicker || !paletteButtonRef.current) return;
        const rect = paletteButtonRef.current.getBoundingClientRect();
        onOpenColorPicker(model.modelId, rect);
      }
    },
    [model.modelId, onOpenColorPicker],
  );

  const isActive = model.isActive;
  const showPaletteIcon = Boolean(onOpenColorPicker);

  // Icon visibility: always-on if override is active, otherwise hover/focus only.
  const paletteIconOpacity = isOverrideActive || isPillHovered ? 1 : 0;

  // Icon color: when override is active, use the model's current accent CSS var.
  // Per spec: "its color is var(--accent-{modelId})".
  // The CSS custom property name for the model is: --accent-{baseId}
  // e.g. "accent-claude", "accent-gpt", "accent-gemini", etc.
  // ModelConfig.color already holds the CSS var name (e.g. "accent-claude").
  const paletteIconStyle: React.CSSProperties = isOverrideActive
    ? { color: `var(--${model.color ?? 'accent-other'})` }
    : {};

  return (
    <div
      className={[
        'relative inline-flex',
        showPaletteIcon ? 'group' : '',
      ].join(' ')}
      onMouseEnter={() => showPaletteIcon && setIsPillHovered(true)}
      onMouseLeave={() => showPaletteIcon && setIsPillHovered(false)}
    >
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
          // Right padding: 28px in selector context (icon + gap), 12px otherwise.
          showPaletteIcon ? 'pl-3 pr-7' : 'px-3',
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
            ...getModelDotStyle(model),
            opacity: isActive ? 1 : 0.4,
          }}
          aria-hidden="true"
        />
        {/* Label */}
        {model.name}
      </button>

      {/* Palette icon — only in Model Selector Panel context */}
      {showPaletteIcon && (
        <button
          ref={paletteButtonRef}
          type="button"
          aria-label={`Customize accent color for ${model.name}`}
          onClick={handlePaletteClick}
          onKeyDown={handlePaletteKeyDown}
          className={[
            'absolute top-1/2 -translate-y-1/2',
            'right-2',
            'w-[18px] h-[18px] flex items-center justify-center',
            'rounded',
            'text-text-muted hover:text-text-secondary',
            'transition-[opacity,color] duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            'cursor-pointer',
          ].join(' ')}
          style={{ opacity: paletteIconOpacity, ...paletteIconStyle }}
        >
          <PaletteIcon />
        </button>
      )}
    </div>
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
        aria-haspopup="menu"
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
          role="menu"
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
              role="menuitem"
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
                style={getModelDotStyle(model)}
                aria-hidden="true"
              />
              <span className="text-[14px] text-text-primary flex-1">{model.name}</span>
              <span className="text-[12px] text-text-muted">
                {PROVIDER_NAME_BY_MODEL_ID.get(model.modelId) ?? 'Unknown'}
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
          style={getModelDotStyle(model)}
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

// ─── ModelVersionRow ──────────────────────────────────────────────────────────

interface ModelVersionRowProps {
  model: ModelConfig;
  availableVersions: ModelVersionOption[];
  onSelect: (modelId: ModelId, versionId: string) => void;
  onClear: (modelId: ModelId) => void;
}

/**
 * A single row in the model versions section.
 *
 * Shows the model name, color dot, and a <select> element listing all available
 * versions. The currently selected version (ModelConfig.selectedVersionId) is
 * pre-selected; absence defaults to the first entry (provider default).
 *
 * A "Reset" button appears when the user has an explicit selection that differs
 * from the first (default) version — clicking it calls onClear to remove the
 * stored selection and revert to provider default.
 *
 * Only rendered when availableVersions.length > 1 (enforced by the parent).
 */
function ModelVersionRow({ model, availableVersions, onSelect, onClear }: ModelVersionRowProps) {
  const defaultVersionId = availableVersions[0]?.id ?? '';
  // The effective selection: stored choice if present, else provider default (first entry).
  const effectiveVersionId = model.selectedVersionId ?? defaultVersionId;
  const isCustom = Boolean(
    model.selectedVersionId && model.selectedVersionId !== defaultVersionId,
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const chosen = e.target.value;
      if (chosen === defaultVersionId && !model.selectedVersionId) return; // already default
      onSelect(model.modelId, chosen);
    },
    [model.modelId, model.selectedVersionId, defaultVersionId, onSelect],
  );

  const handleReset = useCallback(() => {
    onClear(model.modelId);
  }, [model.modelId, onClear]);

  const selectId = `model-version-${model.modelId}`;

  return (
    <div className="flex items-center gap-2 h-9 px-1 border-b border-border-subtle last:border-b-0">
      {/* Color dot */}
      <span
        className="w-[7px] h-[7px] rounded-full flex-shrink-0"
        style={getModelDotStyle(model)}
        aria-hidden="true"
      />

      {/* Model name */}
      <label
        htmlFor={selectId}
        className="text-[13px] font-medium text-text-primary w-[72px] flex-shrink-0 truncate cursor-pointer"
      >
        {model.name}
      </label>

      {/* Version select */}
      <select
        id={selectId}
        value={effectiveVersionId}
        onChange={handleChange}
        aria-label={`Model version for ${model.name}`}
        className={[
          'flex-1 min-w-0 h-7 rounded',
          'bg-input border border-border',
          'text-[12px] text-text-primary',
          'px-2',
          'focus:outline-none focus:border-border-strong',
          'transition-[border-color] duration-fast',
          'cursor-pointer',
        ].join(' ')}
      >
        {availableVersions.map((v, i) => (
          <option key={v.id} value={v.id}>
            {v.displayName}{i === 0 ? ' (default)' : ''}
          </option>
        ))}
      </select>

      {/* Reset button — only shown when a non-default version is stored */}
      {isCustom ? (
        <button
          type="button"
          onClick={handleReset}
          aria-label={`Reset ${model.name} to default version`}
          title="Reset to provider default"
          className={[
            'flex-shrink-0 h-6 px-[6px]',
            'text-[11px] text-text-muted',
            'rounded border border-border-subtle',
            'hover:border-border hover:text-text-secondary',
            'transition-[border-color,color] duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
            'cursor-pointer',
          ].join(' ')}
        >
          Reset
        </button>
      ) : (
        // Reserve space so layout doesn't shift when Reset appears/disappears
        <span className="flex-shrink-0 w-[44px]" aria-hidden="true" />
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
        aria-controls="session-token-panel"
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

      {/* Per-model breakdown — revealed on expand. Always in DOM so aria-controls resolves. */}
      <div
        id="session-token-panel"
        hidden={!isExpanded}
        className="rounded-md border border-border-subtle overflow-hidden"
      >
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
              {/* Color dot — use modelConfig if found, else fall back to accent-other */}
              <span
                className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                style={
                  modelConfig
                    ? getModelDotStyle(modelConfig)
                    : { backgroundColor: 'var(--accent-other)' }
                }
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
   * Called when the user picks a version for a model in the version picker.
   * App persists to Gate and updates ModelConfig.selectedVersionId in state.
   * Only called for models with availableVersions.length > 1.
   */
  onSelectModelVersion: (modelId: ModelId, versionId: string) => void;
  /**
   * Called when the user resets a model version to the provider default.
   * App calls clearModelVersion (Gate) and sets selectedVersionId to undefined.
   */
  onClearModelVersion: (modelId: ModelId) => void;
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
 * Phase 4: each pill has a palette icon for accent color customization.
 */
export function ModelSelectorPanel({
  models,
  onToggleModel,
  onAddModel,
  onUpdateSystemPrompt,
  onSelectModelVersion,
  onClearModelVersion,
  sessionUsage,
  tokenCountVisibility,
}: ModelSelectorPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // ── Accent color state ─────────────────────────────────────────────────────
  // Snapshot of the stored accent colors. Refreshed whenever the color picker
  // saves or clears a color so that pill icons update without a full page reload.
  const [accentColors, setAccentColors] = useState<ModelAccentColors>(
    () => getModelAccentColors(),
  );

  // Which model's color picker is open, and its anchor rect.
  const [openPickerModelId, setOpenPickerModelId] = useState<ModelId | null>(null);
  const [pickerAnchorRect, setPickerAnchorRect] = useState<DOMRect | null>(null);

  const handleOpenColorPicker = useCallback(
    (modelId: ModelId, anchorRect: DOMRect) => {
      setOpenPickerModelId(modelId);
      setPickerAnchorRect(anchorRect);
    },
    [],
  );

  const handleCloseColorPicker = useCallback(() => {
    setOpenPickerModelId(null);
    setPickerAnchorRect(null);
    // Refresh the accent color snapshot so pill icons reflect any changes.
    setAccentColors(getModelAccentColors());
  }, []);

  // ── Panel open/close ───────────────────────────────────────────────────────

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
      // Close any open color picker when the panel closes.
      setOpenPickerModelId(null);
      setPickerAnchorRect(null);
    } else {
      setIsClosing(false);
      setIsOpen(true);
      // Refresh accent color snapshot when the panel opens.
      setAccentColors(getModelAccentColors());
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
        id="model-selector-panel"
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
                onOpenColorPicker={handleOpenColorPicker}
                isOverrideActive={Boolean(accentColors[model.modelId])}
              />
            ))}
            <AddModelButton availableModels={inactiveModels} onAdd={onAddModel} />
          </div>

          {/* ── Model versions section ──
               Only rendered when at least one active model has > 1 version available. */}
          {(() => {
            const versionableModels = activeModels.filter((m) => {
              const versions = AVAILABLE_VERSIONS_BY_MODEL_ID.get(m.modelId);
              return versions !== undefined && versions.length > 1;
            });
            if (versionableModels.length === 0) return null;
            return (
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.06em] mb-2">
                  Model versions
                </p>
                <div className="rounded-md border border-border-subtle overflow-hidden">
                  {versionableModels.map((model) => {
                    const versions = AVAILABLE_VERSIONS_BY_MODEL_ID.get(model.modelId)!;
                    return (
                      <ModelVersionRow
                        key={model.modelId}
                        model={model}
                        availableVersions={versions}
                        onSelect={onSelectModelVersion}
                        onClear={onClearModelVersion}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })()}

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

      {/* Color picker popover — rendered in a portal-like fixed position */}
      {openPickerModelId !== null && pickerAnchorRect !== null && (() => {
        const pickerModel = models.find((m) => m.modelId === openPickerModelId);
        if (!pickerModel) return null;
        return (
          <AccentColorPicker
            modelId={openPickerModelId}
            modelName={pickerModel.name}
            currentColor={accentColors[openPickerModelId]}
            anchorRect={pickerAnchorRect}
            onClose={handleCloseColorPicker}
          />
        );
      })()}
    </div>
  );
}
