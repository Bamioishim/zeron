import { vault } from '../src/server/vault'
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try { res.status(200).json(await vault(typeof req.body === 'string' ? JSON.parse(req.body) : req.body)) }
  catch (e: any) { console.warn('vault', e?.status, e?.message); res.status(e?.status || 500).json({ error: String(e?.message || e).slice(0, 300), ...(e?.extra || {}) }) }
}
