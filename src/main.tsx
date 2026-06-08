import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { applyTheme } from '@/ui/theme';
import slateTheme from '../_design/themes/slate.json';
import type { CustomThemeJSON } from '@/types';

// Apply the default Slate theme at startup before first render.
applyTheme(slateTheme as CustomThemeJSON);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
