// Local stand-in for the Vercel functions: node scripts/devapi.ts (port 8787)
import http from 'node:http'
const { relay, signRun } = await import('../src/server/core')
http.createServer(async (req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', async () => {
    res.setHeader('content-type', 'application/json')
    try { const body = JSON.parse(b || '{}'); const j = req.url?.startsWith('/api/relay') ? await relay(body) : await signRun(body); res.end(JSON.stringify(j)) }
    catch (e: any) { res.statusCode = 400; res.end(JSON.stringify({ error: String(e.shortMessage || e.message).slice(0, 400) })) }
  })
}).listen(8787, () => console.log('api on 8787'))
