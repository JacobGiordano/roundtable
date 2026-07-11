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
  const checkboxId = `image-gen-${model.modelId}`;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onToggle(model.modelId, e.target.checked);
    },
    [model.modelId, onToggle],
  );

  return (
    <div className="border-b border-border-subtle last:border-b-0">
      <label
        htmlFor={checkboxId}
        className={[
          'flex items-center gap-2 h-9 px-1',
          'cursor-pointer select-none',
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
        <span className="text-[13px] font-medium text-text-primary flex-1">
          {model.name}
        </span>

        {/* "On" badge — visual indicator when enabled (aria-hidden: badge text
            "On" inside a <label> would otherwise be appended to the checkbox's
            computed accessible name, making it "Gemini On" when enabled). */}
        {isEnabled && (
          <span
            aria-hidden="true"
            className={[
              'text-[10px] font-semibold uppercase tracking-wider',
              'px-[6px] py-[2px] rounded-full',
              'bg-success/10 text-success border border-success/20',
            ].join(' ')}
          >
            On
          </span>
        )}

        {/* Checkbox — labelled by the enclosing <label htmlFor> (model.name).
            No aria-label needed: the <label> association provides the accessible name. */}
        <input
          id={checkboxId}
          type="checkbox"
          checked={isEnabled}
          onChange={handleChange}
          className={[
            'w-4 h-4 rounded cursor-pointer flex-shrink-0',
            'accent-[var(--accent-claude)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          ].join(' ')}
        />
      </label>
    </div>
  );
}
