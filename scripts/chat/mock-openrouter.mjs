// Tiny OpenRouter look-alike for local/CI smoke tests: POST /api/v1/chat/completions (SSE). Behaviour per model name: contains "fail" -> 500, "hang" -> never answers.
import http from 'node:http';
const port = Number(process.env.MOCK_PORT || 8799);
http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    let body = {}; try { body = JSON.parse(b); } catch { /* ignore */ }
    const m = String(body.model || '');
    if (req.headers.authorization !== `Bearer ${process.env.MOCK_EXPECT_KEY || 'sk-or-mock'}`) { res.writeHead(401); return res.end('{"error":{"code":401}}'); }
    if (m.includes('fail')) { res.writeHead(500); return res.end('{"error":{"code":500}}'); }
    if (m.includes('hang')) return;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const last = body.messages?.at(-1)?.content || '';
    const words = `Mock ${m} here. You asked: "${last}". Fourcee answers calls 24/7 and books demos for jewelers.`.split(' ');
    res.write(': OPENROUTER PROCESSING\n\n');
    let i = 0; const t = setInterval(() => {
      if (i >= words.length) { clearInterval(t); res.write('data: [DONE]\n\n'); return res.end(); }
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: (i ? ' ' : '') + words[i++] } }] })}\n\n`);
    }, 60);
    res.on('close', () => clearInterval(t));
  });
}).listen(port, '127.0.0.1', () => console.log(JSON.stringify({ mock: 'listening', port })));
