# dsh-side-notify

[dsh-sidechat](https://github.com/realpkuasule/dsh-sidechat) 的配套插件：在侧聊场景下把一条消息**直接推送给主 agent**，主 agent 会把它当作主会话的下一条用户消息处理——不用复制粘贴，也不用在主对话里手动发送。

> English docs: [README.md](./README.md).

## 功能

- **悬浮胶囊**——当前对话存在活跃侧聊时，页面右下角（侧聊面板左侧）出现「通知主 agent」按钮。
- **输入即推送**——输入内容后发送（或 `Cmd/Ctrl+Enter`），消息经 `agent.followup` 以普通用户消息投递进主会话；主 agent 空闲则立即处理，忙碌则当前轮结束后处理。
- **斜杠命令**——全局注册 `/notify <内容>` 与 `/to-main <内容>`，供任何能在侧聊 agent 上执行宿主命令的界面使用。
- **状态提示**——主 agent 忙碌时胶囊圆点变橙色；推送成功后提示消息是立即处理还是等待本轮结束。
- **中英文跟随** DSH 语言设置。

## 推送 与 dsh-sidechat 自带「带回」的区别

| | dsh-sidechat 自带带回 | dsh-side-notify 推送 |
|---|---|---|
| 落点 | 主对话**草稿框**（手动发送）或**折叠上下文行**（下一轮被动看到） | 直接作为主会话的**用户消息** |
| 是否触发主 agent | 否（手动发送 / 等下一轮） | **是**（排队开启自己的一轮） |
| 适用场景 | 把资料、结论"贴回去" | 下命令：让主 agent 立刻处理某事 |

## 安装

```bash
# 两个插件一起装进 web profile（从 GitHub）：
dsh plugin --profile web add github:realpkuasule/dsh-sidechat
dsh plugin --profile web add github:realpkuasule/dsh-side-notify

# 或本地源码安装（软链接，改代码即生效）：
dsh plugin --profile web add ./dsh-side-notify
```

重启 `dsh web` 并硬刷新页面（Cmd/Ctrl+Shift+R）。`dsh-side-notify` 直接分发预构建的 JavaScript，GitHub 安装无需构建授权。

## 使用

1. 发起或打开一个侧聊（见 [dsh-sidechat](https://github.com/realpkuasule/dsh-sidechat)）。
2. 点击面板旁的「**通知主 agent**」胶囊，输入消息并发送。
3. 主对话会以普通用户消息的形式显示这条消息，主 agent 在下一轮直接处理。

## 实现原理

- **Host**（`lib/index.js`）——`/side-notify/api/{state,push}` JSON 路由（与 dsh-sidechat 相同的 loopback/可信主机围栏）+ 全局 `/notify`、`/to-main` 命令。两者都通过侧聊会话的 `header.parentSession` 找到实时主 agent，再用 `agent.followup` 投递消息。
- **Client**（`lib/client.js`）——`window.__ModuleLoader__` 格式的纯 JS bundle，portal 挂载到 `document.body`；每 1.5 秒轮询 state 路由，并用 `--dsh-subchat-width` CSS 变量把自己定位在侧聊面板左侧。
- 无构建步骤：`lib/` 即源码与产物。

## 许可证

MIT。信任围栏代码移植自 heartmove/dsh-side-chat（MIT）。
