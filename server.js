const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { readLatestUsageSnapshot } = require('./src/codex-reader');

const publicDir = path.join(__dirname, 'public');
const sampleUsagePath = path.join(__dirname, 'sample-data', 'usage.json');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

async function loadDemoUsage() {
  const content = await fs.readFile(sampleUsagePath, 'utf8');
  return JSON.parse(content);
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(data));
}

function safeStaticPath(urlPath) {
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const decoded = decodeURIComponent(requested.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(publicDir, normalized);
  if (!filePath.startsWith(publicDir)) return null;
  return filePath;
}

async function serveStatic(request, response) {
  const filePath = safeStaticPath(request.url || '/');
  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, {
      'content-type': mimeTypes[extension] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    response.end(content);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

function createDefaultReadUsage() {
  return async function readUsage() {
    const demoUsage = await loadDemoUsage();
    const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
    const lookbackDays = Number(process.env.CODEX_LOOKBACK_DAYS || 14);
    return readLatestUsageSnapshot({ codexHome, demoUsage, lookbackDays });
  };
}

function createServer(options = {}) {
  const readUsage = options.readUsage || createDefaultReadUsage();

  return http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');

    if (request.method === 'GET' && url.pathname === '/api/usage') {
      try {
        const data = await readUsage();
        sendJson(response, 200, data);
      } catch (error) {
        sendJson(response, 500, {
          mode: 'demo',
          generatedAt: new Date().toISOString(),
          message: 'The usage endpoint failed, so the dashboard could not load local data.',
          windows: [],
          summary: {
            source: 'server-error',
            latestSnapshotAt: null,
            scannedFiles: 0,
            skippedLines: 0,
            tokenTotals: { input: 0, cachedInput: 0, output: 0, total: 0 }
          },
          warnings: [error instanceof Error ? error.message : 'Unknown server error']
        });
      }
      return;
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      await serveStatic(request, response);
      return;
    }

    response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Method not allowed');
  });
}

function startServer(options = {}) {
  const host = options.host || process.env.HOST || '127.0.0.1';
  const port = Number(options.port || process.env.PORT || 8787);
  const server = createServer(options);
  server.listen(port, host, () => {
    console.log(`Codex Usage Dashboard running at http://${host}:${port}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServer,
  startServer
};
