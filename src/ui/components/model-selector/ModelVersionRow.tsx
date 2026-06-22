/**
 * ModelVersionRow — single row in the model versions section of ModelSelectorPanel.
 *
 * Extracted from ModelSelectorPanel.tsx (#146) to improve maintainability.
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

import { useCallback } from 'react';
import type { ModelConfig, ModelId, ModelVersionOption } from '@/types';
// #148: getModelDotStyle is the shared utility for model identity dot colors.
import { getModelDotStyle } from '@/ui/utils/modelColor';

export interface ModelVersionRowProps {
  model: ModelConfig;
  availableVersions: ModelVersionOption[];
  onSelect: (modelId: ModelId, versionId: string) => void;
  onClear: (modelId: ModelId) => void;
}

export function ModelVersionRow({ model, availableVersions, onSelect, onClear }: ModelVersionRowProps) {
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
        style={getModelDotStyle(model.modelId)}
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
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
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
