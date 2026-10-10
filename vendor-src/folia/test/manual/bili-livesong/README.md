# Bili Live Song Demo

这是一个使用 Folia Stage API 的示例程序。

它的主要功能是接收直播间点歌请求，并通过 Stage API 把点中的歌曲交给 Folia 播放。

## 使用方式

1. 在 Folia 桌面端开启 Stage Mode，复制 Bearer token。
2. 安装示例依赖：

```bash
pip install aiohttp blivedm
```

3. 编辑 `main.py` 顶部的 `ROOM_ID`、`BASE_URL` 和 `API_TOKEN`。也可以通过环境变量提供 B 站 `SESSDATA`：

```bash
BILIBILI_SESSDATA="your-sessdata" python main.py
```

4. 启动程序后，在直播间发送 `/song 歌曲名称` 或 `/点歌 歌曲名称`。

示例会先调用 `POST /stage/player/search`，取第一条结果，再调用 `POST /stage/player/play` 并使用 `appendToQueue: true` 将歌曲加入 Folia 主队列。请不要把真实的 Stage token 或 B 站 Cookie 提交到仓库。
