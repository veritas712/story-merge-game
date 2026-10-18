import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const requestedPort = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

const handleRequest = async (req, res) => {
  try {
    const requested = decodeURIComponent((req.url || '/').split('?')[0]);
    const safe = normalize(requested).replace(/^([.][.][\\/])+/, '').replace(/^[/\\]+/, '');
    const baseRoot = requested.startsWith('/assets/') ? join(root, 'public') : root;
    let file = requested === '/' ? join(root, 'index.html') : join(baseRoot, safe);
    try { await stat(file); } catch { file = join(root, 'index.html'); }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': `${mime[extname(file).toLowerCase()] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(error));
  }
};

function startServer(port, fallbackCount = 0) {
  const server = createServer(handleRequest);
  server.once('error', (error) => {
    const canFallback = (error.code === 'EADDRINUSE' || error.code === 'EACCES') && fallbackCount < 10;
    if (canFallback) {
      const nextPort = port + 1;
      console.warn(`端口 ${port} 不可用（${error.code}），尝试 ${nextPort}`);
      startServer(nextPort, fallbackCount + 1);
      return;
    }
    console.error(`无法启动本地服务器：${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`合成我们的故事 running at http://localhost:${port}`);
    if (port !== requestedPort) console.log(`原请求端口 ${requestedPort} 不可用，请使用上面的实际地址`);
  });
}

startServer(requestedPort);
