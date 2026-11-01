import { relay } from '../src/server/core'
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try { res.status(200).json(await relay(typeof req.body === 'string' ? JSON.parse(req.body) : req.body)) }
  catch (e: any) { console.warn('relay error', String(e?.shortMessage || e?.message || e).slice(0, 300)); res.status(400).json({ stale: e?.stale, error: String(e?.shortMessage || e?.message || e).slice(0, 400) }) }
}
