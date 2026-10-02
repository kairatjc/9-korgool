import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { router } from './router';
import './styles/index.css';

const root = createRoot(document.getElementById('root')!);

async function boot() {
  // Dev-only: /__design renders the handoff screens from fixtures; /__design/compare shows them next to the reference.
  if (import.meta.env.DEV && location.pathname.startsWith('/__design')) {
    const { DesignApp } = await import('./design/DesignApp');
    root.render(<DesignApp />);
    return;
  }
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

void boot();
