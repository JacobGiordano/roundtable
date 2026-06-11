import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { applyTheme, applyUserAccentColors, THEME_MAP } from '@/ui/theme';
// Gate cross-agent exception: getModelAccentColors reads the user's stored
// accent color overrides from localStorage. Called once at app boot so that
// Pass 2 (user overrides) runs immediately after Pass 1 (theme defaults).
// getThemePreference reads the user's saved theme ID so boot respects the
// last selected theme instead of always defaulting to Slate.
import { getModelAccentColors, getThemePreference } from '@/auth';

// Pass 1 — Apply the user's saved theme (falls back to Slate if none stored).
const { activeThemeId } = getThemePreference();
applyTheme(THEME_MAP[activeThemeId] ?? THEME_MAP['slate']);

// Pass 2 — Apply any user-stored accent color overrides on top of the theme.
applyUserAccentColors(getModelAccentColors());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
