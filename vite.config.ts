import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function devApiMockPlugin(): Plugin {
  const devDb = new Map<string, any>();
  return {
    name: 'dev-api-mock',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '', 'http://localhost');
        if (url.pathname === '/api/share' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const id = Math.random().toString(36).substring(2, 10);
              const snippet = { id, ...data, createdAt: Date.now() };
              devDb.set(id, snippet);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ id, path: `/s/${id}` }));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }

        if (url.pathname === '/api/get' && req.method === 'GET') {
          const id = url.searchParams.get('id');
          if (!id || !devDb.has(id)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Snippet not found' }));
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ snippet: devDb.get(id) }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    devApiMockPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'JS Scratchpad',
        short_name: 'Scratchpad',
        description: 'Elite JavaScript & TypeScript Scratchpad',
        theme_color: '#0f172a',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15 MB to accommodate Monaco Editor workers
      }
    })
  ],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['monaco-editor'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/monaco-editor')) return 'monaco-editor';
          if (id.includes('node_modules/@monaco-editor/react')) return 'monaco-react';
        },
      },
    },
  },
})
