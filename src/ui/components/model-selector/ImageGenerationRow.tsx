/**
 * ImageGenerationRow — per-model image generation opt-in toggle.
 *
 * Rendered in the "Image generation" section of ModelSelectorPanel for
 * models whose provider has `capabilities.imageGeneration === true`.
 *
 * Reads `ModelConfig.imageGenerationEnabled` (added in #379 / Arch types PR)
 * and calls `onToggle` when the user changes the checkbox. App.tsx persists
 * the toggle state to the active conversation's ModelConfig so it survives
 * page reloads (Vault writes it via the existing saveConversation path).
 *
 * Extracted as a sibling to SystemPromptRow to follow the established
 * per-model-config-row pattern (#146).
 */

import { useCallback } from 'react';
import type { ModelConfig, ModelId } from '@/types';
// #148: getModelDotStyle is the shared utility for model identity dot colors.
import { getModelDotStyle } from '@/ui/utils/modelColor';

export interface ImageGenerationRowProps {
  model: ModelConfig;
  onToggle: (modelId: ModelId, enabled: boolean) => void;
}

export function ImageGenerationRow({ model, onToggle }: ImageGenerationRowProps) {
  const isEnabled = model.imageGenerationEnabled ?? false;

  const handleClick = useCallback(() => {
    onToggle(model.modelId, !isEnabled);
  }, [model.modelId, isEnabled, onToggle]);

  return (
    <div className="border-b border-border-subtle last:border-b-0">
      <div
        className={[
          'flex items-center gap-2 h-9 px-1',
          'hover:bg-hover rounded',
          'transition-colors duration-fast',
        ].join(' ')}
      >
        {/* Model identity dot */}
        <span
          className="w-[7px] h-[7px] rounded-full flex-shrink-0"
          style={getModelDotStyle(model.modelId)}
          aria-hidden="true"
        />

        {/* Model name */}
        <span className="text-[13px] font-medium text-text-primary flex-1 select-none">
          {model.name}
        </span>

        {/* Pill toggle — role="switch" per ARIA 1.1 §5.27 */}
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          aria-label={`Generate images for ${model.name}`}
          onClick={handleClick}
          className={[
            'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full',
            'transition-colors duration-200',
            isEnabled ? 'bg-success' : 'bg-border-subtle',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow',
              'absolute top-0.5 transition-transform duration-200',
              isEnabled ? 'translate-x-4' : 'translate-x-0.5',
            ].join(' ')}
          />
        </button>
      </div>
    </div>
  );
}
