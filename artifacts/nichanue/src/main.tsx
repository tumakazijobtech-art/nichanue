import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { setBaseUrl } from '@workspace/api-client-react';

import './index.css';

function enableProductionBrowserGuard() {
  if (!import.meta.env.PROD) return;

  // This is only a casual-inspection deterrent. Downloaded frontend code is
  // never secret, so credentials and trusted business logic stay server-side.
  const blocked = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const blockedShortcut =
      key === 'f12' ||
      (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
      (event.ctrlKey && key === 'u');
    if (blockedShortcut) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const blockContextMenu = (event: MouseEvent) => event.preventDefault();
  window.addEventListener('keydown', blocked, true);
  window.addEventListener('contextmenu', blockContextMenu, true);
}

enableProductionBrowserGuard();

setBaseUrl(import.meta.env.VITE_API_URL || null);

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
