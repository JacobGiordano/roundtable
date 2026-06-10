import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { applyTheme, applyUserAccentColors } from '@/ui/theme';
import slateTheme from '../_design/themes/slate.json';
import type { CustomThemeJSON } from '@/types';
// Gate cross-agent exception: getModelAccentColors reads the user's stored
// accent color overrides from localStorage. Called once at app boot so that
// Pass 2 (user overrides) runs immediately after Pass 1 (theme defaults).
import { getModelAccentColors } from '@/auth';

// Pass 1 — Apply the default Slate theme at startup before first render.
applyTheme(slateTheme as CustomThemeJSON);

// Pass 2 — Apply any user-stored accent color overrides on top of the theme.
applyUserAccentColors(getModelAccentColors());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
