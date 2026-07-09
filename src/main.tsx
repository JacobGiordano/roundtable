import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// #359: Syntax highlighting theme for code blocks (atom-one-dark, neutral dark
// first pass). Background is reset to transparent in index.css so the design
// system's pre.bg-sidebar token controls the outer code block background.
import 'highlight.js/styles/atom-one-dark.min.css';
import App from './App';
import { applyTheme, applyUserAccentColors, applyRosterAccentColors, applyUserMessageColor, THEME_MAP } from '@/ui/theme';
// Gate cross-agent exception: getModelAccentColors reads the user's stored model
// accent color overrides from localStorage. getThemePreference reads the saved
// theme ID so boot respects the last selected theme. getUserAccentColor reads
// the user's stored message accent override (null = use theme default).
// getProviderRoster reads the user's configured provider list; used here to
// initialize --accent-custom-{id} CSS vars for custom providers (#286).
// All are pure persistence functions; permitted exception per CLAUDE.md.
import { getModelAccentColors, getThemePreference, getUserAccentColor, getProviderRoster } from '@/auth';

// Pass 1 — Apply the user's saved theme (falls back to Slate if none stored).
const { activeThemeId } = getThemePreference();
applyTheme(THEME_MAP[activeThemeId] ?? THEME_MAP['slate']);

// Pass 2a-roster — Initialize --accent-custom-{id} CSS vars from the roster
// so custom providers always have a color token to reference. (#286)
applyRosterAccentColors(getProviderRoster());

// Pass 2a — Apply any user-stored model accent color overrides on top of the theme.
// Note: Gate's getModelAccentColors() strips custom provider IDs in the current
// phase. Built-in overrides land here; custom overrides are applied live by
// AccentColorPicker.saveColor (bypasses the strip by merging the hex directly).
applyUserAccentColors(getModelAccentColors());

// Pass 2b — Apply the user's custom message accent color (or remove override if none).
applyUserMessageColor(getUserAccentColor());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
