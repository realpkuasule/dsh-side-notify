# dsh-side-notify

**dsh-sidechat 的配套插件**：给"Codex 式侧边聊天"补上主动推送能力——在侧聊面板旁把一条消息**直接推送给主 agent**，主 agent 会把它当作主会话的下一条用户消息处理（主动触发一轮），无需手动复制、无需在主对话里手动发送。

## 功能

- **悬浮按钮**：当前对话存在活跃侧边聊天时，页面右下角（侧聊面板左侧）出现「通知主 agent」胶囊按钮。
- **点击输入 → 推送**：输入内容后（`Enter` 发送 / `Ctrl+Enter` 或 `⌘+Enter` 快捷发送），消息以 `source: kind 'user'` 直接 `followup` 进主会话——主 agent 空闲则立即处理，正在思考则本轮结束后处理。
- **斜杠命令**：同时注册了 `/notify <内容>` 与 `/to-main <内容>` 两个全局命令，供任何能在侧聊 agent 上执行宿主命令的界面使用。
- **状态指示**：主 agent 忙碌时胶囊上的圆点变橙色，推送后会提示"当前轮次结束后处理"。
- **中英文跟随**：跟随 DSH 语言设置（默认中文）。

## 与 dsh-sidechat 自带"带回"的区别

| | dsh-sidechat 自带 bring-back | dsh-side-notify 推送 |
|---|---|---|
| 落点 | 主对话**草稿框**（手动发送）或**折叠上下文行**（下一轮被动看到） | 直接作为主会话的**用户消息** |
| 触发主 agent | 否（需手动发送 / 等下一轮） | **是**（主动开启一轮） |
| 适用场景 | 把资料、结论"贴回去" | 下命令：让主 agent 立刻处理某事 |

## 安装

```bash
# 与 dsh-sidechat 一起装在 web profile（从 GitHub）：
dsh plugin --profile web add github:realpkuasule/dsh-sidechat
dsh plugin --profile web add github:realpkuasule/dsh-side-notify

# 或本地路径（软链接，改代码即生效）：
dsh plugin --profile web add ./dsh-side-notify
```

重启 `dsh web` 并硬刷新页面（Cmd/Ctrl+Shift+R）后生效。

## 架构

- **Host**（`lib/index.js`）：`/side-notify/api/{state,push}` JSON 路由（与 dsh-sidechat 相同的 loopback/可信主机围栏）+ 全局 `/notify`、`/to-main` 命令。两者都通过 `agent.followup()` 把消息投递给主会话 agent。
- **Client**（`lib/client.js`）：`window.__ModuleLoader__` 格式的纯 JS bundle，portal 到 `document.body`；每 1.5s 轮询 state，用 `--dsh-subchat-width` CSS 变量把自己定位在侧聊面板左侧。
- 纯 JS，无构建步骤（`lib/` 即产物）。

## 许可证

MIT。信任围栏代码移植自 heartmove/dsh-side-chat（MIT）。
