import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Never read deployment .env files into the browser-test artifact.
await build({
  configFile: false,
  envFile: false,
  envDir: false,
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('/api/v1'),
    'import.meta.env.VITE_SHOW_DEMO_LOGIN': 'false',
    'import.meta.env.VITE_ENABLE_ROOM_SERVICE': 'false',
    'import.meta.env.VITE_ENABLE_CRM': 'false',
    'import.meta.env.VITE_ENABLE_RESERVATIONS': 'false'
  },
  build: { outDir: '.audit-runtime/browser-build', emptyOutDir: true }
});
