import { defineConfig, type PreviewServer } from 'vite';
import react from '@vitejs/plugin-react';
import { frontendDemoAssets, frontendDemoHeaders, gazeDemoHeaders, publicDemoHeaders } from './scripts/frontend-demo-profile.mts';

const releaseMode = process.env.VITE_SMV_RELEASE_MODE;
const publicRelease = releaseMode === 'frontend-demo' || releaseMode === 'gaze-demo' || releaseMode === 'public-demo';
const headers = releaseMode === 'public-demo' ? publicDemoHeaders : releaseMode === 'gaze-demo' ? gazeDemoHeaders : frontendDemoHeaders;
export default defineConfig({
  plugins: [react(), ...(publicRelease ? [frontendDemoAssets(releaseMode)] : []), ...((releaseMode === 'gaze-demo' || releaseMode === 'public-demo') ? [{
    name: 'smv-isolated-gaze-route',
    configurePreviewServer(server: PreviewServer) { server.middlewares.use((request, _response, next) => {
      if (request.url?.split('?')[0] === '/gaze-experiment') request.url = '/gaze-experiment/index.html';
      next();
    }); },
  }] : [])],
  publicDir: publicRelease ? false : 'public',
  appType: publicRelease ? 'mpa' : 'spa',
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: publicRelease ? {} : { '/api': { target: 'http://127.0.0.1:5174', changeOrigin: true } } },
  preview: { host: '127.0.0.1', ...(publicRelease ? { proxy: {}, headers } : {}) },
});
