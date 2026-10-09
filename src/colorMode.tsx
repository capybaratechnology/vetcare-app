import { useSyncExternalStore } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
// Light/dark preference: saved per browser, the system setting the first time.
export type ColorMode = 'light' | 'dark';
const KEY = 'vetcare-theme';
const listeners = new Set<() => void>();
function initial(): ColorMode {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage can be blocked (private mode); fall back to the system setting.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}
let mode: ColorMode = typeof window === 'undefined' ? 'light' : initial();
// Pages that always show in light mode (the public landing), without changing the saved choice.
let forcedLight = false;
const effective = (): ColorMode => (forcedLight ? 'light' : mode);
function apply() {
  const m = effective();
  document.documentElement.dataset.theme = m;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', m === 'dark' ? '#11131b' : '#0b1a6e');
}
export function setForcedLight(on: boolean) {
  if (forcedLight === on) return;
  forcedLight = on;
  apply();
  listeners.forEach((l) => l());
}
if (typeof document !== 'undefined') apply();
export function useColorMode() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    effective,
    () => 'light' as ColorMode,
  );
}
export function toggleColorMode() {
  mode = mode === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Not saved; the choice still applies until the page is closed.
  }
  apply();
  listeners.forEach((l) => l());
}
export function ColorModeToggle() {
  const current = useColorMode();
  const label =
    current === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={toggleColorMode}>
        {current === 'dark' ? <LightModeOutlined /> : <DarkModeOutlined />}
      </IconButton>
    </Tooltip>
  );
}
