# Security Policy

## Supported Versions

当前只维护最新公开版本。

## Installer Safety Notice

`v1.0.10` 及更早旧安装包不再建议继续安装或传播。请将旧 `.exe` 安装包视为不可信历史产物并隔离保留；需要安装 Mineradio 时，请使用 `v1.1.0` 或更新版本的 GitHub Release 安装包。

`v1.1.0` 不作为 `v1.0.10` 的软件内本地更新包发布。旧版本用户请手动下载新版安装包，卸载旧版本后进行纯净安装。

## Reporting a Vulnerability

如果你发现安全问题，请通过 GitHub Issues 或仓库作者主页联系作者。

请不要在公开 Issue 中直接贴出 Cookie、Token、账号信息、私密链接或可复现的敏感数据。

## Sensitive Data

当前电脑版不提供在线音乐账号登录，也不附带默认翻译接口、模型或 API Key。自定义翻译源由用户明确配置，密钥通过系统安全存储加密保存在本机；安全存储不可用时仅本次运行有效，不使用明文文件兜底。密钥不读回渲染界面，不进入整机备份。接口请求与连接测试只发送到用户配置的服务，详情见 [隐私说明](./PRIVACY.md)。

如果你要提交问题反馈，请先确认没有附带：

- `.cookie`
- `.qq-cookie`
- 本地音乐文件
- 用户账号截图
- 调试日志中的 Cookie、Token 或隐私路径
- 翻译服务 API Key、`translation-settings.json` 或设置截图中的密钥

## Dependency Security Gate

v2.7.0 使用 Electron 43.8.8，并更新 Undici、Vite、Vitest 等依赖。`npm run audit:security` 检查根目录及 `vendor-src/folia` 的锁文件，包含随桌面安装包分发的 Electron 内核。Verify 与 Release 在构建前执行该检查；审计请求失败或未接受的 high/critical 漏洞会停止流程，完整报告保存为 CI 工件。检查只在验证与发布时运行，不创建定时任务。

当前根依赖仍有 builder/minimatch 的 moderate 公告；Folia 构建工具还涉及 Workbox/glob 与 deepmerge 的中低等级公告。未采用会降级 builder 或强制跨大版本的 `npm audit fix --force`。这些剩余项仍显示在审计报告中，后续兼容修复需单独验证。

唯一 high 例外是 Folia 上游未启用 FTP provider 依赖 `basic-ftp 5.x` 的 [GHSA-c475-qrg2-pj4r](https://github.com/advisories/GHSA-c475-qrg2-pj4r)：上游 `get-uri` 仍要求 5.x，目前没有该系列修复版。Mineradio 的选择性本地构建排除在线 provider，相关服务不随桌面本地入口启用。例外限定到 Folia 依赖树、该包、该公告及当前 high 级别和范围；新公告、范围变化或 critical 升级不会自动放行。该漏洞向 `get-uri`、`pac-proxy-agent` 和上游音乐 API 的传播项不代表四个独立运行漏洞。
