# dsh-side-notify

Companion to [dsh-sidechat](https://github.com/realpkuasule/dsh-sidechat): push a message straight from the side-chat context to the **main agent**, which handles it as the main conversation's next user message — no copy-paste, no manual send.

> 中文文档：[README.zh.md](./README.zh.md)

## Features

- **Floating pill** — while the current conversation has an active side chat, a "Notify main agent" pill appears at the bottom right, just left of the side-chat panel.
- **Type → push** — enter a message and send (or Cmd/Ctrl+Enter); it is delivered to the main session via `agent.followup` as an ordinary user message. The main agent processes it immediately when idle, or right after its current turn when busy.
- **Slash commands** — `/notify <text>` and `/to-main <text>` are registered globally for any UI that executes host commands against a side-chat agent.
- **Status hints** — the pill's dot turns orange while the main agent is busy; after a push, a notice states whether the message waits for the current turn to finish.
- **zh/en follows** the DSH language setting.

## Push vs. dsh-sidechat's built-in bring-back

| | dsh-sidechat bring-back | dsh-side-notify push |
|---|---|---|
| Where it lands | Main composer **draft** (you send manually) or a **collapsed context row** (seen next turn) | Directly as a **user message** of the main session |
| Starts a main-agent turn | No (manual send / next turn) | **Yes** (queues its own turn) |
| Best for | Pasting material or conclusions back | Commanding the main agent to handle something now |

## Install

```bash
# Both plugins in the web profile (from GitHub):
dsh plugin --profile web add github:realpkuasule/dsh-sidechat
dsh plugin --profile web add github:realpkuasule/dsh-side-notify

# Or from a local checkout (linked, edits apply immediately):
dsh plugin --profile web add ./dsh-side-notify
```

Restart `dsh web` and hard-refresh (Cmd/Ctrl+Shift+R). `dsh-side-notify` ships prebuilt JavaScript, so GitHub installs need no build approval.

## Usage

1. Start or open a side chat (see [dsh-sidechat](https://github.com/realpkuasule/dsh-sidechat)).
2. Click the **Notify main agent** pill next to the panel, type the message, and send.
3. The main conversation shows the message as a normal user message; the main agent acts on it on its next turn.

## How it works

- **Host** (`lib/index.js`) — `/side-notify/api/{state,push}` JSON routes with the same loopback / trusted-authority fence as dsh-sidechat, plus the global `/notify` and `/to-main` commands. Both resolve the side chat's `header.parentSession`, look up the live main agent, and deliver the message with `agent.followup`.
- **Client** (`lib/client.js`) — a plain-JS `window.__ModuleLoader__` bundle mounted as a portal on `document.body`; it polls the state route every 1.5 s and positions itself with the `--dsh-subchat-width` CSS variable so it sits just left of the side-chat panel.
- No build step: `lib/` is the source of truth.

## License

MIT. The trust fence is a plain-JS port of the copy shipped by heartmove/dsh-side-chat (MIT).
