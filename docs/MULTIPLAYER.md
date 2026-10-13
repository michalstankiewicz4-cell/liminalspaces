# Multiplayer — design and status

Status: **first version (v0.1.0)** — peer-to-peer co-op walking for up to 4 players, plus same-browser rooms. Static hosting on GitHub Pages, no backend.

## Why it is cheap here
The world is generated deterministically from a seed (`js/world/gen.js`), so players only need to share **the seed and their poses**. There are no enemies, items or physics to synchronise. Oddity finds are local to each player.

## Transports (`js/net/transport.js`)
| Transport | Use | How |
|---|---|---|
| WebRTC DataChannel | Real multiplayer between computers | Manual signalling: the host's **invite code** (`LS1.` + base64 SDP offer with gathered ICE candidates) and the guest's **reply code** (SDP answer), exchanged through any messenger. No signalling server. |
| BroadcastChannel | Several tabs of one browser (testing, demos) | Channel `liminal-room:<room name>`; seed = `seedFrom('room:' + name)`. Every tab broadcasts; no host. |

**STUN** (`stun:stun.l.google.com:19302`) is opt-in (Multiplayer screen, saved as `net.stun`). Without it only host candidates are used, which usually works inside one network (or on one machine). With it, many home networks connect; symmetric NATs would need a TURN server (not provided).

## Session (`js/net/session.js`)
Star topology: guests connect to the host; the host relays poses.
Messages (JSON, `PROTOCOL = 1`):
| Message | Direction | Content |
|---|---|---|
| `hello` | guest → host | `v`, `name` |
| `welcome` | host → guest | `v`, `id` (assigned), `seed`, `spawn {x,z,yaw}` (the host's position), `players [{id,name}]` |
| `join` / `leave` | host → guests | `id`, `name` |
| `pose` | both (host relays with `id`) | `x`, `y` (eye), `z`, `yaw` — about 12 times per second |
| `bye` | host → guest | `why`: `full` or `version` |
Local rooms use `pose` (with `from` and `name`) and `leave`.
Validation: size limit, object with a string `t`, finite numbers within ±10⁷ (y clamped), ids `^[a-z0-9]{1,12}$`, names filtered (`cleanName`). Peers silent for 6 s are dropped (closing a tab does not always close the channel quickly); a guest closes the link after 9 s without hearing from the host.

## Flow
1. Host: Multiplayer → name → **Host a walk** → a walk starts with a random seed and the Invite screen opens → **Create invite code** → send it → paste the reply → **Connect**. More players: pause → **Invite player** (one invite per player).
2. Guest: Multiplayer → name → **Join with a code** → paste the invite → **Create reply code** → send it back → the walk starts next to the host when the host connects.

## Limits and known issues
- Codes are long (~800–1500 characters). Possible improvements: SDP compression, QR codes.
- If the host leaves, the walk ends for everyone's multiplayer (guests keep walking alone).
- No NAT traversal beyond STUN (no TURN).
- Players can walk through each other (avatars have no collision).

## Ideas (see TODO)
- Optional signalling relay for one-click joining (opt-in, CSP change, README note).
- Shared oddity finds, pings, emotes; proximity voice chat (needs microphone consent).
