# 贡献指南

感谢你对 Mineradio 的关注！

## 开发环境要求

- Node.js 22.x
- npm 10.x
- Windows 10+ (主要构建目标)

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/oirge/Mineradio.git
cd Mineradio

# 安装依赖
npm install

# 启动开发模式
npm start

# 运行测试
npm test

# 构建 Windows 安装包
npm run build:win
```

## 开发流程

1. Fork 本仓库到你的账号
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 进行开发并提交更改
4. 推送到你的分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 代码规范

### 提交前检查

```bash
# 验证 JavaScript 语法
node --check desktop/main.js
node --check desktop/preload.js

# 检查空白符问题
git diff --check

# 运行测试套件
npm test
```

### 提交信息格式

使用清晰的提交信息：

- `feat: 添加新功能描述`
- `fix: 修复问题描述`
- `perf: 性能优化描述`
- `docs: 文档更新描述`
- `test: 测试相关描述`

## Pull Request 要求

提交 PR 时请确保：

- ✅ 提供清晰的变更说明
- ✅ 说明为什么需要这个变更
- ✅ 包含相关的测试用例（如适用）
- ✅ 代码通过 `node --check` 检查
- ✅ 代码通过 `git diff --check` 检查
- ✅ 如果修改了功能，更新相关文档

## 项目结构

```
Mineradio/
├── desktop/           # Electron 主进程代码
├── public/           # 前端页面和资源
│   ├── index.html   # 主界面
│   └── mini-player.html  # 迷你播放器
├── tests/           # 测试文件
└── package.json     # 项目配置
```

## 测试

```bash
# 运行所有测试
npm test

# 构建并测试 Windows 版本
npm run build:win
```

## 功能开发建议

### 音频格式支持

当前支持的格式：MP3, FLAC, M4A, WAV, OGG

如需添加新格式支持，请在 PR 中说明：
- 格式的技术规格
- 浏览器兼容性
- 测试用例

### 歌词功能

当前支持：
- 同名 `.lrc` / `.txt` 歌词文件
- FLAC 内嵌 `LYRICS` 标签
- 带时间轴的 LRC 格式

### 性能考虑

- 本地音乐库扫描应当高效
- 大型音乐库（1000+ 文件）性能测试
- 内存占用控制

## 获取帮助

- 查看现有 [Issues](https://github.com/oirge/Mineradio/issues)
- 查看 [README](./README.md) 了解项目概况
- 有问题可以在 Issue 中提问

## 授权

本项目采用与原项目相同的授权协议，详见 [LICENSE](./LICENSE)。

贡献代码即表示你同意将代码贡献在相同授权下。
