import { useState, useRef, useCallback, useEffect } from 'react';
// #150: shared ChevronIcon replaces the local copy.
import { ChevronIcon } from './components/ChevronIcon';
// #147: shared icon system — GearIcon and PlusIcon replace inline SVGs.
import { GearIcon, PlusIcon } from './icons';
import type { ModelConfig, ModelId, ModelAccentColors, ModelVersionOption, SessionTokenUsage, TokenCountVisibility } from '@/types';
// Cross-agent exception: MODEL_REGISTRY and ModelRegistryEntry are pure data/type
// exports from @/models — read-only registry of all model display metadata
// including providerName, availableVersions, and deprecation fields. Imported so
// ModelSelectorPanel can render version pickers and deprecation notices without
// requiring static lists to be threaded through ModelConfig.
import { MODEL_REGISTRY } from '@/models';
import type { ModelRegistryEntry } from '@/models';
// Gate cross-agent exceptions:
// getModelAccentColors is called to seed the initial accentColors state and to
// refresh it after any color save/clear triggered by AccentColorPicker.
// getProviderRoster is read at render time to determine which active models have
// imageGeneration capability — same pattern as InputBar.tsx's vision check (#285).
import { getModelAccentColors, getProviderRoster } from '@/auth';
import { AccentColorPicker } from './AccentColorPicker';

// #146: sub-components extracted from ModelSelectorPanel.tsx for maintainability.
import { ModelPill } from './components/model-selector/ModelPill';
import { AddModelButton } from './components/model-selector/AddModelButton';
import { SystemPromptRow } from './components/model-selector/SystemPromptRow';
import { ModelVersionRow } from './components/model-selector/ModelVersionRow';
import { SessionTokenSection } from './components/model-selector/SessionTokenSection';
import { ImageGenToggleRow } from './components/model-selector/ImageGenToggleRow';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Lookup map from modelId → availableVersions[], built once from MODEL_REGISTRY.
 * Used by ModelVersionRow to render the version picker without importing from @/models
 * directly inside the component body.
 */
const AVAILABLE_VERSIONS_BY_MODEL_ID = new Map<ModelId, ModelVersionOption[]>(
  MODEL_REGISTRY.map((entry) => [entry.modelId, entry.availableVersions]),
);

/**
 * Extended shape of MODEL_REGISTRY entries that includes Atlas's deprecation fields.
 * Atlas adds `deprecated` and `deprecationDate` to ModelRegistryEntry (issue #423).
 * The cast below is forward-compatible: when Atlas's changes are merged, these
 * fields will be in the type and the cast becomes a no-op.
 */
interface RegistryEntryWithDeprecation extends ModelRegistryEntry {
  deprecated?: boolean;
  deprecationDate?: string;
}

/**
 * Lookup map from modelId → { deprecated, deprecationDate, name }, built once from MODEL_REGISTRY.
 * Used by the deprecation warning banner to surface deprecated active models.
 * Casts to RegistryEntryWithDeprecation so Aria can read Atlas's deprecation fields
 * before their type addition lands in a merged commit.
 */
const DEPRECATION_BY_MODEL_ID = new Map<ModelId, Pick<RegistryEntryWithDeprecation, 'deprecated' | 'deprecationDate' | 'name'>>(
  (MODEL_REGISTRY as RegistryEntryWithDeprecation[]).map((entry) => [
    entry.modelId,
    { deprecated: entry.deprecated, deprecationDate: entry.deprecationDate, name: entry.name },
  ]),
);

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
  /**
   * Called when the user toggles image generation for a model.
   * Sets or clears ModelConfig.imageGenerationEnabled. Only fired for models
   * whose ProviderCapabilities.imageGeneration === true (enforced by the section
   * render condition — the row never mounts for non-capable models).
   */
  onToggleImageGen: (modelId: ModelId, enabled: boolean) => void;
  /**
   * Called when the user clicks the "Add providers" chip in the no-providers state.
   * Opens the ProviderSettingsPanel. UI-internal prop — not in types/index.ts.
   * Spec: provider-settings.md §3.4.
   */
  onOpenProviderSettings?: () => void;
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
  onToggleImageGen,
  sessionUsage,
  tokenCountVisibility,
  onOpenProviderSettings,
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

  // WCAG 2.1 SC 2.4.3: store the element that had focus before the picker
  // opened so we can return focus to it when the picker closes.
  const pickerTriggerRef = useRef<Element | null>(null);

  // Ref to the panel container div — used by the focus trap below.
  const panelRef = useRef<HTMLDivElement>(null);

  // Ref to the trigger chip button — used to return focus after Escape close
  // (WCAG 2.4.3 Focus Order: focus must return to the element that opened the panel).
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Ref that mirrors openPickerModelId for the focus trap closure.
  // Using a ref avoids re-registering the document listener on every picker open/close.
  const openPickerModelIdRef = useRef<ModelId | null>(null);

  // Focus trap — WCAG 2.4.11 (Focus Not Obscured) / 2.1.2 (No Keyboard Trap).
  // When the panel is open it slides up and overlays the MessageThread area.
  // Without a trap, Tab can reach thread elements (copy/edit buttons on
  // MessageBubble) that are entirely covered by the panel. This effect intercepts
  // Tab and Shift+Tab to keep focus cycling within the panel while it is open.
  //
  // AccentColorPicker exclusion (#262): ACP renders as a sibling of #model-selector-panel
  // (not a DOM descendant), so panel.contains(activeElement) returns false when focus is
  // on an ACP swatch. MSP's trap previously misidentified ACP-focus as "escaped" and
  // redirected to the last MSP element. Fix: skip all Tab handling when ACP is open —
  // ACP manages its own focus trap via its own document listener.
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;

    function handleFocusTrap(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // WCAG 2.1.2 No Keyboard Trap: Escape must always close the panel.
        // WCAG 2.4.3 Focus Order: return focus to the trigger chip that opened the panel.
        e.preventDefault();
        setIsClosing(true);
        setIsOpen(false);
        setOpenPickerModelId(null);
        setPickerAnchorRect(null);
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      // #262: when AccentColorPicker is open, ACP owns the focus trap.
      // MSP must yield — ACP is a DOM sibling of #model-selector-panel so
      // panel.contains(activeElement) returns false when focus is in ACP,
      // causing MSP to incorrectly "rescue" focus to its last element.
      if (openPickerModelIdRef.current !== null) return;

      const focusable = Array.from(
        panel!.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.closest('[aria-hidden="true"]'));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        // Shift+Tab at or before the first element — wrap to last.
        if (active === first || !panel!.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab at the last element — wrap to first.
        if (active === last || !panel!.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleFocusTrap);
    return () => document.removeEventListener('keydown', handleFocusTrap);
  }, [isOpen]);

  const handleOpenColorPicker = useCallback(
    (modelId: ModelId, anchorRect: DOMRect) => {
      // Capture focus owner before the picker mounts and steals focus.
      pickerTriggerRef.current = document.activeElement;
      openPickerModelIdRef.current = modelId; // keep ref in sync for focus trap (#262)
      setOpenPickerModelId(modelId);
      setPickerAnchorRect(anchorRect);
    },
    [],
  );

  const handleCloseColorPicker = useCallback(() => {
    openPickerModelIdRef.current = null; // keep ref in sync for focus trap (#262)
    setOpenPickerModelId(null);
    setPickerAnchorRect(null);
    // Refresh the accent color snapshot so pill icons reflect any changes.
    setAccentColors(getModelAccentColors());
    // Return focus to the palette button that opened the picker.
    if (pickerTriggerRef.current instanceof HTMLElement) {
      pickerTriggerRef.current.focus();
    }
    pickerTriggerRef.current = null;
  }, []);

  // ── Panel open/close handlers (hooks — must be unconditional) ─────────────

  const handleTriggerClick = useCallback(() => {
    if (isOpen) {
      // Trigger closing animation
      setIsClosing(true);
      setIsOpen(false);
      // Close any open color picker when the panel closes.
      openPickerModelIdRef.current = null; // keep ref in sync for focus trap (#262)
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

  // Handler for the in-panel settings shortcut. Closes the model selector
  // panel (slide-out animation) then opens the ProviderSettingsPanel.
  const handleOpenSettingsFromPanel = useCallback(() => {
    if (isOpen) {
      setIsClosing(true);
      setIsOpen(false);
      openPickerModelIdRef.current = null; // keep ref in sync for focus trap (#262)
      setOpenPickerModelId(null);
      setPickerAnchorRect(null);
    }
    onOpenProviderSettings?.();
  }, [isOpen, onOpenProviderSettings]);

  // ── Empty roster guard ─────────────────────────────────────────────────────
  // All hooks are above this point. Safe to conditionally return here.
  // §3.4: When roster is empty, render an "Add providers" chip instead of the
  // normal trigger + panel. Clicking it opens the ProviderSettingsPanel directly —
  // no intermediate model selector panel (spec: opening an empty panel then
  // requiring a second click is poor UX).
  if (models.length === 0) {
    return (
      <button
        type="button"
        onClick={onOpenProviderSettings}
        aria-controls="model-selector-panel"
        aria-expanded={false}
        className={[
          'inline-flex items-center gap-[6px]',
          'h-7 px-[10px]',
          'text-[12px] font-medium text-text-muted',
          'bg-transparent border border-border-subtle rounded-full',
          'hover:border-border transition-[border-color] duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          'cursor-pointer select-none',
          'mb-2',
        ].join(' ')}
        aria-label="Add providers to get started"
      >
        {/* Plus icon — shared icon (#147), 12px per §3.4 spec */}
        <PlusIcon size={12} />
        Add providers
      </button>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const activeModels = models.filter((m) => m.isActive);
  const inactiveModels = models.filter((m) => !m.isActive);
  const activeCount = activeModels.length;

  // Count how many active models have a system prompt set
  const promptsSetCount = activeModels.filter(
    (m) => m.systemPrompt && m.systemPrompt.trim().length > 0,
  ).length;

  // Compute the set of active model IDs that have imageGeneration capability.
  // Reads the provider roster synchronously at render time — same pattern as
  // InputBar.tsx's getNonVisionModelNames() vision check (#285). Safe because
  // the roster cannot change while the panel is open.
  const imageGenCapableModelIds = (() => {
    const roster = getProviderRoster();
    return new Set<ModelId>(
      activeModels
        .filter((m) => {
          const config = roster.find((r) =>
            r.kind === 'builtin' ? r.modelId === m.modelId : r.id === m.modelId,
          );
          return config?.capabilities?.imageGeneration === true;
        })
        .map((m) => m.modelId),
    );
  })();

  const imageGenModels = activeModels.filter((m) => imageGenCapableModelIds.has(m.modelId));

  // Collect deprecated active models by consulting MODEL_REGISTRY via the lookup map.
  // Uses entry.deprecated === true flag — not hardcoded model IDs — so any future
  // deprecated provider is picked up automatically.
  const deprecatedActiveModels = activeModels
    .map((m) => ({ config: m, meta: DEPRECATION_BY_MODEL_ID.get(m.modelId) }))
    .filter(({ meta }) => meta?.deprecated === true);

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
      {/* Slide-up panel — appears between thread and trigger.
          panelRef is attached here so the focus trap useEffect can query
          focusable descendants. The trap activates only when isOpen is true. */}
      <div
        ref={panelRef}
        id="model-selector-panel"
        className={panelClass}
        onTransitionEnd={handleTransitionEnd}
        aria-hidden={!isOpen && !isClosing}
        // inert removes all descendants from the tab order + AT tree when the
        // panel is fully closed (not open and not mid-close animation).
        // Matches the aria-hidden condition so the two attributes stay in sync.
        // @types/react 18.3 only exposes inert in experimental.d.ts, so we
        // cast rather than import the experimental types globally.
        {...((!isOpen && !isClosing) ? { inert: '' } : {} as React.HTMLAttributes<HTMLDivElement>)}
      >
        <div
          className={[
            'bg-sidebar border border-border rounded-lg shadow-lg',
            // Cap panel height on small screens so it doesn't push off-screen.
            // overflow-y-auto lets the panel scroll when content exceeds 70vh.
            'max-h-[70vh] overflow-y-auto',
            'p-4 mb-2',
          ].join(' ')}
        >
          {/* ── Deprecation warning ──
               Shown when one or more active models are marked deprecated in MODEL_REGISTRY.
               Advisory only — does not block interaction. Uses semantic-warning token. */}
          {deprecatedActiveModels.length > 0 && (
            <div
              role="alert"
              aria-live="polite"
              className={[
                'mb-4 px-3 py-2.5 rounded-md',
                'border border-warning/40 bg-warning/10',
                'border-l-4 border-l-warning',
              ].join(' ')}
            >
              {deprecatedActiveModels.map(({ config, meta }) => (
                <div key={config.modelId} className={deprecatedActiveModels.length > 1 ? 'mb-1 last:mb-0' : ''}>
                  <p className="text-[12px] font-semibold text-warning leading-snug">
                    {meta!.name} is being discontinued
                  </p>
                  <p className="text-[11px] text-warning leading-relaxed mt-0.5">
                    {meta!.deprecationDate
                      ? `This provider's API will stop responding on ${meta!.deprecationDate}.`
                      : "This provider's API will be shut down soon."}{' '}
                    Switch to another model to avoid interruption.
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── Active models section ── */}
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.06em] mb-2">
            Active models
          </p>

          {/* Pills row — horizontally scrollable on narrow screens so pills never wrap
              off-screen when many models are active. flex-nowrap + overflow-x-auto.
              flex-shrink-0 is applied to each pill via ModelPill's outer wrapper.
              §3.3: when activeCount === 0, pills are replaced by a placeholder chip. */}
          <div className="flex flex-nowrap overflow-x-auto gap-[6px] pb-1" role="group" aria-label="Model toggles">
            {activeCount === 0 ? (
              /* §3.3 zero-active placeholder chip — not interactive, cursor: default */
              <div
                className={[
                  'inline-flex items-center justify-center',
                  'h-8 px-3',
                  'text-[13px] text-text-muted',
                  'bg-transparent border border-dashed border-border rounded-full',
                  'cursor-default select-none flex-shrink-0',
                ].join(' ')}
                aria-label="No models active"
              >
                No models active
              </div>
            ) : (
              models.map((model) => (
                <ModelPill
                  key={model.modelId}
                  model={model}
                  isLastActive={model.isActive && activeCount === 1}
                  onToggle={onToggleModel}
                  onOpenColorPicker={handleOpenColorPicker}
                  isOverrideActive={Boolean(accentColors[model.modelId])}
                />
              ))
            )}
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

          {/* ── Image generation section ──
               Only rendered when at least one active model has imageGeneration capability.
               The toggle sets/clears ModelConfig.imageGenerationEnabled; Vault persists
               it as part of the full ModelConfig. Atlas reads it at send time. */}
          {imageGenModels.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border-subtle">
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.06em] mb-2">
                Image generation
              </p>
              <div className="rounded-md border border-border-subtle overflow-hidden">
                {imageGenModels.map((model) => (
                  <ImageGenToggleRow
                    key={model.modelId}
                    model={model}
                    onToggle={onToggleImageGen}
                  />
                ))}
              </div>
            </div>
          )}

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

          {/* ── Settings shortcut ── */}
          {/* Subtle link at the bottom of the panel for quick access to provider
              settings without having to close the model selector first. */}
          <div className="mt-4 pt-3 border-t border-border-subtle flex justify-end">
            <button
              type="button"
              aria-label="Open provider settings (closes this panel)"
              onClick={handleOpenSettingsFromPanel}
              className={[
                'inline-flex items-center gap-[5px]',
                'py-1.5',
                'text-[11px] text-text-muted',
                'hover:text-text-secondary transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded',
                'cursor-pointer',
              ].join(' ')}
            >
              {/* Gear icon — shared icon (#147) */}
              <GearIcon size={12} />
              Provider settings
            </button>
          </div>
        </div>
      </div>

      {/* Trigger chip */}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls="model-selector-panel"
        onClick={handleTriggerClick}
        className={[
          'inline-flex items-center gap-[6px]',
          'h-7 px-[10px]',
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

      {/* Persistent deprecation notice — visible below the trigger chip even when the
          panel is closed. Shows when any active model is deprecated so the user is alerted
          without needing to open the panel. Open the panel for full details. */}
      {deprecatedActiveModels.length > 0 && !isOpen && !isClosing && (
        <p className="text-[11px] text-warning leading-snug mb-2" aria-live="polite">
          {deprecatedActiveModels.map(({ meta }) => meta!.name).join(', ')}{' '}
          {deprecatedActiveModels.length === 1 ? 'is' : 'are'} deprecated
          {deprecatedActiveModels[0].meta?.deprecationDate
            ? ` — API stops ${deprecatedActiveModels[0].meta.deprecationDate}`
            : ''}.{' '}
          Open models to switch.
        </p>
      )}

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
