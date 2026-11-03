export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const { signRun } = await import('../src/server/core.ts')
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
    const body = JSON.parse(raw)
    res.status(200).json(await signRun(body))
  } catch (e: any) {
    const message = String(e?.shortMessage || e?.message || e).slice(0, 400)
    console.error('[api/run]', e)
    res.status(400).json({ error: message })
  }
}
