import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import App from './App';
import { useColorMode, type ColorMode } from './colorMode';
import './styles.css';
// Dark values match the derived tokens in styles.css (light surfaces -> dark, text -> light).
const palettes = {
  light: {
    primary: { main: '#176b55' },
    secondary: { main: '#e9ae4f' },
    background: { default: '#f6f8fa', paper: '#ffffff' },
    text: { primary: '#1e3431', secondary: '#697b77' },
  },
  dark: {
    primary: { main: '#4dcbaa' },
    secondary: { main: '#ddab5b' },
    background: { default: '#111614', paper: '#1a1f1d' },
    text: { primary: '#d8e1e0', secondary: '#9da6a4' },
  },
};
function makeTheme(mode: ColorMode) {
  return createTheme({
    palette: { mode, ...palettes[mode] },
    typography: {
      fontFamily: '"Segoe UI", sans-serif',
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { padding: '10px 19px' } },
      },
      MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    },
  });
}
function Root() {
  const mode = useColorMode();
  const theme = useMemo(() => makeTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
if ('serviceWorker' in navigator)
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('/sw.js').catch(() => {}),
  );
