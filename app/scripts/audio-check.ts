// Static sound check: every audio.sfx('name') used in the app has a synth, and every music
// track the player asks for is actually shipped in public/audio (the cause of the silent game:
// the mp3s sat in deploy-assets/ and every /audio/*.mp3 request 404'd).
import { readFileSync, readdirSync, existsSync } from 'node:fs'
const src = readFileSync(new URL('../src/audio.ts', import.meta.url), 'utf8')
const block = src.slice(src.indexOf('const SFX'), src.indexOf('/* ---------- looping'))
const defined = new Set([...block.matchAll(/^\s{2}(\w+): \(\) =>/gm)].map((m) => m[1]))
const tracks = (src.match(/type Track = (.+)/)?.[1] || '').match(/'(\w+)'/g)!.map((x) => x.slice(1, -1))
let fails = 0
for (const t of tracks) if (!existsSync(new URL(`../public/audio/${t}.mp3`, import.meta.url))) { fails++; console.error(`FAIL music track public/audio/${t}.mp3 missing`) }
const files = readdirSync(new URL('../src', import.meta.url), { recursive: true }).filter((f) => /\.tsx?$/.test(String(f)))
for (const f of files) {
  const t = readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
  for (const m of t.matchAll(/audio\.sfx\('(\w+)'\)/g)) if (!defined.has(m[1])) { fails++; console.error(`FAIL ${f}: sfx '${m[1]}' has no synth`) }
}
console.log(fails ? `${fails} audio failures` : `audio checks passed (${defined.size} sfx, tracks: ${tracks.join(', ')})`)
process.exit(fails ? 1 : 0)
