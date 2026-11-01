// Music + SFX. Starts silent; nothing plays until the first user click (browser autoplay rules).
// Tracks: CC0 from OpenGameArt (see README "Audio credits").
type Track = 'theme' | 'dungeon'
const SFX = ['hit', 'coin', 'clear'] as const
let muted = typeof localStorage !== 'undefined' && localStorage.getItem('zeron-muted') === '1'
let unlocked = false
let want: Track = 'theme'
const els: Partial<Record<Track, HTMLAudioElement>> = {}
const subs = new Set<() => void>()
function el(t: Track) {
  if (!els[t]) { const a = new Audio(`/audio/${t}.mp3`); a.loop = true; a.volume = t === 'theme' ? 0.35 : 0.45; a.preload = 'none'; els[t] = a }
  return els[t]!
}
function sync() {
  for (const t of ['theme', 'dungeon'] as Track[]) {
    const a = els[t]
    if (t === want && unlocked && !muted) el(t).play().catch(() => {})
    else if (a && !a.paused) a.pause()
  }
  subs.forEach((f) => f())
}
export const audio = {
  isMuted: () => muted || !unlocked,
  unlock() { if (unlocked) return; unlocked = true; sync() },
  toggle() { if (!unlocked) { unlocked = true; muted = false } else muted = !muted; localStorage.setItem('zeron-muted', muted ? '1' : '0'); sync() },
  music(t: Track) { if (want !== t) { want = t; sync() } },
  sfx(n: (typeof SFX)[number]) { if (muted || !unlocked) return; const a = new Audio(`/audio/${n}.mp3`); a.volume = 0.5; a.play().catch(() => {}) },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f) } },
}
if (typeof window !== 'undefined') window.addEventListener('pointerdown', () => audio.unlock(), { once: true })
