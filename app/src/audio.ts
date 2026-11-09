// Music + SFX through one Web Audio context. Music: the CC0 tracks in public/audio (decoded into
// looping buffers), with a synthesized chiptune fallback if a file can't load. SFX are synthesized.
// Browsers (iOS Safari especially) keep audio silent until a user gesture, so the context is
// created/resumed on the first tap, click or key press, and re-resumed if the OS suspends it.
type Track = 'theme' | 'dungeon'
export type Sfx = 'hit' | 'coin' | 'clear' | 'shot' | 'kill' | 'potion' | 'burn' | 'hurt' | 'parry' | 'boom'
const KEY = 'zeron-sound-v2' // new key: the old 'zeron-muted' flag was saved while sound was broken
let muted = typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'off'
let unlocked = false
let want: Track = 'theme'
let ctx: AudioContext | null = null
let master: GainNode | null = null, musicBus: GainNode | null = null, sfxBus: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
const subs = new Set<() => void>()
const notify = () => subs.forEach((f) => f())

function ensure() {
  if (ctx || typeof window === 'undefined') return ctx
  const AC = window.AudioContext || (window as any).webkitAudioContext
  if (!AC) return null
  // iOS 17+: play through the silent switch like a game/media app instead of an "ambient" page
  try { const s = (navigator as any).audioSession; if (s) s.type = 'playback' } catch { /* not supported */ }
  ctx = new AC()
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination)
  musicBus = ctx.createGain(); musicBus.gain.value = 0.4; musicBus.connect(master)
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  ctx.onstatechange = notify
  return ctx
}
function resume() {
  const c = ensure(); if (!c) return
  if (c.state !== 'running') c.resume().catch(() => {})
  // iOS needs a sound started inside the gesture: a 1-sample silent buffer does it
  const b = c.createBufferSource(); b.buffer = c.createBuffer(1, 1, 22050); b.connect(c.destination); b.start(0)
}

/* ---------- tiny synth ---------- */
function tone(freq: number, dur: number, opt: { type?: OscillatorType; vol?: number; at?: number; to?: number; bus?: GainNode | null } = {}) {
  if (!ctx) return
  const t = opt.at ?? ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain()
  o.type = opt.type || 'square'; o.frequency.setValueAtTime(freq, t)
  if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t + dur)
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(opt.vol ?? 0.3, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g); g.connect(opt.bus ?? sfxBus!); o.start(t); o.stop(t + dur + 0.02)
}
function noise(dur: number, opt: { vol?: number; freq?: number; at?: number; type?: BiquadFilterType } = {}) {
  if (!ctx || !noiseBuf) return
  const t = opt.at ?? ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain()
  s.buffer = noiseBuf; f.type = opt.type || 'lowpass'; f.frequency.value = opt.freq ?? 1800
  g.gain.setValueAtTime(opt.vol ?? 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f); f.connect(g); g.connect(sfxBus!); s.start(t); s.stop(t + dur + 0.02)
}
const SFX: Record<Sfx, () => void> = {
  hit: () => { noise(0.08, { vol: 0.35, freq: 2400 }); tone(180, 0.08, { to: 90, vol: 0.2 }) },
  hurt: () => { tone(220, 0.18, { type: 'sawtooth', to: 80, vol: 0.25 }); noise(0.12, { vol: 0.2, freq: 900 }) },
  shot: () => { tone(900, 0.12, { type: 'square', to: 180, vol: 0.18 }); noise(0.06, { vol: 0.15, freq: 4000, type: 'highpass' }) },
  boom: () => { noise(0.45, { vol: 0.5, freq: 600 }); tone(90, 0.35, { type: 'sine', to: 40, vol: 0.4 }) },
  kill: () => { const t = ctx!.currentTime; [523, 659, 784].forEach((f, i) => tone(f, 0.1, { at: t + i * 0.06, vol: 0.18 })) },
  coin: () => { const t = ctx!.currentTime; tone(988, 0.07, { at: t, vol: 0.18 }); tone(1319, 0.16, { at: t + 0.07, vol: 0.18 }) },
  parry: () => { tone(1568, 0.12, { type: 'triangle', vol: 0.25 }); tone(2093, 0.18, { type: 'triangle', vol: 0.15 }) },
  potion: () => { const t = ctx!.currentTime; [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, { type: 'triangle', at: t + i * 0.05, vol: 0.22 })) },
  burn: () => { noise(0.25, { vol: 0.22, freq: 700, type: 'bandpass' }) },
  clear: () => { const t = ctx!.currentTime; [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'square', at: t + i * 0.1, vol: 0.16 })) },
}

/* ---------- looping chiptune music (lookahead scheduler) ---------- */
const N = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
const SONGS: Record<Track, { bpm: number; bass: number[]; lead: (number | 0)[] }> = {
  theme: { bpm: 104, bass: [45, 45, 52, 52, 41, 41, 48, 48, 43, 43, 50, 50, 40, 40, 47, 47], lead: [69, 0, 72, 0, 76, 0, 74, 72, 65, 0, 69, 0, 72, 0, 71, 0, 67, 0, 71, 0, 74, 0, 72, 71, 64, 0, 68, 0, 71, 0, 0, 0] },
  dungeon: { bpm: 92, bass: [38, 38, 38, 41, 36, 36, 36, 39, 34, 34, 34, 37, 33, 33, 36, 33], lead: [62, 0, 0, 65, 0, 0, 64, 0, 60, 0, 0, 63, 0, 0, 62, 0, 58, 0, 0, 62, 0, 0, 61, 0, 57, 0, 60, 0, 61, 0, 0, 0] },
}
let step = 0, nextAt = 0, timer: any = 0, playing: Track | null = null
const bufs: Partial<Record<Track, AudioBuffer | 'failed' | 'loading'>> = {}
let src: AudioBufferSourceNode | null = null, srcTrack: Track | null = null
function load(t: Track) {
  if (!ctx || bufs[t]) return
  bufs[t] = 'loading'
  fetch(`/audio/${t}.mp3`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer() })
    .then((b) => new Promise<AudioBuffer>((ok, bad) => ctx!.decodeAudioData(b, ok, bad)))
    .then((b) => { bufs[t] = b; sync() }).catch(() => { bufs[t] = 'failed'; sync() })
}
function stopFile() { if (src) { try { src.stop() } catch { /* already stopped */ } src.disconnect(); src = null; srcTrack = null } }
function schedule() {
  if (!ctx || !playing) return
  const song = SONGS[playing], dt = 60 / song.bpm / 2
  if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + 0.05
  while (nextAt < ctx.currentTime + 0.25) {
    if (step % 2 === 0) tone(N(song.bass[(step / 2) % song.bass.length]), dt * 1.8, { type: 'triangle', at: nextAt, vol: 0.2, bus: musicBus })
    const l = song.lead[step % song.lead.length]; if (l) tone(N(l), dt * 0.9, { type: 'square', at: nextAt, vol: 0.07, bus: musicBus })
    step++; nextAt += dt
  }
}
function sync() {
  const on = unlocked && !muted && !!ctx
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.02)
  if (!on) { stopFile(); if (timer) { clearInterval(timer); timer = 0 } playing = null; notify(); return }
  load(want)
  const b = bufs[want]
  if (b && b !== 'failed' && b !== 'loading') { // real track
    if (timer) { clearInterval(timer); timer = 0 }
    playing = null
    if (srcTrack !== want) { stopFile(); src = ctx!.createBufferSource(); src.buffer = b; src.loop = true; src.connect(musicBus!); src.start(); srcTrack = want }
  } else if (b === 'failed') { // file missing: chiptune fallback
    stopFile()
    if (playing !== want) { playing = want; step = 0; nextAt = 0 }
    if (!timer) timer = setInterval(schedule, 60)
  }
  notify()
}

export const audio = {
  isMuted: () => muted || !unlocked,
  /** true once the browser actually lets us play (context running) */
  running: () => !!ctx && ctx.state === 'running',
  unlock() { resume(); if (!unlocked) { unlocked = true; sync() } },
  toggle() {
    resume()
    if (!unlocked) { unlocked = true; muted = false } else muted = !muted
    try { localStorage.setItem(KEY, muted ? 'off' : 'on') } catch { /* private mode */ }
    sync(); if (!muted) SFX.coin()
  },
  music(t: Track) { if (want !== t) { want = t; sync() } },
  sfx(n: Sfx) { if (muted || !unlocked || !ctx || ctx.state !== 'running') return; try { SFX[n]() } catch { /* never break the game for a sound */ } },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f) } },
}
if (typeof window !== 'undefined') {
  // every gesture type, not once: iOS can suspend the context again (lock screen, call, tab switch)
  const g = (e: Event) => { if ((e.target as Element | null)?.closest?.('.mute')) return; if (!ctx || ctx.state !== 'running' || !unlocked) audio.unlock() }
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, g, { capture: true, passive: true })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ctx && unlocked && ctx.state !== 'running') ctx.resume().catch(() => {}) })
}
