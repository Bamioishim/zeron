import { getAddress } from 'viem'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { encodeFunctionData, formatEther, parseEther, maxUint256, parseEventLogs, keccak256, encodeAbiParameters, type Hex } from 'viem'
import { D, deployed, wifAbi, gameAbi, namesAbi, questAbi, questXAbi, shopAbi, armoryAbi, type Call } from './shared/chain'
import { rtStart, rtTick, rtDrink, EP_COST, tempo, foeMax, TICK, canFinish, WCD, AMMO_W, type RT, type Ev, type Fx } from './shared/rt'
import { HALLOWEEN, COSTUMES, WEAPONS } from './config'
import { setCostume } from './game/art'
import { totalBurned, homeStats, recentBurns, wardrobeOf, shopPrices, burnedIn, arsenalOf, type BurnRow } from './onchain'
import { ITEMS, scoreOf, dayNow, roomsFor, LEVELS, MAX_LEVEL, ONCHAIN_MAX_LEVEL, LEVEL_KIT, RECIPES, lootFor, statsFor, type ItemId, type Move, type Mode, type EnemyDef } from './shared/engine'
import { account, pub, sponsored, postRun, getKey, isFreeOnboarding } from './wallet'
import { hasPin, setPin, loginPin, resetPin, pinRe, RECOVERY_QUESTIONS } from './pin'
import { Sprite } from './sprites'
import World, { type WorldApi } from './game/World'
import { townMap, dungeonMap, type Npc, type MapDef } from './game/maps'
import { frameOf } from './game/art'
import { audio } from './audio'
import WORDMARK from './brand/zeron-wordmark.svg?raw'
import ICON from './brand/zeron-icon-clear.svg?raw'

const tx = (to: string, abi: any, functionName: string, args: any[] = []): Call => ({ to: to as Hex, value: 0n, data: encodeFunctionData({ abi, functionName, args } as any) })
const fmt = (v?: bigint) => (v === undefined ? '…' : Number(formatEther(v)).toLocaleString(undefined, { maximumFractionDigits: 2 }))
const rewardAmount = (units: number) => (units * (D.rewardScaleBps ?? 10000) / 10000).toLocaleString(undefined, { maximumFractionDigits: 3 })
const short = (a: string) => a.slice(0, 6) + '…' + a.slice(-4)
/** plain short messages for contract / relay errors; never show raw 'Execution reverted' */
export function friendly(e: any): string {
  const raw = String(e?.shortMessage || e?.message || e || '')
  const r = (raw.match(/reason:\s*([^\n.]+(?:\.[a-z]+)?)/i)?.[1] || raw).trim()
  const MAP: [RegExp, string][] = [
    [/name: unknown/i, 'No player with that @name yet. Check the spelling.'],
    [/name: taken/i, 'That @name is already taken — try another.'],
    [/no gas wif/i, "You need 0.2 WIF for gas on this move. Claim your welcome gift at the Market first."],
    [/name: invalid/i, 'Names are 3–15 characters: a–z, 0–9 and _.'],
    [/name: self/i, "That's you. Pick a friend's @name."],
    [/name: already/i, 'You already have an @name.'],
    [/insufficient|exceeds balance|transferFrom|ERC20/i, "You don't have enough WIF for that. Claim your welcome gift at the Market, earn some in the dungeon, or get $wif sent to your @name."],
    [/allowance/i, 'WIF approval missing. Try again.'],
    [/daily challenge already played/i, "You've already used today's Daily Challenge. Come back after the daily reset."],
    [/already entered|entered/i, "You've already entered today's ranked run."],
    [/used|nonce/i, 'That result was already recorded.'],
    [/expired|deadline/i, 'That took too long. Try again.'],
    // Keep configuration errors ahead of the broad signature matcher ("signer" contains "sig").
    [/RELAYER_KEY not set|relayer key.*not set|relayer.*private key/i, "Sponsored actions are unavailable because the server relayer key is missing. No transaction was sent."],
    [/RUN_SIGNER_KEY not set/i, "Reward signing is not configured on Zeron's server. No reward transaction was sent."],
    [/level|locked/i, 'Clear the previous level first.'],
    [/material|iron|hide|glow/i, 'Not enough materials for that.'],
    [/tier|max/i, "That's already at max tier."],
    [/registered|fighter/i, 'Register in the arena first (clear level 1).'],
    [/pending|challenge/i, 'You already have a duel in progress. Wait a moment.'],
    [/daily limit|sponsored|quota/i, "You've hit today's free-gas limit. Come back tomorrow."],
    [/sig/i, "The server couldn't verify that. Try again."],
    [/BLOB_READ_WRITE_TOKEN|persistent PIN storage/i, "PIN storage is not configured. Your PIN was not saved. Contact the Zeron team."],
    [/fetch|network|timeout/i, "Can't reach the network right now. Try again."],
  ]
  for (const [re, m] of MAP) if (re.test(r)) return m
  const why = raw.match(/reverted: (.+)/i)?.[1]
  if (why && !/chain rejected/i.test(why) && why.length < 90) return `That didn't go through: ${why}. Nothing was spent.`
  if (/revert/i.test(raw)) return "The chain rejected that move, so nothing was spent. Try again in a moment."
  return raw.length > 120 ? 'Something went wrong. Try again.' : raw
}
const ZERO = '0x0000000000000000000000000000000000000000'
const nameRe = /^[a-z0-9_]{3,15}$/
/** debounced, read-only @name lookup: status of `n` (who owns it) */
function useNameLookup(n: string) {
  const [st, setSt] = useState<{ n: string; owner?: string; loading: boolean }>({ n: '', loading: false })
  useEffect(() => {
    if (!nameRe.test(n)) { setSt({ n, loading: false }); return }
    setSt({ n, loading: true }); let live = true
    const t = setTimeout(async () => {
      const o = await pub.readContract({ address: D.names as Hex, abi: namesAbi, functionName: 'resolve', args: [n] }).catch(() => undefined) as string | undefined
      if (live) setSt({ n, owner: o, loading: false })
    }, 300)
    return () => { live = false; clearTimeout(t) }
  }, [n])
  return st
}
/** 4-digit PIN entry (enter + confirm) */
function PinFields({ pin, setPin: sp, pin2, setPin2, onEnter }: any) {
  const clean = (v: string) => v.replace(/\D/g, '').slice(0, 4)
  return (
    <div className="pinrow">
      <input className="pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]*" maxLength={4} placeholder="PIN" aria-label="4-digit PIN" value={pin} onChange={(e) => sp(clean(e.target.value))} />
      {setPin2 && <input className="pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]*" maxLength={4} placeholder="Confirm" aria-label="Confirm PIN" value={pin2} onChange={(e) => setPin2(clean(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && onEnter?.()} />}
    </div>
  )
}
const pinHint = (pin: string, pin2: string) => !pin ? 'Pick a 4-digit PIN. You log in with @name + PIN on any device.' : !pinRe.test(pin) ? 'PIN is 4 digits.' : pin2.length < 4 ? 'Type the PIN again to confirm.' : pin !== pin2 ? "PINs don't match." : '✓ PIN set'
/** log in on this device with @name + PIN */
function PinLogin({ onBack, backLabel }: { onBack?: () => void; backLabel?: string }) {
  const [name, setName] = useState(''), [pin, setP] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const [resetMode, setResetMode] = useState(false)
  const ok = nameRe.test(name) && pinRe.test(pin) && !busy
  const go = async (e?: any) => {
    e?.preventDefault?.(); if (!ok) return; setBusy(true); setErr('')
    try { await loginPin(name, pin); location.reload() } catch (x: any) { setErr(String(x?.message || x)); setBusy(false) }
  }
  if (resetMode) return <PinReset name={name} onBack={() => setResetMode(false)} />
  return (
    <form className="namepick" onSubmit={go} onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
      <div className="eyebrow">Log in</div>
      <p className="fine">Already have an @name? Enter it with your 4-digit PIN to load your account on this device.</p>
      <div className="at-input"><span>@</span><input autoFocus placeholder="yourname" value={name} autoCapitalize="none" autoCorrect="off" onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s/g, ''))} maxLength={15} aria-label="@name" /></div>
      <PinFields pin={pin} setPin={setP} />
      {err && <div className="fine namehint bad">{err}</div>}
      <button type="submit" className="btn lime" disabled={!ok}>{busy ? 'Checking PIN…' : 'Log in'}</button>
      <button type="button" className="linkbtn" onClick={() => setResetMode(true)} disabled={!nameRe.test(name)}>Forgot PIN? Reset with your recovery question</button>
      {onBack && <button type="button" className="linkbtn" onClick={onBack}>{backLabel || 'New here? Pick a name'}</button>}
    </form>
  )
}
function PinReset({ name, onBack }: { name: string; onBack: () => void }) {
  const [question, setQuestion] = useState<string | null>(null), [answer, setAnswer] = useState(''), [pin, setPinValue] = useState(''), [pin2, setPin2] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  useEffect(() => { if (nameRe.test(name)) fetch('/api/vault', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'salt', name }) }).then(r => r.json()).then(x => setQuestion(x.question || null)).catch(() => {}) }, [name])
  const go = async () => { if (!pinRe.test(pin) || pin !== pin2 || answer.trim().length < 2) return; setBusy(true); setErr(''); try { await resetPin(name, answer, pin); location.reload() } catch (e: any) { setErr(String(e?.message || e)); setBusy(false) } }
  return <div className="namepick" onClick={e => e.stopPropagation()}><div className="eyebrow">Reset PIN</div>{!question ? <p className="fine">No recovery question is configured for @{name}. Use a device where this account is unlocked to set one.</p> : <><p className="fine">Answer the recovery question you chose for @{name}.</p><div className="fine"><strong>{question}</strong></div><input value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Your answer" autoComplete="off" /><PinFields pin={pin} setPin={setPinValue} pin2={pin2} setPin2={setPin2} onEnter={go} />{err && <div className="fine namehint bad">{err}</div>}<button type="button" className="btn lime" disabled={busy || !pinRe.test(pin) || pin !== pin2 || answer.trim().length < 2} onClick={go}>{busy ? 'Resetting…' : 'Reset PIN'}</button></>}<button type="button" className="linkbtn" onClick={onBack}>Back to login</button></div>
}
/** set (or reset) the PIN for an @name this wallet already owns */
function SetPin({ name, onDone, onSkip, title }: { name: string; onDone: () => void; onSkip?: () => void; title?: string }) {
  const [pin, setP] = useState(''), [pin2, setP2] = useState(''), [question, setQuestion] = useState(RECOVERY_QUESTIONS[0]), [answer, setAnswer] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const ok = pinRe.test(pin) && pin === pin2 && answer.trim().length >= 2 && !busy
  const go = async () => { if (!ok) return; setBusy(true); setErr(''); try { await setPin(name, pin, question, answer); onDone() } catch (x: any) { setErr(String(x?.message || x)); setBusy(false) } }
  return (
    <div className="namepick" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
      <div className="eyebrow">{title || 'Set a PIN'}</div>
      <p className="fine">Protect @{name} with a 4-digit PIN. Then you can log in with @{name} + PIN on any phone or computer.</p>
      <select value={question} onChange={e => setQuestion(e.target.value)} aria-label="Recovery question">{RECOVERY_QUESTIONS.map(q => <option key={q}>{q}</option>)}</select>
      <input value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Recovery answer" autoComplete="off" />
      <PinFields pin={pin} setPin={setP} pin2={pin2} setPin2={setP2} onEnter={go} />
      <div className={'fine namehint ' + (ok ? 'good' : pin2.length === 4 && pin !== pin2 ? 'bad' : '')}>{pinHint(pin, pin2)}</div>
      {err && <div className="fine namehint bad">{err}</div>}
      <button type="button" className="btn lime" disabled={!ok} onClick={go}>{busy ? 'Saving…' : 'Save PIN'}</button>
      {onSkip && <button type="button" className="linkbtn" onClick={onSkip}>Later</button>}
    </div>
  )
}
/** onboarding / rename: pick an @name with a live availability check, then a PIN */
function NamePick({ me, d, busy, act, approveIfNeeded, onSkip, onDone, nudge }: any) {
  const [name, setName] = useState('')
  const [pin, setP] = useState(''), [pin2, setP2] = useState(''), [question, setQuestion] = useState(RECOVERY_QUESTIONS[0]), [answer, setAnswer] = useState('')
  const [login, setLogin] = useState(false)
  const [done, setDone] = useState<{ name: string; link: string; pinErr?: string } | null>(null)
  const [err, setErr] = useState('')
  const [taken, setTaken] = useState<string[]>([])
  const L = useNameLookup(name)
  const fee: bigint = me.name ? (d.nameFee ?? 0n) : 0n
  const isTaken = taken.includes(name) || (L.n === name && !L.loading && !!L.owner && L.owner !== ZERO)
  const free = nameRe.test(name) && !L.loading && L.n === name && L.owner === ZERO && !taken.includes(name)
  const pinOk = pinRe.test(pin) && pin === pin2 && answer.trim().length >= 2
  const ok = free && pinOk
  const hint = !name ? '3–15 characters: a–z, 0–9, _' : !nameRe.test(name) ? (name.length < 3 ? 'At least 3 characters.' : 'Only a–z, 0–9 and _ (max 15).') : isTaken ? `@${name} is already taken — try another` : L.loading || L.n !== name ? 'Checking…' : L.owner === undefined ? "Couldn't check right now." : `✓ @${name} is free`
  if (login) return <PinLogin onBack={() => setLogin(false)} />
  const claim = async (e?: any) => {
    e?.preventDefault?.(); e?.stopPropagation?.(); setErr('')
    if (!ok) return
    const n = name, p = pin
    const gift = !me.name && D.shop && me.wardrobe && !me.wardrobe.starterUsed ? [tx(D.shop!, shopAbi, 'starter')] : []
    let r: any = null
    try { r = await act('claim', [...gift, ...(fee > 0n ? approveIfNeeded('N', fee) : []), tx(D.names, namesAbi, 'claim', [n])], me.name ? `You're now @${n} (was @${me.name}).` : `Welcome, @${n}! That's your name everywhere in Zeron.`, true) }
    catch (x: any) {
      const m = friendly(x)
      if (/already taken/i.test(m)) { setTaken((t) => [...t, n]); setErr(`@${n} is already taken — try another`) } else setErr(m)
      return
    }
    if (!r) return
    let pinErr = ''
    try { await setPin(n, p, question, answer) } catch (x: any) { pinErr = String(x?.message || x) }
    setDone({ name: n, link: r.explorer, pinErr })
  }
  if (done) return done.pinErr
    ? <SetPin name={done.name} title={`You are @${done.name}. PIN not saved yet`} onDone={() => setDone({ ...done, pinErr: '' })} onSkip={() => { setDone(null); onDone?.() }} />
    : (
    <div className="namepick" onClick={(e) => e.stopPropagation()}>
      <div className="eyebrow">Name claimed</div>
      <h3 style={{ margin: '6px 0' }}>You are @{done.name}</h3>
      <p className="fine">PIN saved. Log in with @{done.name} + your PIN on any device.</p>
      <a className="fine" href={done.link} target="_blank" rel="noreferrer">View transaction ↗</a>
      <button type="button" className="btn lime" onClick={() => { setDone(null); setName(''); onDone?.() }}>Continue</button>
    </div>
  )
  return (
    <div className="namepick" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
      <div className="eyebrow">{me.name ? 'Change your @name' : nudge || 'Pick your @name'}</div>
      {!me.name && <p className="fine">Your @name is who you are in Zeron: on the boards, in the arena and when friends send you $wif. Your first name is free.</p>}
      {me.name && <p className="fine">You're @{me.name}. Renaming costs {fmt(fee)} WIF: half goes to the dead address and half to the treasury. Your old name becomes free for others.</p>}
      <div className="at-input"><span>@</span><input autoFocus placeholder="yourname" value={name} autoCapitalize="none" autoCorrect="off" onChange={(e) => { setErr(''); setName(e.target.value.toLowerCase().replace(/\s/g, '')) }} maxLength={15} aria-label="@name" /></div>
      <div className={'fine namehint ' + (free ? 'good' : name && (isTaken || (!L.loading && L.n === name)) ? 'bad' : '')}>{hint}</div>
      {free && <>
        <select value={question} onChange={e => setQuestion(e.target.value)} aria-label="Recovery question">{RECOVERY_QUESTIONS.map(q => <option key={q}>{q}</option>)}</select>
        <input value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Recovery answer" autoComplete="off" />
        <PinFields pin={pin} setPin={setP} pin2={pin2} setPin2={setP2} onEnter={claim} />
        <div className={'fine namehint ' + (pinOk ? 'good' : pin2.length === 4 && pin !== pin2 ? 'bad' : '')}>{pinHint(pin, pin2)}</div>
      </>}
      {err && <div className="fine namehint bad">{err}</div>}
      <button type="button" className="btn lime" disabled={!ok || !!busy} onClick={claim}>{busy === 'claim' ? 'Claiming…' : isTaken ? 'Name taken' : (me.name ? `Rename to @${name || '…'} · ${fmt(fee)} WIF` : `Claim @${name || '…'} · free`)}</button>
      {!me.name && <button type="button" className="linkbtn" onClick={() => setLogin(true)}>Already have an @name? Log in</button>}
      {onSkip && <button className="linkbtn" onClick={onSkip}>Skip for now</button>}
    </div>
  )
}
const PRICES_FALLBACK: Record<number, bigint> = { 1: parseEther('25'), 2: parseEther('40'), 3: parseEther('40') }
export const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
type Tab = 'world' | 'board' | 'burn' | 'how'
const EXPLORER = D.explorer.replace(/\/$/, '')
type Modal = Npc['kind'] | null

interface Quest { level: number; sword: number; armor: number; charm: number; iron: number; hide: number; glow: number; registered: boolean; rating: number; wins: number; losses: number }
interface Me { wif?: bigint; eth?: bigint; name?: string; xp?: bigint; streak?: number; entered?: boolean; playedToday?: boolean; items: Record<number, number>; allowG?: bigint; allowN?: bigint; allowQ?: bigint; allowS?: bigint; allowA?: bigint; best?: number; q: Quest; wardrobe?: { mask: number; eq: number; starterUsed: boolean }; arms?: { mask: number; eq: number; ammo: number; earnedToday: bigint } }
interface Day { pool?: bigint; leader?: string; top?: number; fee?: bigint; prices: Record<number, bigint>; destroyed?: bigint; burnBps?: number; useBurn?: boolean; nameFee?: bigint; chainDay?: number; craftFee?: bigint; pvpStake?: bigint; dailyCap?: bigint; burnedAll?: bigint }
const Q0: Quest = { level: 0, sword: 0, armor: 0, charm: 0, iron: 0, hide: 0, glow: 0, registered: false, rating: 0, wins: 0, losses: 0 }

/** number keys 1..9 while mounted */
function useNumKeys(fn: (n: number) => void) {
  const r = useRef(fn); r.current = fn
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') return; const n = Number(e.key); if (n >= 1 && n <= 9) { r.current(n); e.preventDefault() } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
}
function Svg({ src, className }: { src: string; className?: string }) { return <span className={className} dangerouslySetInnerHTML={{ __html: src }} /> }
function MuteBtn() {
  const [, f] = useState(0); useEffect(() => audio.subscribe(() => f((x) => x + 1)), [])
  const m = audio.isMuted()
  return <button className="mute" aria-label={m ? 'Sound on' : 'Mute'} title={m ? 'Sound on' : 'Mute'} onClick={(e) => { e.stopPropagation(); audio.toggle() }}>{m ? '♪ off' : '♪ on'}</button>
}
// credits live in README
export const _CREDITS = <>art: CC0 "DungeonTileset II" by 0x72 + original sprites · music: "Cave Theme" by Brandon Morris (CC0) and "Dungeon Ambience" by yd (CC0) · sfx: "512 Sound Effects (8-bit)" by Juhani Junkala (CC0), all via OpenGameArt</>

type MenuView = 'stats' | 'profile'
function MenuButton({ onSelect }: { onSelect: (view: MenuView) => void }) {
  return <div className="menu-wrap" aria-label="Account menu">
    <button className="menu-profile-btn" onClick={() => onSelect('profile')}>Profile</button>
    <button className="menu-stats-btn" onClick={() => onSelect('stats')}>Stats</button>
  </div>
}
function StatsPanel({ stats }: { stats: { burned?: bigint | null; players?: number | null; clears?: number | null } }) {
  const value = (v: bigint | number | null | undefined, format: (v: any) => string) =>
    v === undefined ? '…' : v === null ? 'unavailable' : format(v)
  return <div className="stats-panel">
    <div className="eyebrow">Stats <span className="live-label">● live on-chain</span></div>
    <div className="stats-grid">
      <div className="card"><b>{value(stats.burned, fmt)}</b><span>WIF burned</span></div>
      <div className="card"><b>{value(stats.players, (v: number) => v.toLocaleString())}</b><span>Players · indexed history</span></div>
      <div className="card"><b>{value(stats.clears, (v: number) => v.toLocaleString())}</b><span>Levels cleared · 7d</span></div>
    </div>
    <p className="fine">These figures are live from Robinhood Chain mainnet. You can verify them on-chain on Blockscout, and check them anytime under Menu → Stats.</p>
    {D.game && <a className="btn sm" href={`${EXPLORER}/address/${D.game}`} target="_blank" rel="noreferrer">View on Blockscout ↗</a>}
  </div>
}
type Friend = { name: string; address: string }
function ProfilePanel({ me, d, busy, act, approveIfNeeded, setToast }: any) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [loaded, setLoaded] = useState(false)
  const [friendName, setFriendName] = useState('')
  const [notice, setNotice] = useState('')
  const [checking, setChecking] = useState(false)
  const [selected, setSelected] = useState('')
  useEffect(() => {
    try {
      const raw = localStorage.getItem('zeron.friends.v1')
      const parsed = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) setFriends(parsed.filter((x: any) => typeof x?.name === 'string' && typeof x?.address === 'string'))
    } catch { /* local friend list is optional */ }
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (loaded) try { localStorage.setItem('zeron.friends.v1', JSON.stringify(friends)) } catch { /* storage may be unavailable */ }
  }, [friends, loaded])
  async function addFriend() {
    const n = friendName.trim().replace(/^@/, '').toLowerCase()
    if (!nameRe.test(n)) { setNotice('Use a valid Zeron @name (3–15 characters).'); return }
    setChecking(true); setNotice('')
    try {
      const owner = await pub.readContract({ address: D.names as Hex, abi: namesAbi, functionName: 'resolve', args: [n] }) as string
      if (!owner || owner === ZERO) { setNotice(`@${n} is not a registered on-chain account.`); return }
      if (owner.toLowerCase() === account().address.toLowerCase()) { setNotice("That's your own account."); return }
      setFriends(prev => [...prev.filter(f => f.name !== n), { name: n, address: owner }])
      setFriendName(''); setNotice(`Verified @${n} on Robinhood Chain.`)
    } catch { setNotice("Couldn't verify that @name on-chain. Try again.") }
    finally { setChecking(false) }
  }
  return <div className="profile-panel">
    <div className="eyebrow">Profile</div>
    <div className="card profile-self">
      <div><span className="fine">Your Zeron account</span><h2>{me.name ? '@' + me.name : 'No @name claimed yet'}</h2><span className="fine">{short(account().address)}</span></div>
      <span className="chip lime">{fmt(me.wif)} WIF</span>
    </div>
    <div className="card">
      <div className="eyebrow">Friends</div>
      <p className="fine">Add a Zeron username. Each friend is checked against the live on-chain @name registry, not just saved as a contact.</p>
      <div className="friend-add">
        <div className="at-input"><span>@</span><input value={friendName} placeholder="friendname" autoCapitalize="none" autoCorrect="off" onChange={e => setFriendName(e.target.value.toLowerCase().replace(/\s/g, ''))} maxLength={15} /></div>
        <button className="btn lime sm" disabled={checking || !nameRe.test(friendName.trim().replace(/^@/, '').toLowerCase())} onClick={addFriend}>{checking ? 'Checking…' : 'Add friend'}</button>
      </div>
      {notice && <p className="fine friend-notice">{notice}</p>}
      <div className="friend-list">
        {friends.length === 0 && <p className="fine dim">No friends added yet.</p>}
        {friends.map(friend => <div className="friend-row" key={friend.name}>
          <div><b>@{friend.name}</b><span className="fine">{short(friend.address)}</span></div>
          <div className="friend-actions">
            <button className="btn sm lime" onClick={() => setSelected(friend.name)}>Send WIF</button>
            <button className="linkbtn" onClick={() => { setFriends(prev => prev.filter(f => f.name !== friend.name)); if (selected === friend.name) setSelected('') }}>Remove</button>
          </div>
        </div>)}
      </div>
    </div>
    {selected && <div className="card profile-send">
      <div className="eyebrow">Send WIF to @{selected}</div>
      <Send key={selected} initialName={selected} compact me={me} d={d} busy={busy} act={act} approveIfNeeded={approveIfNeeded} setToast={setToast} />
    </div>}
  </div>
}
function MenuPanel({ view, onClose, stats, me, d, busy, act, approveIfNeeded, setToast }: any) {
  return createPortal(
    <div className="modal menu-overlay" onClick={onClose}>
      <div className="card menu-panel" role="dialog" aria-modal="true" aria-label={view === 'stats' ? 'Zeron stats' : 'Zeron profile'} onClick={e => e.stopPropagation()}>
        <div className="mhead"><span className="eyebrow">{view === 'stats' ? 'Stats' : 'Profile'}</span><button className="btn sm" onClick={onClose}>✕</button></div>
        {view === 'stats' ? <StatsPanel stats={stats} /> : <ProfilePanel me={me} d={d} busy={busy} act={act} approveIfNeeded={approveIfNeeded} setToast={setToast} />}
      </div>
    </div>,
    document.body
  )
}

/** title screen: slowly panning, torch-lit dungeon behind the logo and a central play panel */
/** title screen: logo, Halloween banner, one CTA and wallet status */
function Opening({ onEnter, onMenuView, me }: { onEnter: (t?: Tab) => void; onMenuView: (view: MenuView) => void; me: string }) {
  const map = useMemo(() => dungeonMap(dayNow() % 97 + 3, roomsFor({ kind: 'level', level: 2 } as any).map((r) => r.key)), [])
  const api = useRef<WorldApi | null>(null)
  useEffect(() => {
    let i = 0, alive = true
    const pts = map.foes.map((f: any) => ({ x: f.x - 2, y: f.y })).concat([{ x: map.start.x, y: map.start.y }])
    const go = () => { if (!alive) return; const p = pts[i++ % pts.length]; api.current?.walkTo(p.x, p.y); setTimeout(go, 6500) }
    const t = setTimeout(go, 800); return () => { alive = false; clearTimeout(t) }
  }, [map])
  return (
    <div className="opening">
      <div className="opening-bg" aria-hidden><World map={map} defeated={0} locked={false} paused={false} onInteract={() => {}} onTouchFoe={() => {}} apiRef={api} prompt={() => {}} /></div>
      <div className="opening-veil" />
      <div className="opening-fg">
        <div className="opening-actions"><MenuButton onSelect={onMenuView} /><MuteBtn /></div>
        {HALLOWEEN && <button className="hw-banner" onClick={() => onEnter('world')}>🎃 <b>Halloween event:</b> the Pumpkin King haunts the Gate. Beat him for a drop-only crown.</button>}
        <Svg src={ICON} className="op-icon" />
        <Svg src={WORDMARK} className="op-word" />
        <div className="op-tag">a daily pixel dungeon powered by $wif</div>
        <button className="btn lime big op-cta" onClick={() => onEnter('world')}>Enter the Depths ▸</button>
        <div className="fine op-who">Wallet ready · {short(me)} · 0 ETH needed, gas is on Zeron</div>
      </div>
    </div>
  )
}

function Key({ k }: { k: string }) { return <kbd className="key">{k}</kbd> }
/** animated pixel sprite from the CC0 atlas (or our own art) */
function Pix({ k, size = 96, flip = false }: { k: string; size?: number; flip?: boolean }) {
  const c = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let raf = 0
    const loop = (t: number) => {
      const cv = c.current; if (!cv) return; const g = cv.getContext('2d')!; g.imageSmoothingEnabled = false
      const f = frameOf(k, t); const s = Math.min(cv.width / f.w, cv.height / f.h); const w = f.w * s, h = f.h * s
      g.clearRect(0, 0, cv.width, cv.height); g.save(); if (flip) { g.translate(cv.width, 0); g.scale(-1, 1) }
      g.drawImage(f.img, f.sx, f.sy, f.w, f.h, (cv.width - w) / 2, cv.height - h, w, h); g.restore()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf)
  }, [k, flip])
  return <canvas ref={c} width={size} height={size} className="pix" style={{ width: size, height: size }} />
}

type Act = { id: number; msg: string; link?: string; err?: boolean; burned?: bigint | null; at: number; gas?: boolean }
export default function App() {
  const me = useMemo(() => account().address, [])
  const [tab, setTab] = useState<Tab>('world')
  const [opened, setOpened] = useState(false)
  const [menuView, setMenuView] = useState<MenuView | null>(null)
  const [namePrompt, setNamePrompt] = useState<string>('')
  const [m, setM] = useState<Me>({ items: {}, q: Q0 })
  const [d, setD] = useState<Day>({ prices: PRICES_FALLBACK })
  const [stats, setStats] = useState<{ burned?: bigint | null; players?: number | null; clears?: number | null }>({})
  const nudged = useRef(false)
  const claimedHere = useRef(false)
  useEffect(() => { if (m.name && !claimedHere.current) setNamePrompt('') }, [m.name])
  const [pinFor, setPinFor] = useState('')
  useEffect(() => {
    if (!m.name || claimedHere.current || sessionStorage.getItem('zeron.pinskip') === m.name) return
    let live = true; hasPin(m.name).then((h) => { if (live && !h && !claimedHere.current) setPinFor(m.name!) }).catch(() => {})
    return () => { live = false }
  }, [m.name])
  useEffect(() => { setCostume(m.wardrobe?.eq ?? 0) }, [m.wardrobe?.eq])
  const needName = deployed && m.name === ''
  const nudge = (why: string) => { if (needName && !nudged.current) { nudged.current = true; setNamePrompt(why); return true } return false }
  const [busy, setBusy] = useState<string>('')
  // toasts: auto-dismiss after 2.5 s (tap to close early); every tx is kept in the activity list
  const [toast, setToastS] = useState<Act | null>(null)
  const [acts, setActs] = useState<Act[]>([])
  const [showActs, setShowActs] = useState(false)
  const tt = useRef<any>(0)
  const setToast = useCallback((t: { msg: string; link?: string; err?: boolean; burned?: bigint | null; gas?: boolean } | null) => {
    clearTimeout(tt.current)
    if (!t) { setToastS(null); return }
    const a: Act = { id: Date.now() + Math.random(), at: Date.now(), ...t }
    setToastS(a); tt.current = setTimeout(() => setToastS(null), 2500)
    if (t.link || t.err) setActs((x) => [a, ...x].slice(0, 20))
    return a.id
  }, [])
  const [board, setBoard] = useState<any[]>([])
  const [heroes, setHeroes] = useState<any[]>([])
  const [burns, setBurns] = useState<BurnRow[] | null>(null)
  const [burnTot, setBurnTot] = useState<Awaited<ReturnType<typeof totalBurned>> | null>(null)
  const day = d.chainDay ?? dayNow()

  const refresh = useCallback(async () => {
    if (!deployed) return
    try {
      const G = D.game as Hex, W = D.wif as Hex, N = D.names as Hex, Qa = (D as any).quest as Hex
      const rc = (address: Hex, abi: any, functionName: string, args: any[] = []) => pub.readContract({ address, abi, functionName, args } as any) as Promise<any>
      const today = Number(await rc(G, gameAbi, 'today'))
      const [wif, eth, name, xp, streak, entered, i1, i2, i3, i4, p4, allowG, allowN, best, pool, leader, top, fee, p1, p2, p3, destroyed, burnBps, useBurn, nameFee, lastDay, allowS, wardrobe, tb] = await Promise.all([
        rc(W, wifAbi, 'balanceOf', [me]), pub.getBalance({ address: me }), rc(N, namesAbi, 'nameOf', [me]), rc(G, gameAbi, 'xp', [me]), rc(G, gameAbi, 'streak', [me]),
        rc(G, gameAbi, 'entered', [BigInt(today), me]), rc(G, gameAbi, 'items', [me, 1]), rc(G, gameAbi, 'items', [me, 2]), rc(G, gameAbi, 'items', [me, 3]), rc(G, gameAbi, 'items', [me, 4]), rc(G, gameAbi, 'itemPrice', [4]),
        rc(W, wifAbi, 'allowance', [me, G]), rc(W, wifAbi, 'allowance', [me, N]), rc(G, gameAbi, 'bestScore', [BigInt(today), me]),
        rc(G, gameAbi, 'pool', [BigInt(today)]), rc(G, gameAbi, 'leader', [BigInt(today)]), rc(G, gameAbi, 'topScore', [BigInt(today)]), rc(G, gameAbi, 'entryFee'),
        rc(G, gameAbi, 'itemPrice', [1]), rc(G, gameAbi, 'itemPrice', [2]), rc(G, gameAbi, 'itemPrice', [3]),
        rc(G, gameAbi, 'totalDestroyed'), rc(G, gameAbi, 'burnBps'), rc(G, gameAbi, 'useBurn'), rc(N, namesAbi, 'renameFee'), rc(G, gameAbi, 'lastRunDay', [me]),
        D.shop ? rc(W, wifAbi, 'allowance', [me, D.shop]) : Promise.resolve(0n), wardrobeOf(me), totalBurned()])
      const arms = await arsenalOf(me)
      let q = Q0, allowQ = 0n, craftFee: bigint | undefined, pvpStake: bigint | undefined
      if (Qa) {
        const [p, f, a, cf, ps] = await Promise.all([rc(Qa, questAbi, 'players', [me]), rc(Qa, questAbi, 'fighters', [me]), rc(W, wifAbi, 'allowance', [me, Qa]), rc(Qa, questAbi, 'craftFee'), rc(Qa, questAbi, 'pvpStake')])
        const xl = (D as any).questX ? Number(await rc((D as any).questX, questXAbi, 'levelOf', [me])) : p[0]
        q = { level: xl, sword: p[1], armor: p[2], charm: p[3], iron: p[4], hide: p[5], glow: p[6], registered: f[2] > 0, rating: f[4], wins: f[5], losses: f[6] }
        allowQ = a; craftFee = cf; pvpStake = ps
      }
      const liveStreak = Number(lastDay) >= today - 1 ? Number(streak) : 0
      setM({ wif, eth, name, xp, streak: liveStreak, entered, playedToday: Number(lastDay) === today, items: { 1: Number(i1), 2: Number(i2), 3: Number(i3), 4: Number(i4) }, allowG, allowN, allowQ, allowS, best: Number(best), q, wardrobe: wardrobe ?? undefined, arms: arms?.a, allowA: arms?.allow })
      setD({ pool, leader, top: Number(top), fee, prices: { 1: p1, 2: p2, 3: p3, 4: p4 }, destroyed, burnBps: Number(burnBps), useBurn, nameFee, chainDay: today, craftFee, pvpStake, dailyCap: arms?.dailyCap, burnedAll: tb.total })
      setBurnTot(tb)
    } catch (e) { console.warn(e) }
  }, [me])
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t) }, [refresh])
  useEffect(() => {
    if (!deployed) return
    let live = true
    const load = () => homeStats().then(v => { if (live) setStats(v) }).catch(() => { if (live) setStats({ burned: null, players: null, clears: null }) })
    load(); const timer = setInterval(load, 60000)
    return () => { live = false; clearInterval(timer) }
  }, [])

  const loadFighters = useCallback(async () => {
    const Qa = (D as any).quest as Hex; if (!Qa) return []
    const n = Number(await pub.readContract({ address: Qa, abi: questAbi, functionName: 'fighterCount' }))
    const addrs = await Promise.all([...Array(n)].map((_, i) => pub.readContract({ address: Qa, abi: questAbi, functionName: 'fighterList', args: [BigInt(i)] })))
    return Promise.all(addrs.map(async (a: any) => {
      const [f, p, name] = await Promise.all([pub.readContract({ address: Qa, abi: questAbi, functionName: 'fighters', args: [a] }) as any, pub.readContract({ address: Qa, abi: questAbi, functionName: 'players', args: [a] }) as any,
        BigInt(a) < 1000n ? Promise.resolve('') : pub.readContract({ address: D.names as Hex, abi: namesAbi, functionName: 'nameOf', args: [a] })])
      return { player: a as string, atk: f[0], def: f[1], hp: f[2], npc: f[3], rating: f[4], wins: f[5], losses: f[6], level: p[0], name: name as string }
    }))
  }, [])
  const loadBurns = useCallback(async () => { try { setBurns(await recentBurns()) } catch (e) { console.warn(e); setBurns([]) } }, [])

  const loadBoard = useCallback(async () => {
    if (!deployed) return
    try {
      const latest = await pub.getBlockNumber()
      const logs = await pub.getContractEvents({ address: D.game as Hex, abi: gameAbi, eventName: 'RunRecorded', args: { day: BigInt(day) } as any,
        fromBlock: latest > 400000n ? latest - 400000n : 0n, toBlock: latest })
      const best = new Map<string, number>()
      for (const l of logs as any[]) {
        const entered = await pub.readContract({ address: D.game as Hex, abi: gameAbi, functionName: 'entered', args: [BigInt(day), l.args.player] })
        if (!entered) continue
        best.set(l.args.player, Math.max(best.get(l.args.player) || 0, Number(l.args.score)))
      }
      const rows = await Promise.all([...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(async ([player, score]) => ({
        player, score, name: (await pub.readContract({ address: D.names as Hex, abi: namesAbi, functionName: 'nameOf', args: [player as Hex] })) as string })))
      setBoard(rows)
      const [fs, bs] = await Promise.all([loadFighters(), recentBurns().catch(() => [] as BurnRow[])])
      setBurns(bs)
      const per = new Map<string, bigint>(); for (const b of bs) if (b.player) per.set(b.player.toLowerCase(), (per.get(b.player.toLowerCase()) || 0n) + b.amount)
      const Qa = (D as any).quest as Hex
      const known = new Set(fs.map((f) => f.player.toLowerCase()))
      const extra = [...per.keys()].filter((a) => !known.has(a)).slice(0, 40)
      const ex = await Promise.all(extra.map(async (a) => {
        const [p, name] = await Promise.all([Qa ? pub.readContract({ address: Qa, abi: questAbi, functionName: 'players', args: [a as Hex] }).catch(() => [0]) as any : [0], pub.readContract({ address: D.names as Hex, abi: namesAbi, functionName: 'nameOf', args: [a as Hex] }).catch(() => '')])
        return { player: getAddress(a), level: Number(p[0]), wins: 0, rating: 0, npc: false, name: name as string }
      }))
      const hs = [...fs.filter((f) => !f.npc), ...ex].map((h) => ({ ...h, b: per.get(h.player.toLowerCase()) || 0n }))
        .sort((a, b) => Number(b.level) - Number(a.level) || Number(b.wins) - Number(a.wins) || (b.b > a.b ? 1 : b.b < a.b ? -1 : 0)).slice(0, 25)
      const wr = await Promise.all(hs.map((h) => wardrobeOf(h.player)))
      setHeroes(hs.map((h, i) => ({ ...h, burned: per.get(h.player.toLowerCase()) || 0n, eq: wr[i]?.eq ?? 0, mask: wr[i]?.mask ?? 1 })))
    } catch (e) { console.warn('board', e) }
  }, [day, loadFighters])
  useEffect(() => {
    if (tab === 'board') {
      loadBoard()
      const poll = window.setInterval(loadBurns, 15000)
      return () => window.clearInterval(poll)
    }
    if (tab === 'burn') {
      loadBurns()
      const poll = window.setInterval(loadBurns, 15000)
      return () => window.clearInterval(poll)
    }
  }, [tab, loadBoard, loadBurns])

  async function act(label: string, calls: Call[], ok: string, rethrow = false) {
    if (!deployed) { setToast({ msg: 'Contracts are not deployed yet, so on-chain actions are off. Free play still works.', err: true }); return null }
    if (!calls.length) { setToast({ msg: 'Nothing to send.', err: true }); return null }
    setBusy(label); setToast(null); if (label === 'claim') claimedHere.current = true
    try {
      const freeOnboarding = await isFreeOnboarding(calls)
      const r = await sponsored(calls); audio.sfx('coin')
      const gasCharged = !freeOnboarding && !!D.relayer && BigInt(D.gasFeeWei || '0') > 0n
      const id = setToast({ msg: ok, link: r.explorer, gas: gasCharged, burned: null })
      burnedIn(r.hash).then((b) => {
        setToastS((t) => (t && t.id === id ? { ...t, burned: b } : t)); setActs((x) => x.map((a) => (a.id === id ? { ...a, burned: b } : a)))
      }).catch(() => {})
      await refresh(); return r
    }
    catch (e: any) { console.warn(label, e); if (rethrow) throw e; setToast({ msg: friendly(e), err: true }); return null }
    finally { setBusy('') }
  }
  const approveIfNeeded = (spender: 'G' | 'N' | 'Q' | 'S', need: bigint): Call[] => {
    const cur = spender === 'G' ? m.allowG : spender === 'N' ? m.allowN : spender === 'S' ? m.allowS : m.allowQ
    const to = spender === 'G' ? D.game : spender === 'N' ? D.names : spender === 'S' ? D.shop : (D as any).quest
    return (cur ?? 0n) >= need ? [] : [tx(D.wif, wifAbi, 'approve', [to, maxUint256])]
  }
  const starter = () => act('starter', [tx(D.shop!, shopAbi, 'starter')], `Welcome gift: ${D.starter ?? 5} WIF is in your wallet.`)

  const sw = useRef<{ x: number; y: number } | null>(null)
  const TABS: Tab[] = ['world', 'board', 'burn', 'how']
  const onTS = (e: React.TouchEvent) => { if ((e.target as HTMLElement).closest('canvas,.pad,.fightbar,.fightov,.modal,.card,button,input,a,textarea') || document.activeElement?.tagName === 'INPUT' || !!document.querySelector('.modal')) { sw.current = null; return } sw.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTE = (e: React.TouchEvent) => {
    if (!sw.current || (e.target as HTMLElement).closest('.modal,.card,button,input') || !!document.querySelector('.modal')) { sw.current = null; return }; const dx = e.changedTouches[0].clientX - sw.current.x, dy = e.changedTouches[0].clientY - sw.current.y; sw.current = null
    if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) { const i = TABS.indexOf(tab) + (dx < 0 ? 1 : -1); if (i >= 0 && i < TABS.length) setTab(TABS[i]) }
  }

  if (!opened) return <><Opening me={me} onMenuView={setMenuView} onEnter={(t) => { audio.unlock(); setTab(t || 'world'); setOpened(true); if (needName || (deployed && m.name === undefined)) setNamePrompt('Pick your @name') }} />{menuView && <MenuPanel view={menuView} onClose={() => setMenuView(null)} stats={stats} me={m} d={d} busy={busy} act={act} approveIfNeeded={approveIfNeeded} setToast={setToast} />}</>
  return (
    <div className="shell" onTouchStart={onTS} onTouchEnd={onTE}>
      <header className="top">
        <div className="brand" onClick={() => setOpened(false)} title="Title screen"><Svg src={ICON} className="hd-icon" /><div><Svg src={WORDMARK} className="hd-word" /><div className="sub">a daily dungeon powered by $wif</div></div><MuteBtn /></div>
        <div className="wallet">
          <MenuButton onSelect={setMenuView} />
          <button className="chip namechip" title={me} onClick={() => setNamePrompt(m.name ? '' : 'Pick your @name')}><Pix k={'c' + (m.wardrobe?.eq ?? 0)} size={18} />{m.name ? '@' + m.name : m.name === '' ? 'claim @name' : '…'}</button>
          <div className="chip lime"><Sprite name="coin" size={14} /> {fmt(m.wif)} WIF</div>
          <button className="chip burnchip" onClick={() => setTab('burn')} title="Total WIF destroyed by FeeSink contracts, read on-chain">🔥 {fmt(d.burnedAll)} destroyed</button>
          <div className="chip dim" title="You never need ETH. Zeron pays the gas.">⛽ 0 ETH · gas by Zeron</div>
          <button className="chip" onClick={() => setShowActs((v) => !v)} title="Your recent transactions">≡ Activity{acts.length ? ` (${acts.length})` : ''}</button>
          {D.shop && m.wardrobe && !m.wardrobe.starterUsed && <button className="chip lime gift" disabled={!!busy} onClick={starter}>{busy === 'starter' ? '…' : `🎁 Claim ${D.starter ?? 5} WIF`}</button>}
        </div>
      </header>
      {!deployed && <div className="banner">Contracts aren't live yet, so this is practice mode.</div>}
      <nav className="tabs">
        {TABS.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => { if (t === 'board') nudge('Claim an @name to show up on the boards'); setTab(t) }}>{{ world: 'Play', board: 'Leaderboard', burn: '🔥 Destroyed', how: 'How it works' }[t]}</button>)}
      </nav>
      <main>
        <div style={{ display: tab === 'world' ? 'block' : 'none' }}>
          <Game nudge={nudge} day={day} me={m} d={d} busy={busy} act={act} approveIfNeeded={approveIfNeeded} player={me} setToast={setToast} refresh={refresh} loadFighters={loadFighters} active={tab === 'world'} starter={starter} setTab={setTab} />
        </div>
        {tab === 'board' && <Board d={d} board={board} me={me} day={day} busy={busy} act={act} reload={loadBoard} heroes={heroes} burns={burns} reloadBurns={loadBurns} />}
        {tab === 'burn' && <BurnPanel tot={burnTot} burns={burns} reload={() => { refresh(); loadBurns() }} d={d} />}
        {tab === 'how' && <How d={d} />}
      </main>
      {opened && pinFor && !namePrompt && <div className="modal"><div className="card mbox"><SetPin name={pinFor} title="New: log in anywhere" onDone={() => { setPinFor(''); setToast({ msg: `PIN saved. Log in with @${pinFor} + PIN on any device.` }) }} onSkip={() => { sessionStorage.setItem('zeron.pinskip', pinFor); setPinFor('') }} /></div></div>}
      {namePrompt && <div className="modal"><div className="card mbox"><NamePick me={m} d={d} busy={busy} act={act} approveIfNeeded={approveIfNeeded} nudge={namePrompt} onDone={() => setNamePrompt('')} onSkip={() => { nudged.current = namePrompt === 'Pick your @name' ? false : true; setNamePrompt('') }} /></div></div>}
      {toast && <div className={'toast ' + (toast.err ? 'err' : '')} onClick={() => setToast(null)} role="status">
        <div>{toast.msg}{toast.link && <> · <a href={toast.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>view tx ↗</a></>}</div>
        {toast.gas && <div className="toast-sub">⛽ Gas: 0.2 WIF (0.1 to dead address + 0.1 to relayer) · FeeSink destroyed: {toast.burned === null || toast.burned === undefined ? '…' : fmt(toast.burned)}</div>}
      </div>}
      {menuView && <MenuPanel view={menuView} onClose={() => setMenuView(null)} stats={stats} me={m} d={d} busy={busy} act={act} approveIfNeeded={approveIfNeeded} setToast={setToast} />}
      {showActs && <div className="acts card" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><span className="eyebrow">Activity</span><button className="btn sm" onClick={() => setShowActs(false)}>✕</button></div>
        {acts.length === 0 && <div className="fine dim">No transactions yet this session.</div>}
        {acts.map((a) => <div key={a.id} className={'actrow ' + (a.err ? 'bad' : '')}><span className="dim">{new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>{a.msg}{a.gas && <small className="dim"> · gas 0 ETH · FeeSink destroyed {a.burned === null || a.burned === undefined ? '…' : fmt(a.burned)} WIF</small>}</span>{a.link && <a href={a.link} target="_blank" rel="noreferrer">tx ↗</a>}</div>)}
      </div>}
      <footer>Created by Bamio for the World is Flat hackathon</footer>
    </div>
  )
}

/* ------------------------------ the walkable game: fights happen right on the map ------------------------------ */
const FXTEXT: Partial<Record<Fx, string>> = { feint: 'FEINT', heal: 'HEALS', shell: 'HARDENS', stun: 'STUNNED', canfinish: 'FINISH!' }
type Num = { id: number; x: number; y: number; v?: number; txt?: string; cls: string }
function Game({ nudge, day, me, d, busy, act, approveIfNeeded, player, setToast, refresh, loadFighters, active, starter, setTab }: any) {
  const [townFull, setTownFull] = useState(true)
  const town = useMemo(() => townMap(), [])
  const [mode, setMode] = useState<Mode | null>(null)
  useEffect(() => { audio.music(mode ? 'dungeon' : 'theme') }, [mode])
  const [ranked, setRanked] = useState(false)
  const [loadout, setLoadout] = useState<ItemId[]>([])
  const [run, setRun] = useState<RT | null>(null)
  const evs = useRef<Ev[]>([])
  const queue = useRef<Move[]>([])
  const [fight, setFight] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [near, setNear] = useState<Npc | null>(null)
  const [hit, setHit] = useState<'hero' | 'foe' | ''>('')
  const [nums, setNums] = useState<Num[]>([])
  const [boom, setBoom] = useState(0)
  const [fin, setFin] = useState<{ boss: boolean; k: number; key: string } | null>(null)
  const finRef = useRef<typeof fin>(null); finRef.current = fin
  const [recorded, setRecorded] = useState('')
  const [result, setResult] = useState(false)
  const [fade, setFade] = useState(false)
  const api = useRef<WorldApi | null>(null)
  const rooms: EnemyDef[] = mode ? roomsFor(mode) : []
  const map: MapDef = useMemo(() => (mode ? dungeonMap(run?.day ?? 1, roomsFor(mode).map((r) => r.key)) : town), [mode, run?.day, town])
  const q: Quest = me.q
  const gear = { level: q.level, sword: q.sword, armor: q.armor, charm: q.charm }
  const runRef = useRef<RT | null>(run); runRef.current = run
  const arms = me.arms || { mask: 0, eq: 0, ammo: 0 }

  const engaged = useRef(-1)
  const begin = (md: Mode, r: boolean, lo: ItemId[]) => {
    setFade(true); setModal(null)
    setTimeout(() => {
      const st = rtStart(md, lo, gear, arms.eq, arms.ammo); evs.current = []; queue.current = []
      setMode(md); setRanked(r); setRun(st); setRecorded(''); setResult(false); setFight(false); setNums([]); setFin(null)
      setTimeout(() => setFade(false), 60)
    }, 380)
  }
  const leave = () => { setMode(null); setRun(null); setFight(false); setResult(false); setLoadout([]); setFin(null) }
  const lastDrink = useRef(0)
  const input = useCallback((mv: Move) => {
    if (finRef.current) { setFin(null); return }
    if (!fight && (mv === 'P' || mv === 'N')) { // potions work out of fights too: no clock, logged as a negative tick for this room
      const s = runRef.current; if (!s || s.done || Date.now() - lastDrink.current < 250) return
      if ((mv === 'P' ? s.potions : s.ethers) <= 0) return
      lastDrink.current = Date.now()
      const pre = evs.current.filter((e) => e.r === s.room && e.t < 0).length
      evs.current.push({ r: s.room, t: -1000 + pre, m: mv })
      const n = rtDrink(s, mv); runRef.current = n; setRun(n)
      for (const m of n.nums) addNum({ v: m.v, txt: m.txt, cls: 'heal' }, 'hero'); audio.sfx('coin'); return
    }
    if (fight && queue.current.length < 2) queue.current.push(mv)
  }, [fight])
    const where = (w: 'hero' | 'foe') => {
    const a = api.current, s = runRef.current; if (!a || !s) return { x: 50, y: 50 }
    const p = w === 'hero' ? a.pos() : a.foe(s.room) || a.pos(); return a.screen(p.x, p.y)
  }
  const addNum = (n: Omit<Num, 'id' | 'x' | 'y'>, w: 'hero' | 'foe') => {
    const p = where(w), id = Math.random()
    setNums((x) => [...x.slice(-10), { ...n, id, x: p.x + (Math.random() * 6 - 3), y: p.y - 4 }]); setTimeout(() => setNums((x) => x.filter((z) => z.id !== id)), 1000)
  }
  // the 50 ms real-time loop (only while fighting; walking and the finisher freeze the clock, the server replays the same ticks)
  useEffect(() => {
    if (!fight || !active) return
    const id = setInterval(() => {
      const s = runRef.current; if (!s || s.done || finRef.current) return
      if (s.room !== engaged.current) return // the next foe hasn't been reached yet: no ticks until the hero engages it
      const mv = queue.current.shift()
      if (mv) evs.current.push({ r: s.room, t: s.t, m: mv })
      const boss = s.room === roomsFor(s.mode).length - 1
      const n = rtTick(s, mv); runRef.current = n; setRun(n)
      for (const m of n.nums) addNum({ v: m.v, txt: m.txt, cls: m.txt ? (m.txt === 'PARRY!' ? 'parry' : 'block') : m.v > 0 ? 'heal' : m.w === 'hero' ? 'dmg hero' : 'dmg' }, m.w)
      for (const f of n.fx) {
        if (f === 'hurt' || f === 'trade') { setHit('hero'); navigator.vibrate?.(40); audio.sfx('hit'); setTimeout(() => setHit(''), 220) }
        if (f === 'hit' || f === 'crit' || f === 'special') { setHit('foe'); navigator.vibrate?.(12); audio.sfx('hit'); setTimeout(() => setHit(''), 160) }
        if (f === 'boom') { setBoom(Date.now()); audio.sfx('hit'); navigator.vibrate?.(60) }
        if (f === 'clear') audio.sfx('clear')
        if (f === 'parry' || f === 'blocked') audio.sfx('coin')
        if (f === 'kill') { addNum({ txt: `+${rewardAmount(boss ? 10 : 3)} WIF`, cls: 'wif' }, 'foe') }
        if (f === 'finish' || f === 'bossfinish') { const k = rooms[Math.min(s.room, rooms.length - 1)]?.key || 'slime'; setFin({ boss: f === 'bossfinish', k: Date.now(), key: k }); audio.sfx('hit'); navigator.vibrate?.([30, 60, 90]); setTimeout(() => setFin((x) => (x && Date.now() - x.k >= (f === 'bossfinish' ? 1500 : 950) ? null : x)), f === 'bossfinish' ? 1600 : 1000) }
        const t = FXTEXT[f]; if (t) addNum({ txt: t, cls: f === 'canfinish' ? 'parry' : 'block' }, 'foe')
      }
      if (n.done) { clearInterval(id); setTimeout(() => { setFight(false); setResult(true) }, 1100) }
      else if (n.room > s.room) setTimeout(() => setFight(false), 700)
    }, TICK)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fight, active])
  useEffect(() => {
    if (!fight || !active) return
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || e.repeat) return
      const k = e.key.toLowerCase()
      const mv = ({ j: 'A', a: 'A', e: 'A', ' ': 'A', enter: 'A', '1': 'A', k: 'D', d: 'D', '2': 'D', l: 'S', '4': 'S', q: 'P', p: 'P', '3': 'P', f: 'F', r: 'N', '5': 'N' } as Record<string, Move>)[k]
      if (mv) { e.preventDefault(); const s = runRef.current; input(mv === 'S' && s && canFinish(s) && s.wcd > 0 ? 'F' : mv) }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [fight, active, input])
  useEffect(() => { if (!modal) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null) }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [modal])
  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (mode && !fight && !modal && !result && (k === 'q' || k === 'r')) { input(k === 'q' ? 'P' : 'N'); return }
      if (k === 'e' && mode && !fight && !modal && !result && !api.current?.near()) actionBtnRef.current()
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [active, mode, fight, modal, result, input])
  useEffect(() => { (window as any).__wif = { api, ...(import.meta.env.DEV ? { dbgEnd: (won: boolean) => { setRun((r) => r && ({ ...r, cleared: won, dead: !won, done: true, earned: won ? 12 : 0 })); setFight(false); setResult(true) }, dbgRoom: (room: number) => { setRun((r) => r && ({ ...r, room, enemyHp: 999 })) } } : {}), open: setModal, begin, input, action: () => actionBtnRef.current(), state: () => ({ mode, run: runRef.current, fight, result, modal, fin: !!finRef.current, near: api.current?.near()?.kind || null, pos: api.current?.pos(), events: evs.current.length }) } })

  async function record(bg = false, events = evs.current): Promise<boolean | undefined> {
    if (!run || !mode) return
    try {
      const claimTx = (c: any) => (c && (D as any).armory && (BigInt(c.amount) > 0n || c.ammoUsed > 0 || c.drop) ? [tx((D as any).armory, armoryAbi, 'claim', [BigInt(c.amount), c.ammoUsed, c.drop, BigInt(c.deadline), c.sig])] : [])
      const earnTxt = (c: any) => (c && c.earned ? ` +${c.earned} WIF earned.` : '')
      if (mode.kind === 'level') {
        const s = await postRun({ player, level: mode.level, salt: mode.salt, loadout: LEVEL_KIT, events })
        if (!s.cleared) {
          const message = 'The server replay did not see a boss clear.'
          if (bg) setBgSave(`L${mode.level} save failed: ${message}`)
          else setToast({ msg: message, err: true })
          return false
        }
        const r = await act('record', [s.endgame ? tx((D as any).questX, questXAbi, 'recordClear', [s.level, s.loot.iron, s.loot.hide, s.loot.glow, BigInt(s.deadline), s.sig]) : tx((D as any).quest, questAbi, 'recordClear', [s.level, s.loot.iron, s.loot.hide, s.loot.glow, BigInt(s.deadline), s.sig]), ...claimTx(s.claim)],
          `Level ${s.level} checkpoint saved: +${s.loot.iron} iron, +${s.loot.hide} hide${s.loot.glow ? `, +${s.loot.glow} glow` : ''}.${earnTxt(s.claim)}`, bg)
        if (r && !bg) setRecorded(r.explorer); return !!r
      } else if (mode.kind === 'event') {
        const s = await postRun({ player, event: true, salt: mode.salt, loadout: LEVEL_KIT, events })
        if (!s.cleared) { setToast({ msg: 'The server replay did not see the Pumpkin King fall.', err: true }); return }
        const r = await act('record', [tx(D.shop!, shopAbi, 'claimDrop', [7, BigInt(s.deadline), s.sig]), ...claimTx(s.claim)], `Pumpkin King's Crown + Pumpkin Launcher are yours.${earnTxt(s.claim)}`)
        if (r && !bg) setRecorded(r.explorer); return !!r
      } else {
        const s = await postRun({ player, day, loadout, events })
        const r = await act('record', [tx(D.game, gameAbi, 'recordRun', [BigInt(day), s.score, s.xp, BigInt(s.deadline), s.used, s.sig]), ...claimTx(s.claim)], `Run recorded: ${s.score} pts, +${s.xp} XP.${earnTxt(s.claim)}`)
        if (r) { setRecorded(r.explorer); setLoadout([]) }
        return !!r
      }
    } catch (e: any) {
      const message = friendly(e)
      if (bg) setBgSave(`L${mode?.kind === 'level' ? mode.level + ' ' : ''}save failed: ${message}`)
      else setToast({ msg: message, err: true })
      refresh()
      return false
    }
    refresh()
  }

  const saveQ = useRef<Promise<unknown>>(Promise.resolve())
  const [bgSave, setBgSave] = useState('')
  /** level cleared -> queue the checkpoint save (non-blocking) and go straight into the next level */
  const nextLevel = () => {
    if (!mode || mode.kind !== 'level') return
    const lv = mode.level, events = evs.current
    if (!recorded) {
      setBgSave(`Saving L${lv} checkpoint…`)
      saveQ.current = saveQ.current.then(() => record(true, events)).then((ok) => { setBgSave(ok ? `L${lv} checkpoint saved ✓` : `L${lv} save failed: replay it from the Gate`); setTimeout(() => setBgSave(''), 5000) })
    }
    begin({ kind: 'level', level: lv + 1, salt: Math.floor(Math.random() * 1000) }, false, LEVEL_KIT)
  }
  const retry = () => { if (!mode) return
    begin(mode.kind === 'daily' ? mode : { ...mode, salt: Math.floor(Math.random() * 1000) } as Mode, mode.kind === 'daily' ? ranked : false, mode.kind === 'daily' ? loadout : LEVEL_KIT) }
  const [shopTab, setShopTab] = useState<string>('weapons')
  const onInteract = (n: Npc) => { setShopTab(n.stall === 'potions' ? 'items' : n.stall === 'tailor' ? 'wardrobe' : 'weapons'); if (n.kind === 'talk') { setToast({ msg: n.line || 'Hello!' }); return } if (n.kind === 'arena' && nudge('Claim an @name before you fight')) return; setModal(n.kind) }
  const onTouchFoe = (idx: number) => { if (run && !run.done && idx === run.room && !fight) { engaged.current = idx; setFight(true); audio.sfx('hit') } }
  const onDoor = () => { if (!mode) setModal('gate'); else if (run?.done || !run) leave(); else setToast({ msg: 'Use “Leave” to flee. An unfinished run is not recorded.' }) }
  const foe = run && rooms.length ? rooms[Math.min(run.room, rooms.length - 1)] : null
  const paused = !!modal || fight || result || !active
  const hold = (dir: any) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); if (api.current) api.current.held = dir },
    onPointerUp: () => { if (api.current) api.current.held = null }, onPointerLeave: () => { if (api.current) api.current.held = null }, onPointerCancel: () => { if (api.current) api.current.held = null },
  })
  const foeNear = !!(mode && run && !run.done && foe)
  const adjFoe = () => { const f = map.foes.find((x) => x.idx === run?.room), p = api.current?.foe(run?.room ?? -1), h = api.current?.pos(); return !!(f && p && h && Math.abs(Math.round(p.x) - Math.round(h.x)) + Math.abs(Math.round(p.y) - Math.round(h.y)) <= 1) }
  const [swingK, setSwingK] = useState(0)
  const swing = () => { setSwingK(Date.now()); audio.sfx('hit'); addNum({ txt: 'swish', cls: 'miss' }, 'hero') }
  const actionBtn = () => {
    if (fight) input('A'); else if (near) onInteract(near)
    else if (!foeNear) swing()
    else {
      if (adjFoe()) { onTouchFoe(run!.room); return }
      const p = api.current?.foe(run!.room), h = api.current?.pos()
      const d = p && h ? Math.abs(Math.round(p.x) - Math.round(h.x)) + Math.abs(Math.round(p.y) - Math.round(h.y)) : 99
      if (p && d <= 3) { api.current?.walkTo(Math.round(p.x), Math.round(p.y), true); audio.sfx('hit'); return } // within ~2 steps: step in and swing
      swing(); setToast({ msg: 'Walk closer to an enemy' })
    }
  }
  const actionBtnRef = useRef(actionBtn); actionBtnRef.current = actionBtn
  const press = (mv: Move) => ({ onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); input(mv) }, onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); input(mv) } })
  const T = run ? tempo(run) : null
  const wind = run && run.phase === 'wind'
  const windPct = run && wind ? Math.min(100, (run.pt / run.plen) * 100) : 0
  const parryZone = run && T && wind ? Math.max(0, 100 - (T.parry / run.plen) * 100) : 100
  const W = WEAPONS[run?.weapon ?? 0] || WEAPONS[0]
  const wPct = run ? Math.max(0, run.wcd / (WCD[run.weapon] || 60)) : 0
  const noAmmo = !!run && AMMO_W.includes(run.weapon) && run.ammo <= 0
  const finishOk = !!run && fight && canFinish(run)
  const hp = where('hero'), fp = where('foe')
  const modeLabel = !mode ? '' : mode.kind === 'level' ? `Level ${mode.level} · ${LEVELS[mode.level - 1].name}` : mode.kind === 'event' ? '🎃 Halloween · The Pumpkin Patch' : `${ranked ? 'Ranked' : 'Free'} daily · day #${day}`
  return (
    <section className={'game' + (HALLOWEEN ? ' hw' : '') + (fight ? ' infight' : '') + (mode && run && !result ? ' inrun' : '') + (!mode && townFull && active ? ' inrun intown' : '')}>
      <div className="hud">
        {mode ? <>
          <span className="eyebrow">{modeLabel}</span>
          {bgSave && !result && <span className="savepill">{bgSave}</span>}
          {run && <span className="hudstats">♥ {run.hp}/{run.maxHp} · ⚔ {run.atk} · 🛡 {run.def} · ✚ {run.potions} · {W.icon}{AMMO_W.includes(run.weapon) ? ` ×${run.ammo}` : ''} · room {Math.min(run.room + 1, rooms.length)}/{rooms.length} · <span className="limet">+{run.earned * (D.rewardScaleBps ?? 10000) / 10000} WIF</span></span>}
          <button className="btn sm" onClick={leave}>Leave</button>
        </> : <>
          <span className="eyebrow">Flatrock town · the <b className="limet">Gate</b> starts a run, walk up to a <b className="limet">stall</b> and press E</span>
          <span className="hudstats">⚔ {statsFor(gear).atk} · 🛡 {statsFor(gear).def} · ♥ {statsFor(gear).hp} · {W.icon} {W.name}</span>
          <button className="btn lime sm" onClick={() => setModal('gate')}>▶ Start a run</button>
          <span className="townnav">{townFull ? <>
            <button className="btn sm" onClick={() => setTab('board')}>🏆</button><button className="btn sm" onClick={() => setTab('burn')}>🔥</button><button className="btn sm" onClick={() => setTab('how')}>?</button><button className="btn sm" onClick={() => setTownFull(false)}>☰ Menu</button>
          </> : <button className="btn sm" onClick={() => setTownFull(true)}>⛶ Full screen</button>}</span>
        </>}
      </div>
      <div className={'worldwrap' + (hit === 'hero' ? ' shake' : '') + (fin ? ' finfreeze' : '')} onClick={() => fin && setFin(null)}>
        <World map={map} defeated={run ? (run.cleared ? 99 : run.room) : 0} locked={!!run && run.room < rooms.length - 1} paused={paused}
          onInteract={onInteract} onTouchFoe={onTouchFoe} onDoor={onDoor} apiRef={api} prompt={setNear} />
        {fade && <div className="fadeout" />}
        {Date.now() - swingK < 400 && <div key={swingK} className="swing" style={{ left: hp.x + '%', top: hp.y + '%' }} />}
        {fight && run && foe && !fin && run.room === engaged.current && <>
          <div className="mini hero" style={{ left: hp.x + '%', top: hp.y + '%' }}><i style={{ width: (run.hp / run.maxHp) * 100 + '%' }} /></div>
          {!run.cleared && <div className={'mini foe' + (hit === 'foe' ? ' flash' : '')} style={{ left: fp.x + '%', top: fp.y + '%' }}><i style={{ width: Math.max(0, run.enemyHp / foeMax(foe.hp)) * 100 + '%' }} />
            {wind && <b className={'tell ' + (run.kind !== 'hit' ? 'special' : '')}>{run.kind === 'heavy' ? '!!' : '!'}</b>}
            {wind && <span className="wind"><s style={{ width: windPct + '%' }} /><u style={{ left: parryZone + '%' }} /></span>}
            {run.burnT > 0 && <em className="burning">🔥</em>}
          </div>}
          {run.proj > 0 && (() => { const tot = run.weapon === 5 ? 14 : 10, f = 1 - run.proj / tot; return <div className={'proj w' + run.weapon} style={{ left: hp.x + (fp.x - hp.x) * f + '%', top: hp.y + (fp.y - hp.y) * f - Math.sin(f * Math.PI) * (run.weapon === 7 ? 8 : 2) + '%' }}>{run.weapon === 5 ? '' : '🎃'}</div> })()}
          {Date.now() - boom < 600 && <div key={boom} className="boom" style={{ left: fp.x + '%', top: fp.y + '%' }} />}
        </>}
        {nums.map((n, i) => { const k = nums.slice(0, i).filter((o) => Math.abs(o.x - n.x) < 6 && Math.abs(o.y - n.y) < 6).length; return <div key={n.id} className={'num ' + n.cls} style={{ left: `calc(${n.x}% + ${(k % 2 ? 1 : -1) * (k ? 14 : 0)}px)`, top: `calc(${Math.max(n.y, 12)}% - ${16 + k * 18}px)` }}>{n.txt ?? (n.v! > 0 ? '+' + n.v : n.v)}</div> })}
        {fin && <div className={'finisher' + (fin.boss ? ' boss' : '')} key={fin.k}>
          <div className="fin-dark" />
          <div className="fin-dash" style={{ top: fp.y + '%' }} />
          <div className="fin-line" style={{ top: fp.y + '%' }} />
          <div className="fin-half a" style={{ left: fp.x + '%', top: fp.y + '%' }}><Pix k={fin.key} size={64} flip /></div>
          <div className="fin-half b" style={{ left: fp.x + '%', top: fp.y + '%' }}><Pix k={fin.key} size={64} flip /></div>
          <div className="fin-ko">K.O.!<span>斬</span></div>
          <div className="fin-skip">tap to skip</div>
        </div>}
      </div>
      {mode && run && !run.done && <div className="bars"><div className="bar hp"><i style={{ width: (run.hp / run.maxHp) * 100 + '%' }} /><span>HP {run.hp}/{run.maxHp}</span></div><div className="bar ep"><i style={{ width: (run.ep / run.maxEp) * 100 + '%' }} /><span>EP {run.ep}/{run.maxEp}</span></div></div>}
      {fight && run && !run.done ? (
        <div className="cluster">
          <div className="fhint">{wind ? (run.kind === 'heavy' ? 'SMASH incoming: BLOCK!' : run.kind === 'heal' ? 'Healing: hit it now!' : run.kind === 'shell' ? 'Hardening: hit it now!' : 'Incoming: BLOCK (parry at the end)') : finishOk ? 'FINISH IT!' : run.phase === 'stagger' ? 'STAGGERED: attack!' : 'Opening: attack!'}</div>
          <div className="side">
            <button className={'cb def' + (wind ? ' urgent' : '')} {...press('D')}>🛡<small>BLOCK</small><Key k="K" /></button>
            <button className="cb pot" disabled={run.potions < 1} {...press('P')}>✚<small>{run.potions}</small><Key k="Q" /></button>
            <button className="cb pot ep" disabled={run.ethers < 1} {...press('N')}>⚡<small>{run.ethers}</small><Key k="R" /></button>
            <button className={'cb wpn' + (wPct > 0 || noAmmo || run.ep < EP_COST ? ' cool' : '')} disabled={noAmmo || run.ep < EP_COST} {...press('S')} style={{ ['--cd' as any]: wPct * 360 + 'deg' }}>{W.icon}<small>{AMMO_W.includes(run.weapon) ? `×${run.ammo}` : W.name.split(' ')[0]}</small><b className="badge">{EP_COST}EP</b><Key k="L" /></button>
          </div>
          {finishOk ? <button className="cb main finish" {...press('F')}>斬<small>FINISH</small><Key k="F" /></button>
            : <button className="cb main" {...press('A')}>⚔<small>ATTACK</small><Key k="J" /></button>}
        </div>
      ) : !fight && (
        <div className="pad">
          <div className="dpad">
            <button className="up" {...hold('up')}>▲</button><button className="left" {...hold('left')}>◀</button>
            <button className="right" {...hold('right')}>▶</button><button className="down" {...hold('down')}>▼</button>
          </div>
          <div className="padmid">
            {run && <><button className="cb pot" disabled={run.potions < 1} onClick={() => input('P')}>✚<small>{run.potions}</small></button><button className="cb pot ep" disabled={run.ethers < 1} onClick={() => input('N')}>⚡<small>{run.ethers}</small></button></>}
          </div>
          <button className={'abtn' + (foeNear && !near ? ' atk' : '')} onClick={actionBtn}>{near ? 'E' : foeNear ? '⚔' : 'E'}</button>
        </div>
      )}
      <p className="fine desk keyhint">WASD / arrows walk · <Key k="E" /> interact (in the dungeon: walk to the next foe) · in a fight: <Key k="J" /> attack · <Key k="K" /> block (at the last moment = PARRY) · <Key k="L" /> weapon special · <Key k="Q" /> potion · <Key k="F" /> finisher when the foe is low or staggered · Esc closes menus</p>

      {result && run && mode && !run.cleared && mode.kind !== 'daily' && (
        <div className="modal gameover"><div className="card mbox">
          <h2 className="gotitle">GAME OVER</h2>
          <p className="fine">{mode.kind === 'level' ? `Level ${mode.level} · ${LEVELS[mode.level - 1]?.name ?? ''}` : 'Pumpkin King'} · {run.dead ? 'you fell' : 'your torch went out'} in room {Math.min(run.room + 1, rooms.length)}/{rooms.length}.</p>
          {mode.kind === 'level' && <p className="fine dim">Tip: {REC[mode.level - 1] || 'Parry the big swings.'}</p>}
          <div className="row"><button className="btn lime" onClick={retry}>↻ Retry</button><button className="btn" onClick={leave}>Back to town</button></div>
        </div></div>
      )}
      {result && run && mode && (run.cleared || mode.kind === 'daily') && (
        <Panel title={run.cleared ? (mode.kind === 'level' ? `LEVEL ${mode.level} CLEARED` : 'CLEARED') : run.dead ? 'GAME OVER' : 'TORCH OUT'} onClose={leave}>
          {mode.kind === 'daily' ? <div>{scoreOf(run).score} pts · +{scoreOf(run).xp} XP · {run.kills} kills · {run.gold} gold</div>
            : mode.kind === 'event' ? <div>The Pumpkin King is smashed! Claim his crown and his Pumpkin Launcher (free).</div>
            : <div className="loot">Boss down! Loot: {(() => { const l = lootFor(mode.level); return `${l.iron} iron, ${l.hide} hide${l.glow ? `, ${l.glow} glow` : ''}` })()}</div>}
          {run.earned > 0 && <div className="earn">+{rewardAmount(run.earned)} WIF earned this run <span className="fine dim">(paid from the funded Armory pool when you save · {fmt(d.dailyCap)} WIF daily cap per wallet)</span></div>}
          {bgSave && <p className="fine limet">{bgSave}</p>}
          <div className="row">
            {mode.kind === 'level' && run.cleared && mode.level < MAX_LEVEL && <button className="btn lime" onClick={nextLevel}>Next level ▶ <span className="fine">(saves L{mode.level})</span></button>}
            {(mode.kind !== 'level' || mode.level >= MAX_LEVEL) && (mode.kind === 'daily' || run.cleared) && (!recorded
              ? <button className="btn lime" disabled={!!busy} onClick={() => record()}>{busy === 'record' ? 'Saving…' : mode.kind === 'level' ? 'Save checkpoint + claim WIF (free)' : mode.kind === 'event' ? 'Claim the crown + WIF (free)' : 'Record + claim WIF (free)'}</button>
              : recorded && <a className="btn" href={recorded} target="_blank" rel="noreferrer">View tx ↗</a>)}
            {mode.kind === 'level' && run.cleared && mode.level < MAX_LEVEL && (!recorded ? <button className="btn" disabled={!!busy} onClick={() => record()}>{busy === 'record' ? 'Saving…' : 'Save only'}</button> : <a className="btn" href={recorded} target="_blank" rel="noreferrer">View tx ↗</a>)}
            {mode.kind === 'daily' && <button className="btn" onClick={retry}>↻ Retry</button>}
            <button className="btn" onClick={() => { if (mode.kind === 'level' && run.cleared && !recorded) { const ev = evs.current; setBgSave(`Saving L${mode.level} checkpoint…`); saveQ.current = saveQ.current.then(() => record(true, ev)).then((ok) => { setBgSave(ok ? 'Checkpoint saved ✓' : 'Checkpoint save failed'); setTimeout(() => setBgSave(''), 5000) }) } leave() }}>Back to town</button>
          </div>
          {mode.kind === 'daily' && !ranked && <p className="fine">Free run: counts for XP, your streak and WIF earnings, not the leaderboard.</p>}
        </Panel>
      )}
      {modal === 'gate' && <RunStart me={me} d={d} day={day} busy={busy} act={act} approveIfNeeded={approveIfNeeded} loadout={loadout} setLoadout={setLoadout} begin={begin} close={() => setModal(null)} />}
      {modal === 'market' && <Panel title="Shop" onClose={() => setModal(null)}><ShopPanel me={me} d={d} busy={busy} act={act} approveIfNeeded={approveIfNeeded} starter={starter} initTab={shopTab} /></Panel>}
      {modal === 'names' && <Panel title="@Names & Send" onClose={() => setModal(null)}><Send me={me} d={d} busy={busy} act={act} approveIfNeeded={approveIfNeeded} setToast={setToast} /></Panel>}
      {modal === 'board' && <Panel title="Today's pool" onClose={() => setModal(null)}><div className="pool"><Sprite name="coin" size={18} /> {fmt(d.pool)} WIF in today's prize pool · top score {d.top || '–'}</div><p className="fine">Open the Leaderboard tab for the full boards.</p></Panel>}
      {modal === 'forge' && <Panel title="Forge" onClose={() => setModal(null)}><Forge me={me} d={d} busy={busy} act={act} approveIfNeeded={approveIfNeeded} /></Panel>}
      {modal === 'arena' && <Panel title="PvP Arena" onClose={() => setModal(null)}><Arena me={me} d={d} busy={busy} act={act} approveIfNeeded={approveIfNeeded} loadFighters={loadFighters} player={player} setToast={setToast} /></Panel>}
    </section>
  )
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: any }) {
  return <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}><div className="card mbox"><div className="mhead"><span className="eyebrow">{title}</span><button className="btn sm" onClick={onClose}>✕<Key k="Esc" /></button></div>{children}</div></div>
}

function Forge({ me, d, busy, act, approveIfNeeded }: any) {
  const q: Quest = me.q
  const tierOf = (k: number) => [q.sword, q.armor, q.charm][k] + 1
  const can = (k: number) => { const c = RECIPES[k].cost(tierOf(k)); return q.iron >= c.iron && q.hide >= c.hide && q.glow >= c.glow }
  const craft = (k: number) => { const fee = (d.craftFee ?? parseEther('20')) * BigInt(tierOf(k))
    return act('craft' + k, [...approveIfNeeded('Q', fee), tx((D as any).quest, questAbi, 'craft', [k])], `Forged ${RECIPES[k].name} tier ${tierOf(k)}. ${fmt(fee)} WIF fee: part destroyed, the rest added to today's pool.`) }
  useNumKeys((n) => { if (n >= 1 && n <= 3 && !busy && can(n - 1)) craft(n - 1) })
  return (
    <div>
      <p className="fine">Materials: <b>{q.iron}</b> iron · <b>{q.hide}</b> hide · <b>{q.glow}</b> glow. Bosses drop them. Gear carries into every run and into PvP.</p>
      {RECIPES.map((r) => { const t = tierOf(r.kind), c = r.cost(t)
        return <div key={r.kind} className="item"><Sprite name={['whet', 'ward', 'potion'][r.kind]} size={26} /><div style={{ flex: 1 }}><b>{r.name} → tier {t}</b> <span className="dim">{r.stat}</span>
          <div className="fine">{[c.iron && `${c.iron} iron`, c.hide && `${c.hide} hide`, c.glow && `${c.glow} glow`].filter(Boolean).join(' + ')} + <span className="limet">{fmt((d.craftFee ?? parseEther('20')) * BigInt(t))} WIF</span></div></div>
          <button className="btn lime sm" disabled={!!busy || !can(r.kind)} onClick={() => craft(r.kind)}>{busy === 'craft' + r.kind ? '…' : 'Forge'}<Key k={String(r.kind + 1)} /></button></div> })}
    </div>
  )
}

/** mirror of WifQuest.simulate for the replay animation */
function simulate(a: number[], b: number[], seed: Hex) {
  let ha = a[2], hb = b[2]; const out: { i: number; who: 'you' | 'them'; dmg: number; crit: boolean; miss: boolean; ha: number; hb: number }[] = []
  for (let i = 0; i < 60; i++) {
    const r = Number(BigInt(keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [seed, BigInt(i)]))) % 100n)
    const aTurn = i % 2 === 0; const [atk, def] = aTurn ? [a[0], b[1]] : [b[0], a[1]]
    if (r < 10) { out.push({ i, who: aTurn ? 'you' : 'them', dmg: 0, crit: false, miss: true, ha, hb }); continue }
    let dmg = Math.max(1, atk + (r % 4) - def); const crit = r >= 92; if (crit) dmg *= 2
    if (aTurn) hb -= dmg; else ha -= dmg
    out.push({ i, who: aTurn ? 'you' : 'them', dmg, crit, miss: false, ha: Math.max(0, ha), hb: Math.max(0, hb) })
    if (ha <= 0 || hb <= 0) break
  }
  return out
}

function Arena({ me, d, busy, act, approveIfNeeded, loadFighters, player, setToast }: any) {
  const q: Quest = me.q
  const [list, setList] = useState<any[]>([])
  const [replay, setReplay] = useState<{ rounds: ReturnType<typeof simulate>; won: boolean; foe: any; me: number[]; shown: number } | null>(null)
  const load = useCallback(async () => { try { setList((await loadFighters()).filter((f: any) => f.player.toLowerCase() !== player.toLowerCase()).sort((a: any, b: any) => b.rating - a.rating)) } catch (e) { console.warn(e) } }, [loadFighters, player])
  useEffect(() => { load() }, [load])
  const st = statsFor({ level: q.level, sword: q.sword, armor: q.armor, charm: q.charm })
  const register = () => act('register', [tx((D as any).quest, questAbi, 'register')], q.registered ? 'Arena stats updated to your current gear.' : 'You are registered in the arena. Others can now challenge you (defending is free).')
  async function fightOne(f: any) {
    const stake = d.pvpStake ?? parseEther('10')
    const r = await act('pvp', [...approveIfNeeded('Q', stake), tx((D as any).quest, questAbi, 'challenge', [f.player])], `Battle vs ${f.name ? '@' + f.name : f.npc ? NPCN[Number(f.player)] : short(f.player)} settled on-chain.`)
    if (!r) return
    try {
      const rc = await pub.getTransactionReceipt({ hash: (r as any).resolve || r.hash })
      const ev = parseEventLogs({ abi: questAbi, logs: rc.logs, eventName: 'Battle' })[0] as any
      const mine = [st.atk, st.def, st.hp]
      setReplay({ rounds: simulate(mine, [f.atk, f.def, f.hp], ev.args.seed), won: ev.args.challengerWon, foe: f, me: mine, shown: 0 })
    } catch { setToast({ msg: 'Battle done, but the replay could not be loaded. Check the arena list.', err: true }) }
    load()
  }
  useEffect(() => { if (!replay || replay.shown >= replay.rounds.length) return; const t = setTimeout(() => setReplay({ ...replay, shown: replay.shown + 1 }), 280); return () => clearTimeout(t) }, [replay])
  useNumKeys((n) => { const f = list[n - 1]; if (f && q.registered && !busy && !replay) fightOne(f) })
  if (replay) {
    const cur = replay.rounds[Math.max(0, replay.shown - 1)] || { ha: replay.me[2], hb: replay.foe.hp }
    const done = replay.shown >= replay.rounds.length
    return <div>
      <div className="stage"><div className="fighter"><Pix k="hero" size={72} /><Bar v={cur.ha} max={replay.me[2]} label="You" /></div><div className="vs">VS</div>
        <div className="fighter"><Pix k={replay.foe.npc ? NPCK[Number(replay.foe.player)] : 'hero'} size={72} flip /><Bar v={cur.hb} max={replay.foe.hp} label={replay.foe.name ? '@' + replay.foe.name : replay.foe.npc ? NPCN[Number(replay.foe.player)] : short(replay.foe.player)} foe /></div></div>
      <div className="flog">{replay.rounds.slice(0, replay.shown).reverse().slice(0, 4).map((r) => <div key={r.i}>{r.who === 'you' ? 'You' : 'They'} {r.miss ? 'miss' : `hit for ${r.dmg}${r.crit ? ' (crit!)' : ''}`}</div>)}</div>
      {done && <div className="big">{replay.won ? 'VICTORY' : 'DEFEAT'}</div>}
      <div className="row"><button className="btn" onClick={() => setReplay(null)}>Back to the arena</button></div>
    </div>
  }
  return (
    <div>
      <p className="fine">Your fighter: ATK {st.atk} · DEF {st.def} · HP {st.hp}{q.registered ? ` · rating ${q.rating} · ${q.wins}W-${q.losses}L` : ''}. Challenges stake <span className="limet">{fmt(d.pvpStake ?? parseEther('10'))} WIF</span>; 10% is destroyed and the winner takes the rest. Your stake locks first, then the server signs the duel and the battle settles on-chain, so nobody can predict it in advance.</p>
      <div className="row"><button className="btn lime" disabled={!!busy || q.level < 1} onClick={register}>{busy === 'register' ? '…' : q.registered ? 'Update my stats' : 'Register'}</button>{q.level < 1 && <span className="fine">Clear level 1 first.</span>}</div>
      <ul className="lb fighters">{list.map((f, i) => <li key={f.player}><span>{i < 9 ? <Key k={String(i + 1)} /> : '#' + (i + 1)}</span><span>{f.name ? '@' + f.name : f.npc ? NPCN[Number(f.player)] : short(f.player)}</span><span className="dim">{f.atk}/{f.def}/{f.hp}</span><span>{f.rating}</span>
        <button className="btn sm" disabled={!!busy || !q.registered} onClick={() => fightOne(f)}>{busy === 'pvp' ? '…' : 'Fight'}</button></li>)}</ul>
    </div>
  )
}
const NPCN: Record<number, string> = { 1: 'Puddle Pup', 2: 'Dune Rat', 3: 'Cliff Goat', 4: 'Rust Knight', 5: 'Lantern Witch', 6: 'The Rim Colossus' }
const NPCK: Record<number, string> = { 1: 'slime', 2: 'bat', 3: 'golem', 4: 'skull', 5: 'moth', 6: 'rim' }

function Bar({ v, max, label, foe }: { v: number; max: number; label: string; foe?: boolean }) {
  return <div className="bar"><div className={'fill ' + (foe ? 'foe' : '')} style={{ width: `${Math.max(0, (v / max) * 100)}%` }} /><span>{label}</span></div>
}
const REC: string[] = ['Any weapon works. Hit King Slime while it wobbles.', 'Block twice when the Chief whistles.', 'Block or parry the bone throw. Sword tier 1+.', 'Parry the charge. Armor tier 1+.', 'Block the fire breath. Fire Staff burn adds up.', 'Interrupt the glow: Twin Daggers or Spear.', 'Armor tier 2+ and potions for the slams.', 'Full kit. Keep energy potions for after a grab.']
function RunStart({ me, d, day, busy, act, approveIfNeeded, loadout, setLoadout, begin, close }: any) {
  const q: Quest = me.q; const next = Math.min(q.level + 1, MAX_LEVEL)
  const [sel, setSel] = useState<number>(next)
  const inv: Record<number, number> = me.items || {}
  const arms = me.arms || { mask: 0, eq: 0, ammo: 0 }
  const W = WEAPONS[arms.eq] || WEAPONS[0]
  const count = (i: number) => loadout.filter((x: number) => x === i).length
  const toggle = (i: ItemId) => {
    if (i === 1) { if (count(1) < Math.min(3, inv[1] || 0)) setLoadout([...loadout, 1]); else setLoadout(loadout.filter((x: number) => x !== 1)) }
    else if (count(i) > 0) setLoadout(loadout.filter((x: number) => x !== i)); else if ((inv[i] || 0) > 0) setLoadout([...loadout, i])
  }
  const enter = () => act('enter', [...approveIfNeeded('G', d.fee ?? 0n), tx(D.game, gameAbi, 'enterRanked')], `Entered today's ranked run. ${fmt(d.fee)} WIF paid, ${(d.burnBps ?? 2000) / 100}% sent to the dead address; the rest stays in the prize pool.`)
  const lv = LEVELS[sel - 1]
  const go = () => begin({ kind: 'level', level: sel, salt: Math.floor(Math.random() * 1000) }, false, LEVEL_KIT)
  useNumKeys((n) => { if (n >= 1 && n <= MAX_LEVEL && n <= q.level + 1) setSel(n) })
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Enter') go() }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) })
  return (
    <Panel title="Choose your run" onClose={close}>
      <div className="runstart">
        <div className="lvls">{LEVELS.map((_l, i) => { const n = i + 1, open = n <= q.level + 1, done = n <= q.level
          return <button key={n} className={'lvl' + (sel === n ? ' on' : '') + (open ? '' : ' locked') + (done ? ' done' : '')} disabled={!open} onClick={() => setSel(n)}>
            <span>{open ? n : '🔒'}</span><small>{done ? '✓ cleared' : open ? 'open' : 'locked'}</small></button> })}</div>
        <div className="bossprev">
          <Pix k={lv.boss.key} size={84} flip />
          <div>
            <div className="eyebrow">Level {sel} · {lv.name}{sel > ONCHAIN_MAX_LEVEL ? ' · endgame' : ''}</div>
            <div className="family"><span className="fine">Enemies: <b>{lv.family}</b></span>{lv.minions.map(([k, nm]: [string, string], j: number) => <span key={j} className="fam" title={nm}><Pix k={k} size={30} /></span>)}</div>
            <h3>Boss: {lv.boss.name} <span className="fine limet">· special: {lv.boss.move}</span></h3>
            <div className="fine">{lv.boss.blurb}</div>
            <div className="fine">Boss HP {foeMax(lv.boss.hp)} · hits for ~{Math.round(lv.boss.atk * 1.5)} · reward <span className="limet">+10 WIF</span> + materials</div>
            <div className="rec">Recommended: {REC[sel - 1]}</div>
            <div className="fine">Your kit: ⚔ {statsFor(q).atk} · 🛡 {statsFor(q).def} · ♥ {statsFor(q).hp} · {W.icon} {W.name}{W.ammo ? ` ×${arms.ammo}` : ''} · 2 free potions</div>
          </div>
        </div>
        <button className="btn lime big" onClick={go}>▶ Start run<Key k="Enter" /></button>
        {HALLOWEEN && <button className="item hwrow" onClick={() => begin({ kind: 'event', salt: Math.floor(Math.random() * 1000) }, false, LEVEL_KIT)}>
          <Pix k="pking" size={44} /><div><b>🎃 Halloween event: The Pumpkin King</b><div className="fine">Beat him once for his Crown (costume) and the Pumpkin Launcher. Replays earn WIF.</div></div></button>}
        <details className="daily"><summary className="eyebrow">Daily dungeon · day #{day}</summary>
          {([1, 2, 3, 4] as ItemId[]).map((i) => (
            <button key={i} className={'item ' + (count(i) ? 'sel' : '')} onClick={() => toggle(i)} disabled={!(inv[i] > 0)}>
              <Sprite name={{ 1: 'potion', 2: 'whet', 3: 'ward', 4: 'potion' }[i]!} size={26} /><div><b>{ITEMS[i].name}</b> <span className="dim">×{inv[i] || 0}{count(i) ? ` · taking ${count(i)}` : ''}</span></div>
            </button>))}
          <p className="fine">15 enemies · one attempt per day · up to <b className="limet">30 WIF</b> for a full clear. The WIF reward comes from the separate, prefunded Armory pool; ranked entry fees fund the leaderboard prize pool.</p>
          <div className="row">
            {me.playedToday ? <button className="btn lime" disabled>✓ Today's challenge completed</button>
              : me.entered ? <button className="btn lime" onClick={() => begin({ kind: 'daily', day }, true, loadout)}>▶ Start Daily Challenge</button>
              : <button className="btn lime" disabled={!!busy} onClick={enter}>{busy === 'enter' ? 'Entering…' : `Enter Daily Challenge · ${fmt(d.fee ?? parseEther('100'))} WIF`}</button>}
          </div>
          <p className="fine">Same 15-enemy dungeon for everyone today. The top ranked score takes the day's entry-fee pool.</p>
        </details>
      </div>
    </Panel>
  )
}

/** one Shop: consumables, weapons (with inventory + equip), wardrobe, starter gift */
function ShopPanel({ me, d, busy, act, approveIfNeeded, starter, initTab }: any) {
  const [tab, setTab] = useState<'weapons' | 'items' | 'wardrobe'>(initTab || 'weapons')
  const arms = me.arms || { mask: 0, eq: 0, ammo: 0 }
  const owns = (i: number) => i === 0 || ((arms.mask >> i) & 1) === 1
  const A = (D as any).armory as string | undefined
  const appr = (need: bigint, to: string | undefined, cur?: bigint): Call[] => (!to || (cur ?? 0n) >= need ? [] : [tx(D.wif, wifAbi, 'approve', [to, maxUint256])])
  const buyW = (w: typeof WEAPONS[number]) => w.price <= 0 ? undefined : act('w' + w.id, [...appr(parseEther(String(w.price)), A, me.allowA), tx(A!, armoryAbi, 'buy', [w.id])], `${w.name} bought for ${w.price} WIF (50% sent to the dead address) and equipped.`)
  const equipW = (id: number) => act('e' + id, [tx(A!, armoryAbi, 'equip', [id])], `${WEAPONS[id].name} equipped.`)
  const refill = () => act('refill', [...appr(parseEther('1.5'), A, me.allowA), tx(A!, armoryAbi, 'refill')], 'Ammo refilled to 3 for 1.5 WIF.')
  const buyI = (i: ItemId, n: number) => { const cost = (d.prices[i] ?? 0n) * BigInt(n); return act('buy' + i, [...approveIfNeeded('G', cost), tx(D.game, gameAbi, 'buy', [i, BigInt(n)])], `Bought ${n} × ${ITEMS[i].name} for ${fmt(cost)} WIF.`) }
  const wr = me.wardrobe || { mask: 1, eq: 0 }
  const [cp, setCp] = useState<Record<number, bigint>>({})
  useEffect(() => { shopPrices().then(setCp).catch(() => {}) }, [])
  const buyC = (id: number) => act('c' + id, [...approveIfNeeded('S', cp[id] ?? 0n), tx(D.shop!, shopAbi, 'buy', [id])], `${COSTUMES[id].name} is yours, and it's on.`)
  const wearC = (id: number) => act('c' + id, [tx(D.shop!, shopAbi, 'equip', [id])], `Wearing ${COSTUMES[id].name}.`)
  return (
    <div className="shop2">
      <div className="row stabs">{(['weapons', 'items', 'wardrobe'] as const).map((t) => <button key={t} className={'btn sm' + (tab === t ? ' lime' : '')} onClick={() => setTab(t)}>{{ weapons: '⚔ Weapons', items: '✚ Potions & items', wardrobe: '👘 Wardrobe' }[t]}</button>)}
        <span className="fine dim">You have {fmt(me.wif)} WIF</span></div>
      {me.wardrobe && !me.wardrobe.starterUsed && <div className="item gift"><b>🎁 New here?</b><span className="fine">{D.starter ?? 5} WIF, once per wallet.</span><button className="btn lime sm" disabled={!!busy} onClick={starter}>{busy === 'starter' ? '…' : `Claim ${D.starter ?? 5} WIF`}</button></div>}
      {tab === 'weapons' && <>
        {!A && <p className="fine">Weapons are not deployed on this network yet.</p>}
        <div className="eyebrow">Inventory · tap to equip (your weapon special, key L)</div>
        <div className="inv">{WEAPONS.filter((w) => owns(w.id)).map((w) => <button key={w.id} className={'invs' + (arms.eq === w.id ? ' on' : '')} disabled={!!busy || arms.eq === w.id || !A} onClick={() => equipW(w.id)} title={w.blurb}>
          <span className="wi">{w.icon}</span><small>{w.name}{w.ammo ? ` ×${arms.ammo}` : ''}</small>{arms.eq === w.id && <em>equipped</em>}</button>)}</div>
        {(owns(5) || owns(7)) && <div className="row"><button className="btn sm" disabled={!!busy || arms.ammo >= 3} onClick={refill}>{busy === 'refill' ? '…' : `Refill ammo to 3 · 1.5 WIF`}</button><span className="fine">Ammo now: {arms.ammo}/3 (bazooka & launcher share it)</span></div>}
        <div className="grid3 wgrid">{WEAPONS.filter((w) => w.id > 0).map((w) => <div key={w.id} className={'card shop wcard' + (owns(w.id) ? ' owned' : '')}>
          <div className="wsprite">{w.icon}</div><h3>{w.name}</h3><p className="fine">{w.blurb}</p>
          <div className="fine dim">cooldown {(w.cd * 0.05).toFixed(1)}s{w.ammo ? ' · 3 ammo' : ''}</div>
          {w.price > 0 ? <div className="price"><Sprite name="coin" size={14} /> {w.price} WIF</div> : <div className="price limet">🎃 Drops from the Pumpkin King</div>}
          {owns(w.id) ? <button className="btn sm" disabled={!!busy || arms.eq === w.id} onClick={() => equipW(w.id)}>{arms.eq === w.id ? 'Equipped' : 'Equip'}</button>
            : w.price <= 0 ? <div className="fine dim">Not for sale: beat the Pumpkin King in the Halloween event.</div>
              : <button className="btn lime sm" disabled={!!busy || !A} onClick={() => buyW(w)}>{busy === 'w' + w.id ? '…' : 'Buy'}</button>}
        </div>)}</div>
        <p className="fine">Weapon buys: 50% of the price is sent to the dead address; 50% goes to the treasury. Boss damage is capped per hit, so no weapon one-shots a boss.</p>
      </>}
      {tab === 'items' && <div className="grid3">
        {([1, 2, 3, 4] as ItemId[]).map((i) => (
          <div className="card shop" key={i}>
            <Sprite name={{ 1: 'potion', 2: 'whet', 3: 'ward', 4: 'potion' }[i]!} size={48} />
            <h3>{ITEMS[i].name}</h3><p className="fine">{ITEMS[i].blurb}</p>
            <div className="price"><Sprite name="coin" size={14} /> {fmt(d.prices[i])} WIF</div>
            <div className="dim fine">You own {me.items?.[i] || 0}</div>
            <div className="row"><button className="btn lime sm" disabled={!!busy} onClick={() => buyI(i, 1)}>{busy === 'buy' + i ? '…' : 'Buy 1'}</button>
              {(i === 1 || i === 4) && <button className="btn sm" disabled={!!busy} onClick={() => buyI(i, 3)}>Buy 3</button>}</div>
          </div>))}
        <p className="fine span3">Daily-run items: {(d.burnBps ?? 2000) / 100}% is sent to the dead address; the rest goes to today's prize pool.</p>
      </div>}
      {tab === 'wardrobe' && <div className="grid3">{COSTUMES.map((c) => { const own = ((wr.mask >> c.id) & 1) === 1 || c.id === 0
        return <div key={c.id} className={'card shop' + (wr.eq === c.id ? ' owned' : '')}><Pix k={'c' + c.id} size={56} /><h3>{c.name}</h3><p className="fine">{c.blurb}</p>
          {own ? <button className="btn sm" disabled={!!busy || wr.eq === c.id} onClick={() => wearC(c.id)}>{wr.eq === c.id ? 'Wearing' : 'Wear'}</button>
            : c.id === 7 ? <div className="fine limet">Drop-only</div>
              : <button className="btn lime sm" disabled={!!busy || !D.shop} onClick={() => buyC(c.id)}>{busy === 'c' + c.id ? '…' : `Buy · ${fmt(cp[c.id])} WIF`}</button>}</div> })}</div>}
    </div>
  )
}

function BurnPanel({ tot, burns, reload }: any) {
  return (
    <section className="grid2 burnp">
      <div className="card span2">
        <div className="eyebrow">Total WIF destroyed by FeeSink contracts (read on-chain)</div>
        <div className="burnbig">🔥 {tot ? fmt(tot.total) : '…'} <small>WIF</small></div>
        <div className="parts">{tot?.parts.map((p: any) => <a key={p.addr} href={`${EXPLORER}/address/${p.addr}`} target="_blank" rel="noreferrer" className="chip">{p.label}: {fmt(p.v)}</a>)}</div>
        <p className="fine">Players do not need ETH. A standard sponsored batch costs 0.2 WIF: 0.1 goes to the dead address and 0.1 repays the relayer. The first starter grant and first @name claim are free onboarding exceptions. FeeSink totals above count contract fee destruction only; they do not include the separate gas-fee transfers.</p>
      </div>
      <div className="card span2">
        <div className="mhead"><span className="eyebrow">Live mainnet burn transactions <small className="live-label">● auto-refresh · 15s</small></span><button className="btn sm" onClick={reload}>Refresh</button></div>
        <ol className="lb burns">
          {burns === null && <li className="dim">Reading Robinhood Chain mainnet…</li>}
          {burns?.length === 0 && <li className="dim">No FeeSink destruction events found in the indexed range.</li>}
          {burns?.slice(0, 30).map((b: BurnRow) => <li key={b.hash + b.sink + String(b.amount)}>
            <span>🔥 {fmt(b.amount)} WIF</span>
            <span className="dim">{b.viaBurn ? 'Native token burn' : 'Sent to dead address'} · {b.sink}</span>
            <span>{b.player ? short(b.player) : 'Player unavailable'}</span>
            <a href={`${EXPLORER}/tx/${b.hash}`} target="_blank" rel="noreferrer">View tx ↗</a>
          </li>)}
        </ol>
        <p className="fine dim">Each row is an on-chain FeeSink Destroyed event. “Native token burn” means total WIF supply was reduced; “Sent to dead address” means tokens were transferred to 0x…dEaD. Open the transaction to verify it on Blockscout.</p>
      </div>
    </section>
  )
}

function Board({ d, board, me, day, busy, act, reload, heroes, burns, reloadBurns }: any) {
  return (
    <section className="grid2">
      <div className="card span2">
        <div className="eyebrow">Heroes · level cleared, PvP wins and WIF destroyed</div>
        <ol className="lb lb5">
          <li className="dim"><span>#</span><span>hero</span><span>level</span><span>PvP wins</span><b>destroyed</b></li>
          {heroes.length === 0 && <li className="dim">No boss clears yet.</li>}
          {heroes.map((h: any, i: number) => <li key={h.player} className={h.player.toLowerCase() === me.toLowerCase() ? 'me' : ''}><span>#{i + 1}</span><span className="who"><Pix k={'c' + (h.eq ?? 0)} size={22} />{h.name ? '@' + h.name : short(h.player)}</span><span>L{h.level}/{MAX_LEVEL}</span><span>{h.wins}{h.rating ? <small className="dim"> · {h.rating}</small> : ''}</span><b>{fmt(h.burned)}</b></li>)}
        </ol>
        <p className="fine dim">Destroyed = WIF sent to the dead address through Zeron FeeSink fees in the indexed period. Gas-fee transfers are excluded.</p>
      </div>
      <div className="card">
        <div className="eyebrow">Day #{day} · ranked leaderboard</div>
        <div className="pool"><Sprite name="coin" size={28} /> <b>{fmt(d.pool)}</b> WIF prize pool</div>
        <ol className="lb">
          {board.length === 0 && <li className="dim">No ranked runs yet today. Be first.</li>}
          {board.map((r: any, i: number) => <li key={r.player} className={r.player.toLowerCase() === me.toLowerCase() ? 'me' : ''}><span>#{i + 1}</span><span>{r.name ? '@' + r.name : short(r.player)}</span><b>{r.score}</b></li>)}
        </ol>
        <div className="row"><button className="btn" onClick={reload}>Refresh</button>
          <button className="btn" disabled={!!busy} onClick={() => act('settle', [tx(D.game, gameAbi, 'settle', [BigInt(day - 1)])], `Settled day #${day - 1}.`)}>Settle yesterday</button></div>
      </div>
      <div className="card">
        <div className="eyebrow">Rewards (what is real today)</div>
        <ul className="rewards">
          <li><b>Daily pool:</b> the top ranked score takes the whole pool ({fmt(d.pool)} WIF now) when the day is settled. Empty days roll over.</li>
          <li><b>Play to earn:</b> +{rewardAmount(3)} WIF per small enemy, +{rewardAmount(10)} WIF per boss, and +{rewardAmount(10)} WIF per level clear at the current mainnet reward scale. Paid from the prefunded Armory pool (not minted), up to {fmt(d.dailyCap)} WIF per wallet per day and only while funds remain.</li>
          <li><b>PvP:</b> the winner takes 90% of the stake; 10% is sent to the dead address.</li>
          <li><b>🎃 Pumpkin King:</b> drops his Crown costume and the Pumpkin Launcher.</li>
          <li><b>Free:</b> your first @name, and a small WIF welcome gift once per wallet while the pool lasts.</li>
        </ul>
        <p className="fine dim">No seasons, airdrops or token prizes beyond these. This is real $wif on Robinhood Chain mainnet.</p>
      </div>
      <div className="card span2">
        <div className="mhead"><span className="eyebrow">Live burn transactions <small className="live-label">● mainnet · 15s refresh</small></span><button className="btn sm" onClick={reloadBurns}>Refresh</button></div>
        <ol className="lb burns">
          {burns === null && <li className="dim">Reading Robinhood Chain mainnet…</li>}
          {burns?.length === 0 && <li className="dim">No FeeSink destruction events found in the indexed range.</li>}
          {burns?.slice(0, 8).map((b: BurnRow) => <li key={b.hash + b.sink + String(b.amount)}>
            <span>🔥 {fmt(b.amount)} WIF</span><span className="dim">{b.viaBurn ? 'Native burn' : 'Dead-address transfer'} · {b.sink}</span>
            <span>{b.player ? short(b.player) : 'Player unavailable'}</span><a href={`${EXPLORER}/tx/${b.hash}`} target="_blank" rel="noreferrer">View tx ↗</a>
          </li>)}
        </ol>
      </div>
    </section>
  )
}

function Send({ me, d, busy, act, approveIfNeeded, setToast, initialName = '', compact = false }: any) {
  const [to, setTo] = useState(initialName); const [amt, setAmt] = useState('10'); const [rename, setRename] = useState(false); const [pinSet, setPinSet] = useState(false); const [loginOpen, setLoginOpen] = useState(false)
  const n = to.trim().replace(/^@/, '').toLowerCase()
  const L = useNameLookup(n)
  const v = (() => { try { return parseEther(amt || '0') } catch { return 0n } })()
  const self = me.name && n === me.name
  const found = nameRe.test(n) && !L.loading && L.n === n && L.owner && L.owner !== ZERO
  const status = !n ? '' : !nameRe.test(n) ? 'Names are 3–15 characters: a–z, 0–9 and _.' : L.loading || L.n !== n ? 'Looking up…' : L.owner === undefined ? "Couldn't check right now." : L.owner === ZERO ? `No player called @${n} yet` : self ? "That's you." : `✓ @${n} found`
  const low = me.wif !== undefined && v > me.wif
  async function send() {
    // read-only check first: never send a tx that would revert on an unknown name
    const o = await pub.readContract({ address: D.names as Hex, abi: namesAbi, functionName: 'resolve', args: [n] }).catch(() => undefined) as string | undefined
    if (!o || o === ZERO) { setToast({ msg: `No player called @${n} yet`, err: true }); return }
    await act('send', [...approveIfNeeded('N', v), tx(D.names, namesAbi, 'sendToName', [n, v])], `Sent ${amt} WIF to @${n}.`)
  }
  return (
    <section className="grid2">
      {!compact && <div className="card">
        {me.name && !rename ? <><div className="eyebrow">Your @name</div><h2>@{me.name}</h2><p className="fine">This is your identity everywhere in Zeron.</p><button className="linkbtn" onClick={() => setRename(true)}>Change name ({fmt(d.nameFee)} WIF)</button></>
          : <NamePick me={me} d={d} busy={busy} act={act} approveIfNeeded={approveIfNeeded} onDone={() => setRename(false)} onSkip={me.name ? () => setRename(false) : undefined} />}
      </div>}
      <div className="card">
        <div className="eyebrow">Send $wif by @name</div>
        <div className="at-input"><span>@</span><input placeholder="friend" value={to} onChange={(e) => setTo(e.target.value.toLowerCase().replace(/\s/g, ''))} maxLength={16} aria-label="send to @name" /></div>
        <div className={'fine namehint ' + (found && !self ? 'good' : n && !L.loading ? 'bad' : '')}>{status || ' '}</div>
        <input placeholder="amount" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="amount" />
        {low && <div className="fine namehint bad">You only have {fmt(me.wif)} WIF.</div>}
        <button className="btn lime" disabled={!found || !!self || v <= 0n || low || !!busy} onClick={send}>{busy === 'send' ? 'Sending…' : found && !self ? `Send ${amt || 0} WIF to @${n}` : `Send ${amt || 0} WIF`}</button>
        <p className="fine">There's no fee on sends, and you need zero ETH.</p>
      </div>
      {!compact && <div className="card span2 fine">Your game wallet lives in this browser (address {short(account().address)}). <button className="link" onClick={() => { navigator.clipboard.writeText(getKey()); alert('Private key copied. Keep it safe.') }}>Export key</button>{me.name && <> · <button className="link" onClick={() => setPinSet(true)}>Change PIN</button></>} · <button className="link" onClick={() => setLoginOpen(true)}>Log in to another @name</button>
        {pinSet && <SetPin name={me.name} title="Change PIN" onDone={() => { setPinSet(false); setToast({ msg: 'PIN saved.' }) }} onSkip={() => setPinSet(false)} />}
        {loginOpen && <PinLogin onBack={() => setLoginOpen(false)} backLabel="Cancel" />}</div>}
    </section>
  )
}

function How({ d }: any) {
  return (
    <section className="card how">
      <h2>How it works</h2>
      <ol>
        <li><b>Zero ETH needed.</b> Your game wallet is created in your browser. When you make an on-chain move, it signs the exact request and our sponsor submits it and pays ETH gas using EIP-7702. A standard sponsored batch costs 0.2 WIF: 0.1 goes to the dead address and 0.1 goes to the relayer. The starter grant and first @name claim are free onboarding exceptions. $wif powers the game.</li>
        <li><b>Free play every day.</b> One hand-seeded dungeon per day, the same for everyone. Free runs earn XP and keep your streak.</li>
        <li><b>$wif does the work:</b> the ranked entry ({fmt(d.fee)} WIF), the shop (potions, whetstones, wards), @names, and sending to friends by name.</li>
        <li><b>Fees.</b> The deployed FeeSink contracts transfer configured fee shares to the dead address. They do not call the token's native supply-reduction function. Current shares: Game and Quest 20%; Names, Shop and Armory 50%; PvP stake 10%. The remainder goes to the relevant prize pool, contract balance or treasury, depending on the action.</li>
        <li><b>Ranked prize loop.</b> 80% of ranked-entry and daily-item fees enter that day's Game prize pool. After the day ends, anyone can settle it and the top ranked player receives the pool. If nobody qualifies, it rolls into the current day. This is separate from the Armory's prefunded kill/level reward balance.</li>
        <li><b>Levels.</b> Walk out of town through the Dungeon Gate. Five levels, each a few rooms and an original boss with a special move. Clear a boss and the server signs a checkpoint that you record on-chain (free), which unlocks the next level and gives you crafting materials.</li>
        <li><b>Forge.</b> Turn iron, hide and glow into a Sword (+ATK), Armor (+DEF) or Charm (+HP), up to tier 3. Each craft costs {fmt(d.craftFee)} WIF per tier: 20% is sent to the dead address; the rest is retained or routed by the Quest contract. Gear counts in every run and in PvP.</li>
        <li><b>Arena.</b> Register your fighter after clearing level 1, then challenge players or the six NPCs. Each challenge stakes {fmt(d.pvpStake)} WIF. Win and you get 90% back; lose and the defender (or the prize pool, for NPCs) gets 90%. 10% of the stake is sent to the dead address. Defending is free. Your stake locks first; then our server signs the duel and its signature becomes the seed, so the outcome can't be predicted or rerolled. If a duel is ever stuck for an hour, you can take your stake back.</li>
        <li><b>Score verification.</b> Runs are deterministic. The server replays your exact moves before signing a score, and the contract accepts each signature only once. This is a practical anti-cheat step because the browser cannot simply submit an arbitrary score, but it still trusts the replay service and signer. Planned upgrades: publish replay inputs, enable independent replay checks, add a dispute window, and make reward claims independently verifiable.</li>
      </ol>
      <p className="fine">Keys: WASD / arrows to move · E to interact · J to attack · K to block/parry · L for weapon special · Q for potion · F to finish a weakened or staggered foe · Space/Enter to continue · Esc to close. On a phone, use the D-pad and action buttons.</p>
      <p className="fine">Contracts: quest {D.quest || 'pending'} · game {D.game || 'pending'} · names {D.names || 'pending'} · token {D.wif || 'pending'}{D.network.includes('Testnet') ? ' (testnet)' : ''}</p>
    </section>
  )
}
