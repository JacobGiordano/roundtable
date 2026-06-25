import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { applyTheme, applyUserAccentColors, applyUserMessageColor, THEME_MAP } from '@/ui/theme';
// Gate cross-agent exception: getModelAccentColors reads the user's stored model
// accent color overrides from localStorage. getThemePreference reads the saved
// theme ID so boot respects the last selected theme. getUserAccentColor reads
// the user's stored message accent override (null = use theme default).
// All three are pure persistence functions; permitted exception per CLAUDE.md.
import { getModelAccentColors, getThemePreference, getUserAccentColor } from '@/auth';

// Pass 1 — Apply the user's saved theme (falls back to Slate if none stored).
const { activeThemeId } = getThemePreference();
applyTheme(THEME_MAP[activeThemeId] ?? THEME_MAP['slate']);

// Pass 2a — Apply any user-stored model accent color overrides on top of the theme.
applyUserAccentColors(getModelAccentColors());

// Pass 2b — Apply the user's custom message accent color (or remove override if none).
applyUserMessageColor(getUserAccentColor());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
