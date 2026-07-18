# Codex Usage Dashboard

一个非官方的本地 Codex 用量悬浮窗，用于在 Windows 上查看 Codex 剩余容量、Token 消耗和当前任务状态。

## 功能

- Windows 悬浮窗，始终置顶，界面为中文。
- mac 风格窗口控制：红点退出、黄点缩小、绿点放大/还原。
- 显示 Codex 容量、Token 消耗、当前任务状态；只有读取到真实进度字段时才显示进度。
- 每 5 秒自动刷新一次数据。
- 支持伴随 Codex 启动显示：检测到 Codex 运行时显示窗口，否则后台隐藏。
- 支持 Windows 开机自启。
- 支持打包为 Windows 安装版 exe，安装时创建快捷方式。

## 下载使用

已发布的 Windows 版本：

[下载 CodexUsage-0.1.0-win.exe](https://github.com/cherub0/codex-usage/releases/download/v0.1.0/CodexUsage-0.1.0-win.exe)

这是未签名的便携版 exe。Windows 第一次运行时可能会提示安全警告，选择“更多信息”，再选择“仍要运行”即可。

如果需要自动创建桌面快捷方式和开始菜单快捷方式，请下载安装版：

[下载 CodexUsage-Setup-0.1.0-win.exe](https://github.com/cherub0/codex-usage/releases/download/v0.1.0/CodexUsage-Setup-0.1.0-win.exe)

## 本地运行

先安装依赖：

```powershell
cd D:\for_cherub\05.codex\codex-usage
npm install
```

启动悬浮窗：

```powershell
npm run app
```

开发时如果想强制显示窗口，不等待 Codex 进程检测：

```powershell
npm run app:dev
```

## 开机自启

安装当前用户的 Windows 启动项：

```powershell
npm run autostart:install
```

取消开机自启：

```powershell
npm run autostart:uninstall
```

自启后，监控进程会在登录 Windows 后后台运行；检测到 Codex 进程时显示悬浮窗，未检测到时保持隐藏。

## Web 预览

项目也保留了本地 Web 预览：

```powershell
npm start
```

然后打开：

```text
http://127.0.0.1:8787
```

## 打包 exe

生成 Windows 安装版 exe：

```powershell
npm run dist
```

构建产物会输出到：

```text
dist\CodexUsage-Setup-0.1.0-win.exe
```

打包使用 `electron-builder`，当前配置会生成安装版，并关闭签名编辑步骤，避免普通 Windows 用户权限下的符号链接问题。

## 数据来源

本项目只读取本机 Codex 元数据，不调用远程服务上传数据。

当前读取的数据包括：

- `~\.codex\sessions\...` 中的 Codex 会话 JSONL。
- `event_msg.payload.info.total_token_usage` 中的 Token 统计。
- `event_msg.payload.rate_limits` 中的容量使用比例。
- `~\.codex\state_5.sqlite` 中的任务索引。
- `~\.codex\session_index.jsonl` 中的安全任务标题回退。

如果本机没有可读取的容量快照，界面会显示空状态或演示标记，不会猜测额度。

## 隐私说明

项目不会展示或上传以下内容：

- 用户提示词全文。
- Codex 回复全文。
- 命令输出。
- diff 内容。
- access token、refresh token、cookie 或认证数据。

任务标题只从安全索引字段中读取；如果数据库标题乱码或不可读，会回退到安全标题或默认标题。

## 配置项

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8787` | Web 预览端口 |
| `HOST` | `127.0.0.1` | Web 预览绑定地址 |
| `CODEX_HOME` | `%USERPROFILE%\.codex` | Codex 本地目录 |
| `CODEX_LOOKBACK_DAYS` | `14` | 扫描最近多少天的 session 日志 |
| `CODEX_USAGE_FORCE_SHOW` | 空 | 设置为 `1` 时强制显示 Electron 悬浮窗 |
| `CODEX_USAGE_PROJECT_CWD` | 当前工作目录 | 当前任务匹配目录 |

## 常用命令

```powershell
npm test
npm start
npm run app
npm run app:dev
npm run autostart:install
npm run autostart:uninstall
npm run dist
```

## 开发验证

运行测试：

```powershell
npm test
```

当前测试覆盖：

- Codex 当前日志格式读取。
- 容量和 Token 归一化。
- 任务读取和安全标题回退。
- Electron 渲染资源加载。
- mac 三色窗口控制。
- Windows 开机自启脚本。
- exe 打包配置。

## 限制

- 这是非官方工具，不代表 OpenAI 或 Codex 官方实现。
- Codex 本地日志格式可能变化，变化后可能需要更新 reader。
- 容量信息只在 Codex 本机日志写入对应快照后才可显示。
- portable exe 未签名，首次运行可能触发 Windows 安全提示。

## License

MIT
