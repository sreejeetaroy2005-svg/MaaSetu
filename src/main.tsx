import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './index.css';
import './offline/bootstrap';
import App from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Keep the sync engine warm across reloads without blocking the first paint.
void import('./offline/sync');
