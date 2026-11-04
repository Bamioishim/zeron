import { HALLOWEEN } from '../config'
import { useEffect, useRef } from 'react'
import { atlas, frameOf, tile } from './art'
import { TS, blocked, path, type MapDef, type Npc } from './maps'

type Dir = 'up' | 'down' | 'left' | 'right'
const DV: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
export interface WorldApi { warp?: (x: number, y: number) => void; screen: (x: number, y: number) => { x: number; y: number }; foe: (idx: number) => { x: number; y: number } | null; held: Dir | null; action: () => void; walkTo: (x: number, y: number, adjacent?: boolean) => boolean; moving?: () => boolean; pos: () => { x: number; y: number }; near: () => Npc | null }

/** Lightweight canvas engine: grid movement with tweening, wandering foes, NPC prompts, tap-to-walk. */
export default function World({ map, defeated, locked, paused, onInteract, onTouchFoe, onDoor, apiRef, prompt, hunt }: {
  map: MapDef; defeated: number; locked: boolean; paused: boolean; prompt: (n: Npc | null) => void
  onInteract: (n: Npc) => void; onTouchFoe: (idx: number) => void; onDoor?: () => void; hunt?: boolean; apiRef: { current: WorldApi | null }
}) {
  const cv = useRef<HTMLCanvasElement>(null)
  const st = useRef({ x: map.start.x, y: map.start.y, fx: map.start.x, fy: map.start.y, t: 1, face: 'down' as Dir, queue: [] as { x: number; y: number }[],
    foes: map.foes.map((f) => ({ ...f, fx: f.x, fy: f.y, t: 1, next: 0 })), near: null as Npc | null, frame: 0, ox: 0, oy: 0, VW: 1, VH: 1 })
  const props_ = useRef({ defeated, locked, paused, onInteract, onTouchFoe, onDoor, prompt, hunt })
  props_.current = { defeated, locked, paused, onInteract, onTouchFoe, onDoor, prompt, hunt }
  const held = useRef<Dir | null>(null)

  useEffect(() => {
    const s = st.current
    s.x = s.fx = map.start.x; s.y = s.fy = map.start.y; s.t = 1; s.queue = []
    s.foes = map.foes.map((f) => ({ ...f, fx: f.x, fy: f.y, t: 1, next: 0 }))
  }, [map])

  useEffect(() => {
    const s = st.current
    const alive = (i: number) => i >= props_.current.defeated
    const foeAt = (x: number, y: number) => s.foes.find((f) => alive(f.idx) && f.x === x && f.y === y)
    const nearNpc = () => map.npcs.find((n) => Math.abs(n.x - s.x) + Math.abs(n.y - s.y) === 1 || (n.stall && Math.abs(n.x - s.x) <= 1 && s.y === n.y + 2)) || null
    const tryMove = (d: Dir) => {
      s.face = d; const [dx, dy] = DV[d]; const nx = s.x + dx, ny = s.y + dy
      const f = foeAt(nx, ny); if (f) { props_.current.onTouchFoe(f.idx); return false }
      if (map.tiles[ny]?.[nx] === 'D') { props_.current.onDoor?.(); return false }
      if (blocked(map, nx, ny, props_.current.locked)) return false
      s.fx = s.x; s.fy = s.y; s.x = nx; s.y = ny; s.t = 0; return true
    }
    const api: WorldApi = {
      get held() { return held.current }, set held(v) { held.current = v; if (v) s.queue = [] },
      action: () => { const n = nearNpc(); if (n) props_.current.onInteract(n) },
      moving: () => s.queue.length > 0 || s.t < 1,
      walkTo: (x, y, adjacent) => { const p = path(map, { x: s.x, y: s.y }, { x, y }, props_.current.locked, adjacent); if (p) s.queue = adjacent ? [...p, { x, y }] : p; return !!p },
      pos: () => ({ x: s.x, y: s.y }), near: nearNpc,
      warp: (x: number, y: number) => { s.x = x; s.y = y; s.queue = []; s.t = 1 },
      screen: (x, y) => ({ x: ((x + s.ox + 0.5) / s.VW) * 100, y: ((y + s.oy) / s.VH) * 100 }),
      foe: (idx) => { const f = s.foes.find((q) => q.idx === idx); return f ? { x: f.fx + (f.x - f.fx) * f.t, y: f.fy + (f.y - f.fy) * f.t } : null },
    }
    apiRef.current = api
    const keys: Record<string, Dir> = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right' }
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || props_.current.paused) return
      const k = e.key.toLowerCase()
      if (keys[k]) { held.current = keys[k]; s.queue = []; e.preventDefault() }
      if (k === 'e') api.action()
    }
    const up = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (keys[k] && held.current === keys[k]) held.current = null }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)

    let raf = 0, last = performance.now()
    const g = cv.current!.getContext('2d')!
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; s.frame++
      const P = props_.current
      if (!P.paused) {
        if (s.t < 1) s.t = Math.min(1, s.t + dt * 7)
        if (s.t >= 1) {
          if (held.current) tryMove(held.current)
          else if (s.queue.length) {
            const n = s.queue[0]; const d: Dir = n.x > s.x ? 'right' : n.x < s.x ? 'left' : n.y > s.y ? 'down' : 'up'
            if (tryMove(d)) s.queue.shift(); else s.queue = []
          }
        }
        for (const f of s.foes) {
          if (!alive(f.idx)) continue
          if (f.t < 1) f.t = Math.min(1, f.t + dt * 3)
          if (now > f.next && f.t >= 1) {
            f.next = now + 500 + Math.random() * 900
            const d = (['up', 'down', 'left', 'right'] as Dir[])[Math.floor(Math.random() * 4)]; const [dx, dy] = DV[d]
            const nx = f.x + dx, ny = f.y + dy, [x0, y0, x1, y1] = f.room
            if (nx === s.x && ny === s.y && f.idx === P.defeated) { P.onTouchFoe(f.idx) }
            else if (nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1 && !blocked(map, nx, ny, true) && !foeAt(nx, ny) && !(nx === s.x && ny === s.y) && !f.boss) { f.fx = f.x; f.fy = f.y; f.x = nx; f.y = ny; f.t = 0 }
          }
        }
        const n = nearNpc(); if (n !== s.near) { s.near = n; P.prompt(n) }
      }
      draw(g, now)
      raf = requestAnimationFrame(loop)
    }
    const light = document.createElement('canvas')
    const draw = (g: CanvasRenderingContext2D, now: number) => {
      const c = g.canvas, VW = c.width / TS, VH = c.height / TS
      g.imageSmoothingEnabled = false
      const px = (s.fx + (s.x - s.fx) * s.t), py = (s.fy + (s.y - s.fy) * s.t)
      const camX = Math.max(0, Math.min(map.w - VW, px - VW / 2 + 0.5)), camY = Math.max(0, Math.min(map.h - VH, py - VH / 2 + 0.5))
      const ox = map.w < VW ? (VW - map.w) / 2 : -camX, oy = map.h < VH ? (VH - map.h) / 2 : -camY
      s.ox = ox; s.oy = oy; s.VW = VW; s.VH = VH
      g.fillStyle = '#0b0a0d'; g.fillRect(0, 0, c.width, c.height)
      const town = map.theme === 'town'
      const T = (name: string, X: number, Y: number) => { const f = tile(name); if (f) g.drawImage(atlas, f[0], f[1], f[2], f[3], X, Y + TS - f[3], f[2], f[3]) }
      const isFloor = (ch?: string) => ch !== undefined && ch !== '#' && ch !== ' ' && ch !== 'F' && ch !== 'B' && ch !== '~' && ch !== 'd'
      const lights: [number, number, number][] = []
      const props: [string, number, number][] = []
      for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
        const ch = map.tiles[y][x], X = Math.round((x + ox) * TS), Y = Math.round((y + oy) * TS)
        if (X < -TS || Y < -2 * TS || X > c.width || Y > c.height + TS || ch === ' ') continue
        const v = (x * 7 + y * 13 + (x * y) % 5) % 23
        if (ch === '#' || ch === 'F' || ch === 'B' || ch === 'd') {
          const below = map.tiles[y + 1]?.[x]
          if (isFloor(below)) {
            T('wall_mid', X, Y)
            if (ch === 'F') { lights.push([x + 0.5, y + 0.6, 3.2]); const fl = Math.floor(now / 120 + x) % 3
              g.fillStyle = '#5a3a22'; g.fillRect(X + 7, Y + 7, 2, 5); g.fillStyle = ['#ffd24a', '#ff9b3d', '#ffe9a0'][fl]; g.fillRect(X + 6, Y + 3 - (fl === 2 ? 1 : 0), 4, 4); g.fillStyle = '#fff5d0'; g.fillRect(X + 7, Y + 5, 2, 2) }
            if (ch === 'B') T(town ? 'wall_banner_green' : (x % 2 ? 'wall_banner_red' : 'wall_banner_blue'), X, Y)
            else if (ch === 'd') drawDoor(g, X, Y)
            else if (ch === '#' && v === 3) T('wall_hole_1', X, Y)
            else if (ch === '#' && (v === 7 || v === 15)) drawNiche(g, X, Y)
            else if (ch === '#' && v === 11) T('wall_goo', X, Y)
            else if (HALLOWEEN && ch === '#' && (v === 5 || v === 19)) drawWeb(g, X, Y, v === 19)
            T('wall_top_mid', X, Y - TS); g.fillStyle = '#a89878'; g.fillRect(X, Y - TS + 1, TS, 1)
          } else if (!isFloor(map.tiles[y - 1]?.[x])) { g.fillStyle = '#1b1920'; g.fillRect(X, Y, TS, TS); g.fillStyle = '#27242c'; g.fillRect(X + ((x * 5 + y * 3) % 9), Y + ((x * 3 + y) % 11), 4, 2)
            // stone trim where the wall top meets floor on the sides / below
            g.fillStyle = '#8f8068'; if (isFloor(map.tiles[y][x - 1])) g.fillRect(X, Y, 2, TS); if (isFloor(map.tiles[y][x + 1])) g.fillRect(X + TS - 2, Y, 2, TS); if (isFloor(map.tiles[y + 1]?.[x])) g.fillRect(X, Y + TS - 2, TS, 2) }
          else { T('wall_top_mid', X, Y); g.fillStyle = '#a89878'; g.fillRect(X, Y + 1, TS, 1) }
          continue
        }
        if (ch === '~' && !town) { g.fillStyle = '#132a3a'; g.fillRect(X, Y, TS, TS); g.fillStyle = '#2d5d78'; const w = Math.floor(now / 400 + x) % 4; g.fillRect(X + 2 + w * 2, Y + 5 + (x % 2) * 5, 5, 1); continue }
        if (town && ch === '~') { drawFountain(g, X, Y, x, y, map, now); if (map.tiles[y - 1]?.[x] === '~' && map.tiles[y + 1]?.[x] === '~' && map.tiles[y][x - 1] === '~') lights.push([x + 0.5, y + 0.5, 2.6]); continue }
        if (town) drawCobble(g, X, Y, x, y, ch === ',' || ch === 'D')
        else T(v < 15 ? 'floor_1' : 'floor_' + (2 + (v % 7)), X, Y)
        if (!town) { g.fillStyle = town ? 'rgba(70,90,120,.12)' : 'rgba(60,80,115,.22)'; g.fillRect(X, Y, TS, TS) }
        if (v === 9 || v === 17) { g.fillStyle = '#5d5866'; g.fillRect(X + (x * 7) % 12 + 1, Y + (y * 5) % 12 + 2, 2, 1); g.fillRect(X + (x * 3) % 10 + 4, Y + (y * 7) % 10 + 4, 1, 1) }
        if (v === 13) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X + 3, Y + 8, 6, 1); g.fillRect(X + 8, Y + 9, 1, 3) }
        if (!isFloor(map.tiles[y - 1]?.[x])) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(X, Y, TS, 5); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X, Y + 5, TS, 3) }
        if (!isFloor(map.tiles[y]?.[x - 1])) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X, Y, 3, TS) }
        if (ch === 'D') { g.fillStyle = '#0b0a0d'; g.fillRect(X, Y, TS, TS); T('floor_stairs', X, Y) }
        if (ch === 'X' && props_.current.locked) { g.fillStyle = '#3a3640'; for (let i = 0; i < 4; i++) g.fillRect(X + 2 + i * 4, Y, 2, TS); g.fillStyle = '#5c5766'; g.fillRect(X, Y + 5, TS, 2); g.fillRect(X, Y + 11, TS, 2) }
        if (ch === 'g') { g.fillStyle = '#121014'; g.fillRect(X + 2, Y + 2, 12, 12); g.fillStyle = '#4a4552'; for (let i = 0; i < 4; i++) { g.fillRect(X + 2 + i * 4, Y + 2, 1, 12); g.fillRect(X + 2, Y + 2 + i * 4, 12, 1) } }
        if (ch === 'k') T('skull', X, Y)
        if (HALLOWEEN && (v === 4 || v === 21) && ((x + y) % 3 === 0) && !'chobnuDXgkYTlf~'.includes(ch)) { props.push(['j', X, Y]) }
        if (ch === 'r') drawRubble(g, X, Y, x + y)
        if ('chobnulf'.includes(ch)) props.push([ch, X, Y])
      }
      for (const [ch, X, Y] of props) {
        if (ch === 'c') T('crate', X, Y)
        if (ch === 'h') T('chest_full_open_anim_f0', X, Y)
        if (ch === 'o') T('column', X, Y)
        if (ch === 'b') drawBarrel(g, X, Y)
        if (ch === 'f') drawFlowers(g, X, Y)
        if (ch === 'l') { drawLamp(g, X, Y, now); lights.push([(X / TS) - ox + 0.5, (Y / TS) - oy - 0.6, 3]) }
        if (ch === 'u') drawStatue(g, X, Y)
        if (ch === 'j') { drawJack(g, X, Y, now); lights.push([(X / TS) - ox + 0.5, (Y / TS) - oy + 0.6, 1.8]) }
        if (ch === 'n') { drawCandle(g, X, Y, now); lights.push([(X / TS) - ox + 0.5, (Y / TS) - oy + 0.2, 2.3]) }
      }
      const actors: { key: string; x: number; y: number; moving: boolean; scale?: number; boss?: boolean; stall?: Npc }[] = []
      if (town) {
        const gate = map.npcs.find((n) => n.kind === 'gate')
        if (gate) drawCastle(g, Math.round((gate.x + ox) * TS), Math.round((gate.y + oy) * TS), now)
      }
      for (const n of map.npcs) { if (town && n.kind === 'gate') continue; actors.push({ key: n.sprite, x: n.x, y: n.y, moving: false })
        if (n.stall) { drawStallBack(g, Math.round((n.x + ox) * TS), Math.round((n.y + oy) * TS), n.stall, now); actors.push({ key: '', x: n.x, y: n.y + 0.6, moving: false, stall: n }) } }
      for (const f of s.foes) if (alive(f.idx)) actors.push({ key: f.sprite, x: f.fx + (f.x - f.fx) * f.t, y: f.fy + (f.y - f.fy) * f.t, moving: f.t < 1, boss: f.boss })
      actors.push({ key: 'hero', x: px, y: py, moving: s.t < 1 || !!held.current })
      actors.sort((a, b) => a.y - b.y)
      for (const a of actors) {
        if (a.stall) { drawStallFront(g, Math.round((a.stall.x + ox) * TS), Math.round((a.stall.y + oy) * TS), a.stall, now); continue }
        const fr = frameOf(a.key, now + a.x * 97, a.moving); const w = fr.w * fr.scale, h = fr.h * fr.scale
        const X = Math.round((a.x + ox) * TS + (TS - w) / 2), Y = Math.round((a.y + oy) * TS + TS - h)
        if (a.boss) { // boss aura: a pulsing glow behind the big version of the level's family
          const cx = X + w / 2, cy = Y + h * 0.6, rr = Math.max(w, h) * (0.62 + 0.06 * Math.sin(now / 220))
          const gr = g.createRadialGradient(cx, cy, 2, cx, cy, rr); gr.addColorStop(0, 'rgba(255,70,40,.45)'); gr.addColorStop(1, 'rgba(255,70,40,0)')
          g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.fill()
        }
        g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(X + w / 2, Math.round((a.y + oy) * TS) + TS - 1, w / 3, 2, 0, 0, 7); g.fill()
        const flip = a.key === 'hero' && s.face === 'left'
        if (flip) { g.save(); g.translate(X + w, Y); g.scale(-1, 1); g.drawImage(fr.img, fr.sx, fr.sy, fr.w, fr.h, 0, 0, w, h); g.restore() }
        else g.drawImage(fr.img, fr.sx, fr.sy, fr.w, fr.h, X, Y, w, h)
      }
      // lighting: darkness with warm holes around torches and the hero
      light.width = c.width; light.height = c.height
      const L = light.getContext('2d')!
      L.fillStyle = town ? 'rgba(10,8,20,.38)' : 'rgba(6,4,12,.78)'; L.fillRect(0, 0, c.width, c.height)
      L.globalCompositeOperation = 'destination-out'
      const hole = (x: number, y: number, r: number, a: number) => { const gx = (x + ox) * TS, gy = (y + oy) * TS, rad = r * TS
        const gr = L.createRadialGradient(gx, gy, 0, gx, gy, rad); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); L.fillStyle = gr; L.fillRect(gx - rad, gy - rad, rad * 2, rad * 2) }
      const fl = (i: number) => 1 + Math.sin(now / 70 + i * 1.7) * 0.05 + Math.sin(now / 23 + i * 3.1) * 0.03
      lights.forEach(([x, y, r], i) => { if (r) hole(x, y, r * fl(i), 1) })
      hole(px + 0.5, py + 0.5, 4.2, 0.9)
      g.drawImage(light, 0, 0)
      g.globalCompositeOperation = 'lighter'
      lights.forEach(([x, y, r], i) => { if (!r) return; const gx = (x + ox) * TS, gy = (y + oy) * TS, rad = r * TS * 0.85 * fl(i)
        const gr = g.createRadialGradient(gx, gy, 0, gx, gy, rad); gr.addColorStop(0, 'rgba(255,160,60,.22)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(gx - rad, gy - rad, rad * 2, rad * 2) })
      g.globalCompositeOperation = 'source-over'
      if (HALLOWEEN) { // drifting purple fog + faint orange tint
        const t = now / 9000
        for (let i = 0; i < 4; i++) { const fx = ((Math.sin(t + i * 1.9) + 1) / 2) * c.width, fy = ((i + 0.5) / 4) * c.height + Math.sin(t * 2 + i) * 10, r = c.width * 0.45
          const gr = g.createRadialGradient(fx, fy, 0, fx, fy, r); gr.addColorStop(0, 'rgba(120,90,160,.13)'); gr.addColorStop(1, 'rgba(120,90,160,0)'); g.fillStyle = gr; g.fillRect(fx - r, fy - r, r * 2, r * 2) }
        g.fillStyle = 'rgba(255,120,30,.035)'; g.fillRect(0, 0, c.width, c.height)
      }
      if (s.near && !props_.current.paused) {
        const X = Math.round((s.near.x + ox) * TS + TS / 2), Y = Math.round((s.near.y + oy) * TS) - 14
        g.font = '8px Silkscreen, monospace'; const label = s.near.kind === 'gate' ? 'E · ENTER' : 'E · ' + s.near.label; const w = g.measureText(label).width + 6
        g.fillStyle = '#d4fc50'; g.fillRect(Math.round(X - w / 2), Y - 9, Math.round(w), 11); g.fillStyle = '#0d0d0d'; g.fillText(label, Math.round(X - w / 2 + 3), Y - 1)
      }
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [map, apiRef])

  const onTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = cv.current!, r = c.getBoundingClientRect(), s = st.current
    const VW = c.width / TS, VH = c.height / TS
    const camX = Math.max(0, Math.min(map.w - VW, s.x - VW / 2 + 0.5)), camY = Math.max(0, Math.min(map.h - VH, s.y - VH / 2 + 0.5))
    const ox = map.w < VW ? (VW - map.w) / 2 : -camX, oy = map.h < VH ? (VH - map.h) / 2 : -camY
    const tx = Math.floor(((e.clientX - r.left) / r.width) * VW - ox), ty = Math.floor(((e.clientY - r.top) / r.height) * VH - oy)
    const npc = map.npcs.find((n) => n.x === tx && n.y === ty)
    if (npc && Math.abs(npc.x - s.x) + Math.abs(npc.y - s.y) === 1) return props_.current.onInteract(npc)
    const foe = s.foes.find((f) => f.idx >= props_.current.defeated && f.x === tx && f.y === ty)
    const adj = Math.abs(tx - s.x) + Math.abs(ty - s.y) === 1
    if (foe && adj) return props_.current.onTouchFoe(foe.idx)
    if (foe && !props_.current.hunt) return // walking to a foe for you is the Auto-Hunt boost
    if (map.tiles[ty]?.[tx] === 'D' && adj) return props_.current.onDoor?.()
    apiRef.current?.walkTo(tx, ty, !!npc || !!foe || map.tiles[ty]?.[tx] === 'D')
  }
  const small = typeof window !== 'undefined' && window.innerWidth < 760
  return <canvas ref={cv} className="world" width={(small ? 11 : 18) * TS} height={(small ? 15 : 11) * TS} onPointerDown={onTap} />
}

// original props (drawn in code, not from any reference art)
type G = CanvasRenderingContext2D
const R = (g: G, c: string, x: number, y: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x, y, w, h) }
function drawBarrel(g: G, X: number, Y: number) {
  R(g, 'rgba(0,0,0,.35)', X + 2, Y + 14, 12, 2)
  R(g, '#5a3a22', X + 3, Y + 1, 10, 14); R(g, '#7a5232', X + 2, Y + 3, 12, 10); R(g, '#9a6a40', X + 5, Y + 3, 2, 10)
  R(g, '#3e3a44', X + 2, Y + 4, 12, 1); R(g, '#3e3a44', X + 2, Y + 11, 12, 1); R(g, '#6e6a78', X + 3, Y + 4, 2, 1); R(g, '#6e6a78', X + 3, Y + 11, 2, 1)
  R(g, '#4a301c', X + 4, Y + 1, 8, 2); R(g, '#2a1a10', X + 5, Y + 1, 6, 1)
}
function drawRubble(g: G, X: number, Y: number, k: number) {
  R(g, '#6a4628', X + 1, Y + 9 + (k % 2), 13, 2); R(g, '#8a6038', X + 1, Y + 9 + (k % 2), 13, 1)
  R(g, '#5a3a22', X + 4, Y + 13, 9, 2)
  for (const [a, b] of [[3, 6], [7, 5], [10, 7], [6, 8]]) { R(g, '#4e4a58', X + a, Y + b, 3, 3); R(g, '#6e6a7a', X + a, Y + b, 2, 1) }
}
function drawCandle(g: G, X: number, Y: number, now: number) {
  R(g, '#6a5228', X + 5, Y + 13, 6, 2); R(g, '#c89a3a', X + 7, Y + 4, 2, 10); R(g, '#e8c060', X + 5, Y + 4, 6, 1)
  R(g, '#efe6d0', X + 7, Y + 1, 2, 3)
  const f = Math.floor(now / 110 + X) % 3; R(g, ['#ffd24a', '#ff9b3d', '#ffe9a0'][f], X + 7, Y - 2 - (f === 2 ? 1 : 0), 2, 3); R(g, '#fff5d0', X + 7, Y - 1, 1, 1)
}
function drawStatue(g: G, X: number, Y: number) {
  R(g, 'rgba(0,0,0,.35)', X, Y + 14, 16, 2)
  R(g, '#3c3946', X + 1, Y + 9, 14, 6); R(g, '#5a5664', X + 1, Y + 9, 14, 1); R(g, '#2c2a34', X + 1, Y + 14, 14, 1)
  R(g, '#6b6672', X + 4, Y - 6, 8, 15); R(g, '#7e7986', X + 2, Y - 6, 12, 4); R(g, '#8a8592', X + 5, Y - 12, 6, 6); R(g, '#5a5664', X + 6, Y - 9, 4, 1)
  R(g, '#4a4652', X + 7, Y - 2, 2, 11); R(g, '#9a95a2', X + 12, Y - 11, 1, 16); R(g, '#7e7986', X + 10, Y - 4, 5, 1)
}
function drawWeb(g: G, X: number, Y: number, right: boolean) {
  g.save(); if (right) { g.translate(X + TS, Y); g.scale(-1, 1); X = 0; Y = 0 } g.strokeStyle = 'rgba(220,220,230,.55)'; g.lineWidth = 0.6; g.beginPath()
  for (const [a, b] of [[TS, 0], [0, TS], [TS * 0.8, TS * 0.6], [TS * 0.45, TS]]) { g.moveTo(X, Y); g.lineTo(X + a, Y + b) }
  for (const r of [4, 8, 12]) { g.moveTo(X + r, Y); g.quadraticCurveTo(X + r * 0.75, Y + r * 0.75, X, Y + r) }
  g.stroke(); g.restore()
}
function drawJack(g: G, X: number, Y: number, now: number) {
  R(g, 'rgba(0,0,0,.35)', X + 3, Y + 13, 10, 2); R(g, '#c85a12', X + 3, Y + 6, 10, 8); R(g, '#e8781e', X + 4, Y + 5, 8, 9); R(g, '#a8480e', X + 7, Y + 6, 2, 8); R(g, '#3a6a1e', X + 7, Y + 3, 2, 3)
  const f = Math.floor(now / 140 + X) % 3, c = ['#ffe066', '#ffb02e', '#fff1a8'][f]
  R(g, c, X + 5, Y + 8, 2, 2); R(g, c, X + 9, Y + 8, 2, 2); R(g, c, X + 5, Y + 11, 6, 1); R(g, c, X + 6, Y + 12, 1, 1); R(g, c, X + 9, Y + 12, 1, 1)
}
function drawNiche(g: G, X: number, Y: number) { R(g, '#120f16', X + 4, Y + 4, 8, 10); R(g, '#120f16', X + 5, Y + 3, 6, 1); R(g, '#8f8068', X + 3, Y + 14, 10, 1) }
function drawDoor(g: G, X: number, Y: number) {
  R(g, '#2a2420', X + 2, Y + 2, 12, 14); R(g, '#3a2414', X + 3, Y + 4, 10, 12); R(g, '#3a2414', X + 4, Y + 3, 8, 1)
  R(g, '#5a3a22', X + 4, Y + 5, 3, 11); R(g, '#5a3a22', X + 9, Y + 5, 3, 11); R(g, '#c89a3a', X + 10, Y + 10, 1, 1); R(g, '#8f8068', X + 2, Y + 1, 12, 1)
}

function drawCastle(g: G, X: number, Y: number, now: number) {
  const L = X - TS, Wd = TS * 3
  R(g, 'rgba(0,0,0,.45)', L + 2, Y + TS - 1, Wd - 4, 4)
  R(g, '#35313d', L + 3, Y - TS * 2 + 4, Wd - 6, TS * 3)
  R(g, '#585263', L + 4, Y - TS * 2 + 5, Wd - 8, 2)
  R(g, '#27242e', L + 8, Y - TS + 1, Wd - 16, TS * 2 - 1)
  R(g, '#15131a', X + 2, Y - TS + 7, TS - 4, TS + 9)
  R(g, '#9a94a2', X + 4, Y - TS + 7, 2, TS + 8); R(g, '#9a94a2', X + TS - 6, Y - TS + 7, 2, TS + 8)
  for (const tx of [L + 3, L + Wd - 8]) {
    R(g, '#494452', tx, Y - TS * 2 - 2, 5, TS + 5); R(g, '#6e6878', tx + 1, Y - TS * 2 - 3, 3, 2)
    R(g, '#494452', tx + 1, Y - TS * 2 - 6, 3, 4)
  }
  R(g, '#d4fc50', X + 5, Y - TS * 2 + 8, 6, 2); R(g, '#d4fc50', X + 7, Y - TS * 2 + 6, 2, 6)
  g.font = '7px Silkscreen, monospace'; const label = 'ENTER', w = g.measureText(label).width + 8
  const bob = Math.sin(now / 260) * 2, sx = Math.round(X + TS / 2 - w / 2), sy = Math.round(Y - TS * 2 - 16 + bob)
  R(g, '#d4fc50', sx, sy, w, 10); R(g, '#0d0d0d', sx - 1, sy + 2, 1, 6); R(g, '#0d0d0d', sx + w, sy + 2, 1, 6)
  g.fillStyle = '#0d0d0d'; g.fillText(label, sx + 4, sy + 7)
}

// ---- market town (original pixel art drawn in code, matching the 16x16 dungeon style) ----
function drawCobble(g: G, X: number, Y: number, x: number, y: number, flag: boolean) {
  R(g, flag ? '#6c6458' : '#4a4550', X, Y, TS, TS)
  const top = flag ? '#8a8070' : '#615b68', hi = flag ? '#a09482' : '#736c7a'
  for (let r = 0; r < 3; r++) { const off = ((y * 3 + r) % 2) * 3
    for (let k = -1; k < 3; k++) { const sx = X + k * 6 + off, sy = Y + r * 5 + 1, w = 5 - ((x + k + r) % 3 === 0 ? 1 : 0)
      const a = Math.max(sx, X), b = Math.min(sx + w, X + TS); if (b - a < 1) continue
      R(g, top, a, sy, b - a, 4); R(g, hi, a, sy, Math.min(2, b - a), 1) } }
}
function drawFountain(g: G, X: number, Y: number, x: number, y: number, m: { tiles: string[][] }, now: number) {
  const W = (dx: number, dy: number) => m.tiles[y + dy]?.[x + dx] === '~'
  R(g, '#1d4660', X, Y, TS, TS); const w = Math.floor(now / 300 + x + y) % 4; R(g, '#4c8fb0', X + 2 + w * 2, Y + 6 + ((x + y) % 2) * 4, 5, 1)
  R(g, '#9a94a2', 0, 0, 0, 0)
  if (!W(0, -1)) { R(g, '#8a8494', X, Y, TS, 4); R(g, '#b0aab8', X, Y, TS, 1) }
  if (!W(0, 1)) { R(g, '#6c6676', X, Y + 11, TS, 5); R(g, '#8a8494', X, Y + 11, TS, 1) }
  if (!W(-1, 0)) { R(g, '#7a7484', X, Y, 3, TS) } if (!W(1, 0)) { R(g, '#7a7484', X + 13, Y, 3, TS) }
  if (W(0, -1) && W(0, 1) && W(-1, 0) && W(1, 0)) { // center spout + spray
    R(g, '#8a8494', X + 4, Y + 8, 8, 6); R(g, '#b0aab8', X + 6, Y - 2, 4, 10); R(g, '#d0cad8', X + 6, Y - 2, 4, 1)
    const f = Math.floor(now / 120) % 3; R(g, 'rgba(180,225,255,.8)', X + 7, Y - 8 - f, 2, 6 + f); R(g, 'rgba(180,225,255,.6)', X + 3 - f, Y - 4 + f, 2, 2); R(g, 'rgba(180,225,255,.6)', X + 11 + f, Y - 4 + f, 2, 2)
  }
}
function drawLamp(g: G, X: number, Y: number, now: number) {
  R(g, 'rgba(0,0,0,.35)', X + 4, Y + 14, 8, 2); R(g, '#2a2830', X + 5, Y + 12, 6, 3); R(g, '#3a3842', X + 7, Y - 10, 2, 23)
  R(g, '#2a2830', X + 4, Y - 16, 8, 2); R(g, '#2a2830', X + 5, Y - 14, 6, 6); const f = Math.floor(now / 160 + X) % 3
  R(g, ['#ffd24a', '#ffbe3d', '#ffe9a0'][f], X + 6, Y - 13, 4, 4); R(g, '#2a2830', X + 7, Y - 18, 2, 2)
}
function drawFlowers(g: G, X: number, Y: number) {
  R(g, 'rgba(0,0,0,.35)', X + 1, Y + 14, 14, 2); R(g, '#6a4628', X + 1, Y + 8, 14, 7); R(g, '#8a6038', X + 1, Y + 8, 14, 1); R(g, '#4a301c', X + 1, Y + 11, 14, 1)
  R(g, '#3e7a2e', X + 2, Y + 4, 12, 4); const cs = ['#e8506a', '#ffd24a', '#c070e0', '#f0f0f0']
  for (let i = 0; i < 5; i++) { R(g, cs[(i + X / 16) % 4 | 0], X + 2 + i * 3, Y + 3 + (i % 2) * 2, 2, 2) }
}
const STALL: Record<string, { a: string; b: string; sign: string }> = {
  armory: { a: '#b8343a', b: '#efe6d0', sign: 'ARMORY' }, potions: { a: '#2e8a4a', b: '#e8f0d0', sign: 'POTIONS' }, tailor: { a: '#7a3aa8', b: '#f0d8f0', sign: 'TAILOR' },
  forge: { a: '#5a3a22', b: '#c8742a', sign: 'FORGE' }, arena: { a: '#3a3a48', b: '#c83a3a', sign: 'ARENA' }, post: { a: '#2a5aa8', b: '#e0ecf8', sign: 'POST' }, board: { a: '#6a4a2a', b: '#d8b878', sign: 'NOTICES' },
}
/** back of a stall (row of the keeper and the roof row above): posts, back wall, shelves */
function drawStallBack(g: G, X: number, Y: number, kind: string, now: number) {
  const L = X - TS, Wd = TS * 3
  R(g, '#3a2414', L + 1, Y - TS + 2, Wd - 2, TS + 6); R(g, '#4a301c', L + 1, Y - TS + 2, Wd - 2, 1)
  for (let i = 0; i < 6; i++) R(g, '#2e1c10', L + 1 + i * 8, Y - TS + 2, 1, TS + 6)
  R(g, '#6a4628', L + 2, Y - 4, 10, 2); R(g, '#6a4628', L + Wd - 12, Y - 4, 10, 2) // shelves
  const goods: Record<string, string[]> = { armory: ['#c0c0d0', '#8a8a9a'], potions: ['#e83a4a', '#3a8ae8', '#e8c83a'], tailor: ['#c83a8a', '#3ac8a8', '#e8e0a0'], forge: ['#8a8a9a', '#c8742a'], arena: ['#c0c0d0', '#c83a3a'], post: ['#e8dcb8', '#c8a868'], board: ['#efe6d0', '#e8d090'] }
  const gs = goods[kind] || ['#999']
  for (let i = 0; i < 3; i++) { R(g, gs[i % gs.length], L + 3 + i * 3, Y - 8, 2, 4); R(g, gs[(i + 1) % gs.length], L + Wd - 11 + i * 3, Y - 8, 2, 4) }
  if (kind === 'board') for (let i = 0; i < 4; i++) R(g, i % 2 ? '#efe6d0' : '#e8d090', L + 4 + i * 10, Y - TS + 5 + (i % 2) * 3, 7, 6)
  if (kind === 'forge') { const f = Math.floor(now / 130) % 3; R(g, '#2a2420', L + Wd - 13, Y - TS + 3, 11, 12); R(g, ['#ff7a2a', '#ffb03a', '#ff5a1a'][f], L + Wd - 11, Y - TS + 8, 7, 5) }
  R(g, '#5a3a22', L, Y - TS, 2, TS * 2 + 4); R(g, '#5a3a22', L + Wd - 2, Y - TS, 2, TS * 2 + 4) // posts
}
/** front of a stall: counter with goods, striped awning, hanging sign */
function drawStallFront(g: G, X: number, Y: number, n: { stall?: string; x: number }, now: number) {
  const k = n.stall || '', st = STALL[k] || STALL.armory, L = X - TS, Wd = TS * 3, cy = Y + TS
  // counter
  R(g, 'rgba(0,0,0,.35)', L, cy + TS - 2, Wd, 3); R(g, '#7a5232', L, cy + 2, Wd, TS - 3); R(g, '#9a6a40', L, cy + 1, Wd, 3); R(g, '#b88050', L, cy + 1, Wd, 1)
  for (let i = 0; i < 6; i++) R(g, '#5a3a22', L + 3 + i * 8, cy + 5, 1, TS - 7)
  R(g, '#5a3a22', L, cy + 4, Wd, 1)
  // goods on the counter
  const gx = L + 4, gy = cy - 3
  if (k === 'armory') { R(g, '#c0c0d0', gx, gy - 6, 2, 9); R(g, '#6a4628', gx - 1, gy + 2, 4, 1); R(g, '#8a8a9a', gx + 7, gy - 3, 8, 7); R(g, '#c8a040', gx + 10, gy - 1, 2, 2); R(g, '#c0c0d0', gx + 20, gy - 8, 1, 11); R(g, '#c0c0d0', gx + 30, gy - 2, 7, 5) }
  else if (k === 'potions') ['#e83a4a', '#3a8ae8', '#e8c83a', '#a03ae8', '#e83a4a'].forEach((c, i) => { R(g, '#efe6d0', gx + i * 8 + 1, gy - 6, 2, 2); R(g, c, gx + i * 8, gy - 4, 4, 6) })
  else if (k === 'tailor') ['#c83a8a', '#3ac8a8', '#e8e0a0', '#3a6ae8'].forEach((c, i) => { R(g, c, gx + i * 10, gy - 2 - (i % 2) * 2, 8, 4 + (i % 2) * 2); R(g, 'rgba(0,0,0,.2)', gx + i * 10, gy, 8, 1) })
  else if (k === 'forge') { R(g, '#3a3842', gx + 24, gy - 5, 12, 4); R(g, '#3a3842', gx + 27, gy - 1, 6, 3); R(g, '#5a5866', gx + 24, gy - 5, 12, 1); R(g, '#c8742a', gx + 2, gy - 2, 6, 2); R(g, '#8a8a9a', gx + 10, gy - 2, 6, 2); R(g, '#6a4628', gx + 30, gy - 10, 1, 5); R(g, '#8a8a9a', gx + 28, gy - 11, 5, 2) }
  else if (k === 'arena') { R(g, '#8a8a9a', gx + 4, gy - 5, 8, 6); R(g, '#c83a3a', gx + 7, gy - 8, 2, 3); R(g, '#6a4628', gx + 22, gy - 10, 1, 12); R(g, '#c0c0d0', gx + 21, gy - 12, 3, 3) }
  else if (k === 'post') { R(g, '#e8dcb8', gx + 2, gy - 3, 9, 5); R(g, '#c83a3a', gx + 6, gy - 1, 2, 2); R(g, '#e8dcb8', gx + 16, gy - 4, 4, 6); R(g, '#c8a868', gx + 16, gy - 4, 4, 1); R(g, '#e8dcb8', gx + 26, gy - 3, 9, 5) }
  else if (k === 'board') { R(g, '#efe6d0', gx + 4, gy - 3, 8, 5); R(g, '#3a3842', gx + 18, gy - 4, 2, 6); R(g, '#efe6d0', gx + 26, gy - 2, 8, 4) }
  // awning: stripes + scalloped edge, over the roof row
  const ay = Y - TS - 6
  for (let i = 0; i < 8; i++) R(g, i % 2 ? st.b : st.a, L - 2 + i * 6.5, ay, 7, 12)
  R(g, 'rgba(0,0,0,.25)', L - 2, ay + 11, Wd + 4, 1)
  for (let i = 0; i < 8; i++) { R(g, i % 2 ? st.b : st.a, L - 1 + i * 6.5, ay + 12, 5, 2); R(g, i % 2 ? st.b : st.a, L + i * 6.5, ay + 14, 3, 1) }
  R(g, 'rgba(255,255,255,.18)', L - 2, ay, Wd + 4, 1)
  // hanging sign above the roof
  g.font = '7px Silkscreen, monospace'; const tw = Math.ceil(g.measureText(st.sign).width) + 6, sx = Math.round(X + TS / 2 - tw / 2), sy = ay - 10
  R(g, '#3a2414', sx + 3, sy - 3, 1, 3); R(g, '#3a2414', sx + tw - 4, sy - 3, 1, 3)
  R(g, '#2a1a10', sx - 1, sy - 1, tw + 2, 10); R(g, '#8a6038', sx, sy, tw, 8); R(g, '#a07040', sx, sy, tw, 1)
  g.fillStyle = '#1a120a'; g.fillText(st.sign, sx + 3, sy + 7)
  void now
}
