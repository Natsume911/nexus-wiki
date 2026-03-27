import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason?.message || 'Unexpected error';
  console.error('[unhandledrejection]', event.reason);
  // Use store dynamically to avoid circular imports
  import('./stores/toastStore').then(({ useToastStore }) => {
    useToastStore.getState().addToast(message, 'error');
  }).catch(() => {});
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/wiki">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
