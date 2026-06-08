import { useState, useRef, useCallback, useEffect } from 'react';
import type { ModelConfig, ModelId } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps a ModelId to the inline style for its accent dot. */
function getModelDotStyle(modelId: ModelId): React.CSSProperties {
  switch (modelId) {
    case 'claude':  return { backgroundColor: 'var(--accent-claude)' };
    case 'gpt-5.5': return { backgroundColor: 'var(--accent-gpt)' };
    default:        return { backgroundColor: 'var(--accent-other)' };
  }
}

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

// ─── ModelSelectorPanel ───────────────────────────────────────────────────────

interface ModelSelectorPanelProps {
  models: ModelConfig[];
  onToggleModel: (modelId: ModelId) => void;
  onAddModel: (modelId: ModelId) => void;
}

/**
 * Full model selector: trigger chip + slide-up panel with pills.
 * Sits directly above the InputBar in AppLayout.
 */
export function ModelSelectorPanel({
  models,
  onToggleModel,
  onAddModel,
}: ModelSelectorPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const activeModels = models.filter((m) => m.isActive);
  const inactiveModels = models.filter((m) => !m.isActive);
  const activeCount = activeModels.length;

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
          {/* Section label */}
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
