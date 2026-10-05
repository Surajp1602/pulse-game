import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the client runs on Vite (5173) and the game server on 3000; Socket.IO is proxied.
export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  server: {
    host: true,
    proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true }, '/info': 'http://localhost:3000' },
  },
  preview: {
    proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } },
  },
});
