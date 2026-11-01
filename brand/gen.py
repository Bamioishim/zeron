# Original ZERON pixel wordmark + emblem (hand-made grids). Output SVG (+PNG via cairosvg).
import cairosvg, json
F={'Z':["11111","00001","00010","00100","01000","10000","11111"],
   'E':["11111","10000","10000","11110","10000","10000","11111"],
   'R':["11110","10001","10001","11110","10100","10010","10001"],
   'O':["01110","10001","10001","10001","10001","10001","01110"],
   'N':["10001","11001","11001","10101","10011","10011","10001"]}
L,MID,DK,OUT,SH='#efffb0','#d4fc50','#86a81e','#0a0c08','#000000'
def word():
    px=set();x=0
    for ch in "ZERON":
        g=F[ch]
        for y,row in enumerate(g):
            for i,c in enumerate(row):
                if c=='1':
                    for dy in (0,1):
                        for dx in (0,1): px.add((x+i*2+dx,y*2+dy))
        x+=12
    return px,x-1,14
def svg(px,w,h,pad=2,unit=1,extra=''):
    W,H=w+pad*2+1,h+pad*2+2
    r=[]
    sh={(x+1,y+1) for x,y in px}; out=set()
    for x,y in px|sh:
        for dx in(-1,0,1):
            for dy in(-1,0,1): out.add((x+dx,y+dy))
    for x,y in out: r.append(f'<rect x="{x+pad}" y="{y+pad}" width="1" height="1" fill="{OUT}"/>')
    for x,y in sh-px: r.append(f'<rect x="{x+pad}" y="{y+pad}" width="1" height="1" fill="#3a4a10"/>')
    for x,y in px:
        c=L if (x,y-1) not in px else DK if (x,y+1) not in px else MID
        r.append(f'<rect x="{x+pad}" y="{y+pad}" width="1" height="1" fill="{c}"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W+1} {H+1}" shape-rendering="crispEdges">{"".join(r)}</svg>',W+1,H+1
# emblem: helm with a sword through it, 16x16. s=steel, d=dark steel, l=lime, b=brown hilt, k=visor
EM=["       ll       ",
    "       ll       ",
    "    ssslsss     ",
    "   sssslssss    ",
    "  ssssslsssss   ",
    "  ssddslsddss   ",
    "  sskkklkkkss   ",
    "  ssddslsddss   ",
    "  sssssls sss   ",
    "   ssssls sss   ",
    "   s  sls  s    ",
    "     bbbbb      ",
    "       b        ",
    "       b        ",
    "      lll       ",
    "                "]
C={'s':'#b8bcc4','d':'#6a6f7a','k':'#0a0c08','l':'#d4fc50','b':'#8a5a2b'}
def emblem(bg=True):
    r=[]
    if bg: r.append('<rect x="0" y="0" width="16" height="16" rx="2" fill="#0d0f0b"/>')
    for y,row in enumerate(EM):
        for x,c in enumerate(row):
            if c in C: r.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{C[c]}"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">{"".join(r)}</svg>'
px,w,h=word(); ws,W,H=svg(px,w,h)
open('zeron-wordmark.svg','w').write(ws); open('zeron-icon.svg','w').write(emblem()); open('zeron-icon-clear.svg','w').write(emblem(False))
cairosvg.svg2png(bytestring=ws.encode(),write_to='zeron-wordmark.png',output_width=W*12,output_height=H*12)
cairosvg.svg2png(bytestring=emblem().encode(),write_to='zeron-icon.png',output_width=256,output_height=256)
cairosvg.svg2png(bytestring=emblem().encode(),write_to='icon-180.png',output_width=180,output_height=180)
json.dump({'W':W,'H':H},open('dims.json','w'))
