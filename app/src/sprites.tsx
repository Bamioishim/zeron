import type React from "react"
// Original pixel sprites (drawn here as character grids).
export const PAL: Record<string, string> = {
  k: '#0d0d0d', w: '#f4efe4', l: '#d4fc50', L: '#9bbf2a', b: '#b98a5a', B: '#7a5532', p: '#e7a0a0', g: '#6fcf6f', G: '#3c8d3c',
  v: '#9a7bd8', V: '#5f469a', s: '#d9d4c6', S: '#8f8a7e', m: '#6e8b4e', M: '#46602d', r: '#ff5a4f', y: '#ffd24a', o: '#ff9b3d', c: '#5ad1ff', q: '#3a9aa8', Q: '#245e6a', h: '#c8c3b8', H: '#6d6a63', e: '#2a1f18',
}
export const ART: Record<string, string[]> = {
  hero: [
    '....llllll....', '...llLlLlll...', '..llllllllll..', '..LLLLLLLLLL..', '..bbbbbbbbbb..', '.bbwkbbbbwkbb.', '.bbbbbbbbbbbb.',
    '.bbbbbkkbbbbb.', '..bbbbppbbbb..', '...bbbbbbbb...', '..BbbbbbbbbB..', '..Bbb.bb.bbB..', '..bb..bb..bb..', '..kk..kk..kk..',
  ],
  // original hero: a small helmeted adventurer with a sword (not from any asset pack)
  knight: [
    '...HHHHH.....', '..HhhhhhH....', '..HhHHHhH....', '..HkekkeH....', '...bbbbb...h.', '..QqqqqqQ..h.', '.bQqqyqqQb.h.',
    '.bQqqqqqQbHHH', '..QqqqqqQ..e.', '...eeeee.....', '...Q...Q.....', '...Q...Q.....', '..ee...ee....',
  ],
  knight2: [
    '...HHHHH.....', '..HhhhhhH....', '..HhHHHhH....', '..HkekkeH....', '...bbbbb...h.', '..QqqqqqQ..h.', '.bQqqyqqQb.h.',
    '.bQqqqqqQbHHH', '..QqqqqqQ..e.', '...eeeee.....', '..Q....Q.....', '.Q.....Q.....', '.ee.....ee...',
  ],
  slime: [
    '..............', '..............', '.....gggg.....', '...gggggggg...', '..gggggggggg..', '.ggwkggggwkgg.', '.gggggggggggg.',
    '.ggggggkkgggg.', 'GGGGGGGGGGGGGG', '.GGGGGGGGGGGG.', '..............',
  ],
  bat: [
    '..............', 'V....vvvv....V', 'VV..vvvvvv..VV', 'VVVvvrvvrvvVVV', 'VVVVvvvvvvVVVV', '.VVVvwvvwvVVV.', '..VV.vvvv.VV..',
    '.....v..v.....', '..............',
  ],
  skull: [
    '....ssssss....', '...ssssssss...', '..ssssssssss..', '..skkssssskks..', '..skrssssskrs..', '..ssssskssss..', '...ssssssss...',
    '....sSsSsS....', '.....ssss.....', '...SsSsSsSs...', '....s.ss.s....', '...ss.ss.ss...',
  ],
  golem: [
    '...mmmmmmmm...', '..mMmmmmmmMm..', '.mmmyymmyymmm.', '.mmmmmmmmmmmm.', 'mmMmmmkkmmmMmm', 'mmmmmmmmmmmmmm', 'Mm.mmmmmmmm.mM',
    'Mm.mMmmmmMm.mM', '...mmm..mmm...', '...MMM..MMM...',
  ],
  boss: [
    'l..l..ll..l..l', 'llllllllllllll', '.kkkkkkkkkkkk.', 'kkkkkkkkkkkkkk', 'kkrrkkkkkkrrkk', 'kkkkkkkkkkkkkk', 'kkkklllllkkkkk',
    '.kkkkkkkkkkkk.', 'kkk.kkkkkk.kkk', 'kk..kkkkkk..kk', '...kkk..kkk...', '..kkk....kkk..',
  ],
  potion: ['....ww....', '....BB....', '...wrrw...', '..wrrrrw..', '..rrrrrr..', '..rrrrrr..', '...rrrr...'],
  whet: ['..........', '.....S.ss.', '....SsssS.', '...SsssS..', '..SsssS...', '.SsssS....', '.SSS......'],
  ward: ['...yyyy...', '..yccccy..', '.yccllccy.', '.yclllcy..', '..ycccy...', '...yyy....', '....y.....'],
  glorp: [
    '..............', '....BBBBBB....', '..BBbbbbbbBB..', '.BbbwkbbwkbbB.', 'BbbbbbbbbbbbbB', 'BbbbkkkkkkbbbB', 'BbbbkrrrrkbbbB',
    'BbbbbkkkkbbbbB', '.BbbbbbbbbbbB.', 'BBBBBBBBBBBBBB', '.BB.BB..BB.BB.',
  ],
  moth: [
    'cc..........cc', 'vcc...kk...ccv', 'vvcc.kyyk.ccvv', 'vvvccyyyyccvvv', 'vvvvcywwycvvvv', '.vvvvyyyyvvvv.', '..vvvykkyvvv..',
    '...vv.yy.vv...', '......yy......', '.....y..y.....',
  ],
  tortoise: [
    '..............', '....SSSSSS....', '..SSsSSSSsSS..', '.SsSSsSSsSSsS.', 'SSSSSSSSSSSSSS.', 'ggSSsSSSSsSSkg', 'gg.SSSSSSSSgwg',
    '.ggg......gggg', '.gg.gg..gg.gg.', '..............',
  ],
  jester: [
    'r....oooo....y', 'rr..oooooo..yy', '.rroooooooooy.', '...owwwwwwo...', '...wkwwwwkw...', '...wwwrrwww...', '....wwwwww....',
    '..rryyrryyrr..', '.rryyrryyrryy.', '..yy.rr.yy.rr.', '..kk......kk..',
  ],
  rim: [
    'l.l.l.ll.l.l.l', 'cccccccccccccc', 'cwwwwwwwwwwwwc', 'ckkkkkkkkkkkkc', 'ckllkkkkkkllkc', 'ckkkkkkkkkkkkc', 'ckkkkrrrrkkkkc',
    'cckkkkkkkkkkcc', '.cckkkkkkkkcc.', 'ccc.cccccc.ccc', 'cc..cc..cc..cc', '..............',
  ],
  merchant: [
    '....yyyyyy....', '..yyyyyyyyyy..', '....bbbbbb....', '...bwkbbwkb...', '...bbbbbbbb...', '....bbppbb....', '..oooooooooo..',
    '.ooolooooo.oo.', '.oo.oooooo.oo.', '...oooooooo...', '...BB....BB...',
  ],
  smith: [
    '..............', '....kkkkkk....', '...kbbbbbbk...', '...bwkbbwkb...', '...bbbbbbbb...', '....bkkkkb....', '..SSSSSSSSSS..',
    '.SSbSSSSSSbSS.', '.bb.SSSSSS.bb.', '...SSSSSSSS...', '...kk....kk...',
  ],
  guard: [
    '.....rrr......', '....ssssss....', '...ssssssss...', '...skwsskws...', '...ssssssss...', '....ssssss....', '..rrrrrrrrrr..',
    '.Srrrrrrrrrr.S', '.S.rrrrrrrr..S', '...rr....rr..S', '...kk....kk...',
  ],
  coinstone: ['...SSSSSS...', '..SsssssssS.', '..SsllllsS..', '..SslkklsS..', '..SslLLlsS..', '..SsllllsS..', '..SssssssS..', '.SSSSSSSSSS.', 'SSSSSSSSSSSS'],
  namestone: ['....SSSS....', '...SssssS...', '..SsskksS...', '..SsksssS...', '..SsskssS...', '..SssskSS...', '..SsskksS...', '.SSSSSSSSS..', 'SSSSSSSSSSS.'],
  coin: ['..llll..', '.lLLLLl.', 'lLlkklLl', 'lLkllkLl', 'lLkllkLl', 'lLlkklLl', '.lLLLLl.', '..llll..'],
}
export function Sprite({ name, size = 96, flip = false, className = '' }: { name: string; size?: number; flip?: boolean; className?: string }) {
  const rows = ART[name] || ART.slime
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length
  const rects: React.ReactElement[] = []
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) rects.push(<rect key={x + '-' + y} x={x} y={y} width={1.02} height={1.02} fill={PAL[ch]} />) }))
  return (
    <svg className={'sprite ' + className} viewBox={`0 0 ${w} ${h}`} width={size} height={(size * h) / w} shapeRendering="crispEdges"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}>{rects}</svg>
  )
}
