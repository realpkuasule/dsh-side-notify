/**
 * dsh-side-notify — client half.
 * A floating pill that appears while a dsh-side-chat panel exists for the
 * current conversation: click it, type a message, and the message is pushed
 * straight to the main agent (as the main conversation's next user message).
 *
 * Plain-JS bundle in the platform's `window.__ModuleLoader__` format
 * (mirrors dsh-side-chat's built lib/client.js).
 */
window.__ModuleLoader__.load({
  id: 'dsh-side-notify',
  factory: (require) => {
    const React = require('react')
    const { createRoot } = require('react-dom/client')

    const name = 'dsh-side-notify'
    const inject = ['sessions']

    const POLL_MS = 1500

    const CSS = [
      '[data-dsh-side-notify] .dsn-wrap{position:fixed;right:calc(var(--dsh-subchat-width,0px) + 16px);bottom:16px;z-index:2147483010;display:flex;flex-direction:column;align-items:flex-end;gap:10px;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;transition:right var(--ds-transition-duration-slow,260ms) var(--ds-ease-in-out,ease)}',
      '[data-dsh-side-notify] .dsn-pill{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(128,128,128,.38);border-radius:999px;padding:8px 14px;font-size:13px;line-height:1;cursor:pointer;background:rgba(38,38,42,.92);color:#f5f5f7;box-shadow:0 4px 16px rgba(0,0,0,.28);backdrop-filter:blur(10px)}',
      '[data-dsh-side-notify] .dsn-pill:hover{border-color:rgba(128,128,128,.62)}',
      '@media (prefers-color-scheme: light){[data-dsh-side-notify] .dsn-pill{background:rgba(255,255,255,.94);color:#26262a}}',
      '[data-dsh-side-notify] .dsn-dot{width:8px;height:8px;border-radius:50%;background:#34c759;opacity:0;transition:opacity .15s}',
      '[data-dsh-side-notify] .dsn-dot[data-busy]{opacity:1;background:#ff9f0a}',
      '[data-dsh-side-notify] .dsn-card{width:320px;max-width:calc(100vw - 32px);border:1px solid rgba(128,128,128,.38);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;background:rgba(38,38,42,.95);color:#f5f5f7;box-shadow:0 8px 32px rgba(0,0,0,.35);backdrop-filter:blur(12px)}',
      '@media (prefers-color-scheme: light){[data-dsh-side-notify] .dsn-card{background:rgba(255,255,255,.97);color:#26262a}}',
      '[data-dsh-side-notify] .dsn-card-title{font-size:13px;font-weight:600;opacity:.92}',
      '[data-dsh-side-notify] .dsn-input{width:100%;box-sizing:border-box;resize:vertical;min-height:76px;border:1px solid rgba(128,128,128,.42);border-radius:10px;padding:8px 10px;font-size:13px;line-height:1.5;background:rgba(0,0,0,.12);color:inherit;outline:none;font-family:inherit}',
      '[data-dsh-side-notify] .dsn-input:focus{border-color:#4c8dff}',
      '[data-dsh-side-notify] .dsn-hint{font-size:11.5px;opacity:.62;line-height:1.5}',
      '[data-dsh-side-notify] .dsn-actions{display:flex;justify-content:flex-end;gap:8px}',
      '[data-dsh-side-notify] .dsn-btn{border:1px solid rgba(128,128,128,.42);background:transparent;color:inherit;border-radius:8px;padding:6px 12px;font-size:12.5px;cursor:pointer;font-family:inherit}',
      '[data-dsh-side-notify] .dsn-btn:hover{background:rgba(128,128,128,.16)}',
      '[data-dsh-side-notify] .dsn-btn-primary{background:#4c8dff;border-color:#4c8dff;color:#fff}',
      '[data-dsh-side-notify] .dsn-btn-primary:disabled{opacity:.5;cursor:default}',
      '[data-dsh-side-notify] .dsn-notice{font-size:12.5px;color:#34c759;line-height:1.5}',
      '[data-dsh-side-notify] .dsn-error{font-size:12.5px;color:#ff6b6b;line-height:1.5}',
      '@media (prefers-reduced-motion: reduce){[data-dsh-side-notify] .dsn-wrap{transition:none}}',
    ].join('\n')

    function apply(ctx) {
      const sessions = ctx.sessions
      const locale = ctx.get('locale')

      const isEn = () => {
        try {
          if (locale === undefined) return false
          const snap = locale.getSnapshot()
          return snap !== undefined && snap.active === 'en'
        } catch {
          return false
        }
      }
      const T = (zh, en) => (isEn() ? en : zh)

      // Immutable snapshot: every patch replaces the object reference, so
      // useSyncExternalStore's Object.is comparison sees the change and
      // re-renders (mutating in place would make the pill show/hide at the
      // mercy of unrelated re-renders).
      let state = { sessionId: undefined, available: false, mainBusy: false, childCount: 0 }
      const listeners = new Set()
      const getSnapshot = () => state
      const subscribe = (fn) => { listeners.add(fn); return () => { listeners.delete(fn) } }
      const patch = (p) => { state = { ...state, ...p }; for (const fn of Array.from(listeners)) fn() }

      const post = async (method, payload) => {
        const res = await fetch(`/side-notify/api/${method}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        return await res.json()
      }

      const refresh = async () => {
        const sessionId = sessions.list.getSnapshot().current
        if (sessionId === undefined) {
          const snap = getSnapshot()
          if (snap.available || snap.sessionId !== undefined) patch({ sessionId, available: false, mainBusy: false, childCount: 0 })
          return
        }
        try {
          const data = await post('state', { sessionId })
          if (data !== null && data.ok === true) {
            const value = data.value ?? {}
            patch({
              sessionId,
              available: value.available === true,
              mainBusy: value.mainBusy === true,
              childCount: typeof value.childCount === 'number' ? value.childCount : 0,
            })
          } else {
            patch({ sessionId, available: false, mainBusy: false, childCount: 0 })
          }
        } catch {
          // transient network failures keep the last known state
        }
      }

      const interval = window.setInterval(refresh, POLL_MS)
      const offList = sessions.list.subscribe(refresh)
      void refresh()

      const Widget = () => {
        const snap = React.useSyncExternalStore(subscribe, getSnapshot)
        const [open, setOpen] = React.useState(false)
        const [draft, setDraft] = React.useState('')
        const [sending, setSending] = React.useState(false)
        const [notice, setNotice] = React.useState('')
        const [error, setError] = React.useState('')
        const boxRef = React.useRef(null)

        React.useEffect(() => {
          if (!snap.available) { setOpen(false); setNotice(''); setError('') }
        }, [snap.available])

        React.useEffect(() => {
          if (open && boxRef.current !== null) boxRef.current.focus()
        }, [open])

        if (!snap.available) return null

        const send = async () => {
          const text = draft.trim()
          if (text === '' || sending) return
          setSending(true)
          setNotice('')
          setError('')
          try {
            const data = await post('push', { sessionId: snap.sessionId, text })
            if (data !== null && data.ok === true) {
              const busy = data.value !== null && data.value !== undefined && data.value.mainBusy === true
              setDraft('')
              setNotice(busy
                ? T('已推送给主 agent，其当前轮次结束后处理。', 'Pushed; the main agent will handle it after its current turn.')
                : T('已推送给主 agent。', 'Pushed to the main agent.'))
              window.setTimeout(() => { setOpen(false); setNotice('') }, 2000)
            } else {
              setError(data !== null && data !== undefined && data.error !== undefined ? String(data.error.message ?? '') : T('推送失败，请重试。', 'Push failed, please retry.'))
            }
          } catch {
            setError(T('推送失败：网络错误。', 'Push failed: network error.'))
          } finally {
            setSending(false)
          }
        }

        return React.createElement(
          'div',
          { className: 'dsn-wrap' },
          open
            ? React.createElement(
                'div',
                { className: 'dsn-card' },
                React.createElement('div', { className: 'dsn-card-title' }, T('推送给主 agent', 'Push to main agent')),
                React.createElement('textarea', {
                  ref: boxRef,
                  className: 'dsn-input',
                  rows: 4,
                  value: draft,
                  placeholder: T('输入要主 agent 处理的内容…', 'Message for the main agent…'),
                  onChange: (e) => setDraft(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send() }
                    if (e.key === 'Escape') setOpen(false)
                  },
                }),
                notice !== '' ? React.createElement('div', { className: 'dsn-notice' }, notice) : null,
                error !== '' ? React.createElement('div', { className: 'dsn-error' }, error) : null,
                React.createElement('div', { className: 'dsn-hint' }, T('消息将作为主会话的一条用户消息，主 agent 在下一轮直接处理。', 'Delivered as a user message; the main agent handles it on its next turn.')),
                React.createElement(
                  'div',
                  { className: 'dsn-actions' },
                  React.createElement('button', {
                    type: 'button',
                    className: 'dsn-btn dsn-btn-primary',
                    disabled: sending || draft.trim() === '',
                    onClick: () => { void send() },
                  }, sending ? T('发送中…', 'Sending…') : T('发送', 'Send')),
                  React.createElement('button', { type: 'button', className: 'dsn-btn', onClick: () => setOpen(false) }, T('取消', 'Cancel')),
                ),
              )
            : null,
          React.createElement('button', {
            type: 'button',
            className: 'dsn-pill',
            title: T('把消息直接推送给主 agent', 'Push a message straight to the main agent'),
            onClick: () => setOpen((v) => !v),
          },
            React.createElement('span', { className: 'dsn-dot', 'data-busy': snap.mainBusy ? '1' : undefined }),
            T('通知主 agent', 'Notify main agent'),
          ),
        )
      }

      const host = document.createElement('div')
      host.setAttribute('data-dsh-side-notify', '')
      const style = document.createElement('style')
      style.textContent = CSS
      host.appendChild(style)
      document.body.appendChild(host)
      const root = createRoot(host)
      root.render(React.createElement(Widget))

      ctx.effect(() => () => {
        window.clearInterval(interval)
        offList()
        root.unmount()
        host.remove()
      }, 'dsh-side-notify: widget mount')
    }

    return { name, inject, apply }
  },
})
