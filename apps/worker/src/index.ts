import { createServer } from 'node:http';
import { SseHub } from './hub';

/**
 * Worker entrypoint: SSE fan-out at /polls/:id plus health endpoints. Fronted by Cloudflare as
 * stream.<domain>. Runs ≥1 always-on instance so the subscriber/leader never cold-starts during
 * live polling. Heavy/long jobs (B2 export streaming, media transcode, partition maintenance) attach
 * here too in later phases.
 */
const PORT = Number(process.env.PORT ?? '8080');
const hub = new SseHub();
hub.start();

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', connections: hub.connectionCount }));
    return;
  }
  if (url.pathname === '/readyz') {
    // In a full impl, also check Redis + Neon direct connectivity.
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ready' }));
    return;
  }

  const match = url.pathname.match(/^\/polls\/(\d+)$/);
  if (match && req.method === 'GET') {
    const pollId = Number(match[1]);
    hub.addClient(pollId, res);
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(PORT, () => {
  console.log(`[worker] SSE + jobs listening on :${PORT}`);
});

function shutdown(signal: string): void {
  console.log(`[worker] ${signal} — draining`);
  hub.stop();
  server.close(() => process.exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
