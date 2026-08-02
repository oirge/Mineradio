# Pitfall: 主进程外部文件读取必须有大小上限

## Context

- 适用于 `desktop/main.js` 中所有把用户可控/外部文件一次性读入主进程内存的路径（`fs.readFileSync` / `fs.promises.readFile`），尤其是经由对话框选择的文件。
- 已知入口：存档导入 `mineradio-import-json-file`、本地文件范围读取 `readAuthorizedLocalFileRange`（64MB）、封面 data URL `readAuthorizedLocalFileDataUrl`（32MB）、桌面 UI 状态读取（2MB）。`server.js` 侧对应请求体（8MB）、更新安装包、快速补丁（`PATCH_MAX_BYTES`）。

## Fact / Pitfall (Root Cause)

- `mineradio-import-json-file` 曾直接 `fs.readFileSync(filePath, 'utf8')` 读取用户在“导入存档”对话框选中的文件，且**没有任何大小校验**。
- 存档导出扩展名限定为 `.json`，但用户可把任意超大文件重命名为 `.json` 后选中，或在过滤器外手动选择。一次性 `readFileSync` 会分配与文件等大的字符串/Buffer，超大文件直接把**主进程**推向 OOM 崩溃（比 renderer 崩溃更严重，整个应用退出）。
- 这是当时项目内**唯一**缺少输入上限的外部文件读取路径，破坏了“所有外部文件读取都有内存上限”这一既有安全不变量。

## Solution / Convention

- 读文件前先 `fs.statSync`（或 `fs.promises.stat`）：非普通文件返回 `IMPORT_NOT_A_FILE`，超过上限（存档取 16MB，远大于正常存档）返回 `IMPORT_FILE_TOO_LARGE`，再读入内存。
- 约定：**任何新增的“把外部/用户可控文件读入主进程内存”的入口，落盘前必须先做大小上限校验**，上限值与该内容的合理体量匹配（存档 16MB、图片 32MB、范围读 64MB 等）。不要依赖对话框扩展名过滤器当作大小保护。
- 该修复属于补齐既有安全约定的一致性缺口，不是新增投机性防御。

## Reference

- 实现：`desktop/main.js` 的 `mineradio-import-json-file` 处理器。
- 回归测试：`tests/import-json-file-size-limit.test.js`（覆盖超大文件拒绝、正常文件放行、未选择取消三条路径）。
