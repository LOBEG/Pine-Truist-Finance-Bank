import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Upstream the web service forwards same-origin `/api/v1` requests to. The SPA
  // calls `/api/v1` relative to its own origin (see src/api/client.js), so both
  // the dev server AND the production preview server must proxy that prefix to a
  // reachable API. Point PINE_BACKEND_URL at your api-gateway (recommended) or
  // core-banking-api. On Railway private networking, e.g.
  // http://api-gateway.railway.internal:8080
  const apiTarget = env.PINE_BACKEND_URL || env.PINE_API_PROXY_TARGET || 'http://localhost:8080';

  // Shared proxy config used by BOTH `server` (dev) and `preview` (production).
  // The error handler converts an unreachable upstream (ECONNREFUSED, timeout)
  // into a clear JSON 502 instead of the proxy's opaque, empty HTTP 500 — which
  // otherwise makes a misconfigured/unset PINE_BACKEND_URL look like a generic
  // server crash on every API call.
  const apiProxy = {
    '/api/v1': {
      target: apiTarget,
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on('error', (err, _req, res) => {
          console.error(`[web] API proxy error -> ${apiTarget}: ${err.message}`);
          if (res && !res.headersSent && typeof res.writeHead === 'function') {
            res.writeHead(502, { 'content-type': 'application/json' });
            res.end(
              JSON.stringify({
                title: 'API backend unreachable',
                code: 'api_unreachable',
                status: 502,
                detail:
                  `The web server could not reach the API at ${apiTarget}. ` +
                  'Set PINE_BACKEND_URL on the web service to your api-gateway ' +
                  '(or core-banking-api) URL, e.g. ' +
                  'http://api-gateway.railway.internal:8080.',
              }),
            );
          }
        });
      },
    },
  };

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      proxy: apiProxy,
    },
    preview: {
      port: Number(env.PORT) || 3000,
      host: true,
      // Accept any Host header so Railway-generated domains (e.g. *.up.railway.app)
      // and any custom domain attached to the service can serve the app.
      allowedHosts: true,
      proxy: apiProxy,
    },
    build: { sourcemap: true, target: 'es2020' },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.PINE_API_URL || '/api/v1'),
      'import.meta.env.VITE_REALTIME_URL': JSON.stringify(env.PINE_REALTIME_URL || ''),
      'import.meta.env.VITE_INTERNAL_BASE_PATH': JSON.stringify(
        env.PINE_INTERNAL_BASE_PATH || '/ops',
      ),
    },
  };
});
