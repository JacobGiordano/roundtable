/**
 * ImageGenToggleRow — per-model image generation toggle row.
 *
 * Rendered inside the "Image generation" section of ModelSelectorPanel.
 * Only shown for models whose ProviderCapabilities.imageGeneration === true.
 *
 * Reads the toggle state from ModelConfig.imageGenerationEnabled and calls
 * onToggle when the user changes it. Vault persists the full ModelConfig
 * automatically — no extra persistence work needed here.
 *
 * Pattern follows ModelVersionRow (#146) for layout (dot, name, control)
 * and InputBar.tsx's vision check for capability lookup via getProviderRoster().
 */

import { useCallback } from 'react';
import type { ModelConfig, ModelId } from '@/types';
// #148: getModelDotStyle is the shared utility for model identity dot colors.
import { getModelDotStyle } from '@/ui/utils/modelColor';

export interface ImageGenToggleRowProps {
  model: ModelConfig;
  onToggle: (modelId: ModelId, enabled: boolean) => void;
}

export function ImageGenToggleRow({ model, onToggle }: ImageGenToggleRowProps) {
  const isEnabled = model.imageGenerationEnabled ?? false;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onToggle(model.modelId, e.target.checked);
    },
    [model.modelId, onToggle],
  );

  const checkboxId = `img-gen-${model.modelId}`;

  return (
    <div className="flex items-center gap-2 h-9 px-1 border-b border-border-subtle last:border-b-0">
      {/* Color dot — matches ModelVersionRow and SystemPromptRow */}
      <span
        className="w-[7px] h-[7px] rounded-full flex-shrink-0"
        style={getModelDotStyle(model.modelId)}
        aria-hidden="true"
      />

      {/* Model name — clicking it activates the checkbox (htmlFor below) */}
      <label
        htmlFor={checkboxId}
        className="text-[13px] font-medium text-text-primary flex-1 truncate cursor-pointer"
      >
        {model.name}
      </label>

      {/* Toggle checkbox — explicit label association via htmlFor/id */}
      <input
        id={checkboxId}
        type="checkbox"
        checked={isEnabled}
        onChange={handleChange}
        aria-label={`Enable image generation for ${model.name}`}
        className={[
          'w-4 h-4 flex-shrink-0',
          'cursor-pointer',
          'rounded',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
        ].join(' ')}
      />
    </div>
  );
}
