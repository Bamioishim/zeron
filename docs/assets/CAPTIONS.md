# Demo media (PC)

## Primary screenshots
| Priority | File | Caption |
|---|---|---|
| 1 | `zeron-desktop-landing.png` | Desktop opening / landing (production chrome). |
| 2 | `zeron-desktop-token-tracker.png` | Burn / token tracker. FeeSink **`totalDestroyed`** via transfer-to-**`0x…dEaD`**. **Not** native `token.burn()` / totalSupply proof. Mainnet sinks: **`useBurn=false`**. |
| 3 | `zeron-desktop-practice-gameplay.png` | **LOCAL PRACTICE** KO still (cropped). Isolated scratch, blank contracts (`deployed===false`). **No funds moved.** Banner: practice mode. Any on-screen WIF earn figures are **simulated UI only**. |

Optional: `zeron-desktop-how-it-works.png` (How it works). `zeron-desktop-practice-room2.png` secondary practice still.

## Video
| File | Notes |
|---|---|
| `zeron-desktop-demo.mp4` | ~63s desktop showcase from **real** public + practice screen recordings. |
| `zeron-desktop-demo-thumb.jpg` | Frame from practice combat (with practice overlay). |

### Edit timeline (reviewed cuts)
1. Public landing **0–5s**
2. Practice movement **34–42s @1.5×** + combat **42–70s** + potion **73–77s** — persistent overlay **LOCAL PRACTICE — NO FUNDS MOVED** / simulated UI rewards only
3. Public How **19–27s** (skips brief name popup ~18)
4. Public Burn **35–43s** — overlay: destroyed fees → dEaD (`useBurn=false`), not native burn
5. Ending ~5s on actual landing frame: CA + zeron-game.vercel.app

Do **not** claim room totals or exact HUD WIF from OCR. Footage is **not** on-chain transfer proof. Capture method: production site for menus/Burn; gameplay only via local practice flag (blank `VITE_DEPLOYMENTS`), never mainnet spend for this demo.

### Controls (desktop, verified in fight handler + browser capture)
Primary fight HUD: **J** attack · **K** block/parry · **L** weapon special (present in UI; **not tested** in capture) · **Q** potion · **F** finisher · **E** interact · WASD/arrows walk.  
Legacy How-it-works copy still mentions A/D/P in places — treat as stale vs current J/K/Q/F hints.
