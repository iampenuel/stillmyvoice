import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { frontendDemoAssets, frontendDemoHeaders } from './scripts/frontend-demo-profile.mts';

const frontendDemo = process.env.VITE_SMV_RELEASE_MODE === 'frontend-demo';
export default defineConfig({
  plugins: [react(), ...(frontendDemo ? [frontendDemoAssets()] : [])],
  publicDir: frontendDemo ? false : 'public',
  appType: frontendDemo ? 'mpa' : 'spa',
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: frontendDemo ? {} : { '/api': { target: 'http://127.0.0.1:5174', changeOrigin: true } } },
  preview: { host: '127.0.0.1', ...(frontendDemo ? { proxy: {}, headers: frontendDemoHeaders } : {}) },
});
