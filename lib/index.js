/**
 * dsh-side-notify — companion to dsh-side-chat.
 *
 * Host half. Two delivery surfaces:
 *
 * 1. The browser widget routes `/side-notify/api/state` and
 *    `/side-notify/api/push` (same loopback/trusted-authority fence as
 *    dsh-side-chat's own API).
 * 2. The global slash commands `/notify` and `/to-main`, executable
 *    against a side-chat agent by any UI that runs host commands.
 *
 * Both push one user message straight into the MAIN conversation agent via
 * `agent.followup()`, so the main agent processes it as its own next turn —
 * the active counterpart of dsh-side-chat's passive bring-back (draft /
 * context row).
 */
import { randomUUID } from 'node:crypto'
import { isTrustedApiRequest } from './trust-fence.js'

export const name = 'dsh-side-notify'

export const inject = ['webServer', 'agents', 'commands']

const USAGE_TEXT = '用法：/notify <要推送给主 agent 的内容>'
const MAX_PUSH_LENGTH = 20000
const MAX_BODY_BYTES = 65536

/** A user-role message value `agent.followup` accepts (same shape dsh-side-chat uses). */
function userMessage(text) {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }
}

/** Live side chats (agents whose header.parentSession matches) for one parent session. */
function liveSidechatsOf(ctx, parentSessionId) {
  const out = []
  for (const agent of ctx.agents.list()) {
    const session = agent.session
    const header = session === undefined ? undefined : session.header
    if (header !== undefined && header.parentSession === parentSessionId) out.push(agent)
  }
  return out
}

/** Resolve the live main agent; throws a user-facing error when absent. */
function parentOf(ctx, parentSessionId) {
  const parent = ctx.agents.get(parentSessionId)
  if (parent === undefined) {
    throw apiError('parent-unavailable', '主会话当前不在线：请回到主对话页面并保持其打开，再试一次。')
  }
  return parent
}

/** Push one text message to the main agent as its own next turn. */
function pushToMain(ctx, parentSessionId, text) {
  const parent = parentOf(ctx, parentSessionId)
  parent.followup(userMessage(text))
  const status = typeof parent.status === 'string' ? parent.status : 'idle'
  return { queued: true, mainBusy: status !== 'idle' }
}

/** Error carrying a stable API code for the JSON responder. */
function apiError(code, message) {
  const error = new Error(message)
  error.sideNotifyCode = code
  return error
}

/** The `trustedHosts` list of the `connection` loader row (empty → loopback-only fence). */
function trustedHostsOf(ctx) {
  const loader = ctx.get('loader')
  if (loader === undefined || typeof loader.entries !== 'function') return []
  const out = []
  for (const entry of loader.entries()) {
    const config = entry?.options?.config
    if (entry?.options?.name === 'connection' && config !== null && config !== undefined && Array.isArray(config.trustedHosts)) {
      out.push(...config.trustedHosts)
    }
  }
  return out
}

function writeJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw apiError('payload-too-large', 'request body too large')
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (raw === '') return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('body must be a JSON object')
    return parsed
  } catch {
    throw apiError('bad-request', 'invalid JSON body')
  }
}

/** Command handler shared by /notify and /to-main. */
function executeNotify(ctx, agent, rawInput) {
  const session = agent === undefined ? undefined : agent.session
  const header = session === undefined ? undefined : session.header
  const parentSessionId = header !== undefined && typeof header.parentSession === 'string' ? header.parentSession : ''
  if (parentSessionId === '') {
    return { kind: 'error', text: '当前会话不是侧边聊天（没有关联的主会话）：请在侧边聊天中使用 /notify。' }
  }
  const text = String(rawInput ?? '').trim()
  if (text === '') return { kind: 'error', text: USAGE_TEXT }
  if (text.length > MAX_PUSH_LENGTH) return { kind: 'error', text: `内容过长（上限 ${MAX_PUSH_LENGTH} 字符）。` }
  try {
    const result = pushToMain(ctx, parentSessionId, text)
    return {
      kind: 'success',
      text: result.mainBusy
        ? '已推送给主 agent：其当前轮次结束后将处理这条消息。'
        : '已推送给主 agent。',
    }
  } catch (error) {
    return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
  }
}

export function apply(ctx) {
  // Slash commands: usable from any surface that executes host commands
  // against a side-chat agent, today or after future dsh-side-chat updates.
  ctx.effect(() => ctx.commands.register({
    name: 'notify',
    description: '把消息直接推送给主 agent，作为主会话的下一条消息处理',
    input: { hint: '要推送给主 agent 的内容' },
    handler: (invocation) => executeNotify(ctx, invocation.agent, invocation.rawInput),
  }), 'dsh-side-notify: /notify command')

  ctx.effect(() => ctx.commands.register({
    name: 'to-main',
    description: '同 /notify：把消息直接推送给主 agent',
    input: { hint: '要推送给主 agent 的内容' },
    handler: (invocation) => executeNotify(ctx, invocation.agent, invocation.rawInput),
  }), 'dsh-side-notify: /to-main command')

  // ---- JSON API for the browser widget ----
  const api = {
    state(payload) {
      const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId : ''
      if (sessionId === '') return { available: false, mainBusy: false, childCount: 0 }
      const children = liveSidechatsOf(ctx, sessionId)
      const parent = ctx.agents.get(sessionId)
      const mainBusy = parent !== undefined && typeof parent.status === 'string' ? parent.status !== 'idle' : false
      return { available: parent !== undefined && children.length > 0, mainBusy, childCount: children.length }
    },
    push(payload) {
      const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId : ''
      if (sessionId === '') throw apiError('bad-request', 'missing sessionId')
      const text = typeof payload?.text === 'string' ? payload.text.trim() : ''
      if (text === '') throw apiError('bad-request', 'empty text')
      if (text.length > MAX_PUSH_LENGTH) throw apiError('bad-request', 'text too long')
      return pushToMain(ctx, sessionId, text)
    },
  }

  const handler = async (req, res) => {
    if (!isTrustedApiRequest(req, trustedHostsOf(ctx))) {
      writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
      return
    }
    if (req.method !== 'POST') {
      writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
      return
    }
    const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
    const method = pathname.startsWith('/side-notify/api/') ? pathname.slice('/side-notify/api/'.length) : undefined
    if (method === undefined || method.includes('/')) {
      writeJson(res, 404, { ok: false, error: { code: 'not-found', message: 'unknown side-notify API method' } })
      return
    }
    const fn = api[method]
    if (fn === undefined) {
      writeJson(res, 404, { ok: false, error: { code: 'not-found', message: `unknown side-notify API method "${method}"` } })
      return
    }
    try {
      const payload = await readJsonBody(req)
      writeJson(res, 200, { ok: true, value: await fn(payload) })
    } catch (error) {
      const code = error instanceof Error && typeof error.sideNotifyCode === 'string' ? error.sideNotifyCode : 'internal'
      writeJson(res, code === 'internal' ? 500 : 400, {
        ok: false,
        error: { code, message: error instanceof Error ? error.message : String(error) },
      })
    }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/side-notify/api',
    handler,
  }), 'dsh-side-notify: /side-notify/api routes')
}
