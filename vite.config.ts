import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // CRITICAL: base: './' makes asset paths relative (e.g., "assets/index.js" instead of "/assets/index.js")
  // This allows the app to work when loaded from the file:// protocol in Electron
  base: './', 
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});