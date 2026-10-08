import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import App from './App';
import { useColorMode, type ColorMode } from './colorMode';
import './styles.css';
// Dark values match the derived tokens in styles.css (light surfaces -> dark, text -> light).
const palettes = {
  // Mundo Animal logo: navy (#0b1a6e) primary, heart red (#ef2414) accent.
  light: {
    primary: { main: '#0b1a6e' },
    secondary: { main: '#ef2414' },
    background: { default: '#f6f8fa', paper: '#ffffff' },
    text: { primary: '#1e2134', secondary: '#696c7b' },
  },
  dark: {
    primary: { main: '#7b8ff7' },
    secondary: { main: '#df3224' },
    background: { default: '#11131b', paper: '#1a1c27' },
    text: { primary: '#d8d9e1', secondary: '#9d9ea6' },
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
