# 旧视图弃用与迁移计划

## 目的

项目正在从旧首页和列表式详情页迁移到以 `components/app/home`、Grid3D 和 `GridView` 为核心的新首页流程。本说明定义旧组件的保留范围，防止新功能继续进入即将移除的路径。

## 旧首页与本地 / Navidrome 视图

以下组件属于旧首页流程，会随旧首页一起移除：

| 范围 | 组件 |
| --- | --- |
| 首页 | `src/components/Home.tsx` |
| 本地音乐 | `src/components/LocalMusicView.tsx`、`src/components/local/LocalPlaylistView.tsx`、`src/components/local/LocalArtistView.tsx` |
| Navidrome | `src/components/navidrome/NavidromeMusicView.tsx`、`NavidromeAlbumView.tsx`、`NavidromeArtistView.tsx`、`NavidromeCollectionView.tsx` |

不要为这些组件增加功能、状态或交互。新首页功能放在 `src/components/app/home/*`；本地和 Navidrome 的集合浏览、详情和播放队列应接入 Grid3D / `GridView` 数据流。

## 搜索结果保留路径

网易云的旧列表式详情组件暂时保留，但仅允许作为搜索结果的跳转目标：

| 包装入口 | 旧实现 |
| --- | --- |
| `src/components/app/views/PlaylistView.tsx` | `src/components/PlaylistView.tsx` |
| `src/components/app/views/AlbumView.tsx` | `src/components/AlbumView.tsx` |
| `src/components/app/views/ArtistView.tsx` | `src/components/ArtistView.tsx` |

这组组件不得承接首页、收藏库、本地音乐或 Navidrome 的新入口，也不应继续增加列表功能。搜索结果改用新详情流后，应同时移除 wrapper 和对应旧实现。

## 移除条件

可以删除旧组件的前提是：

1. 新首页已覆盖首页中的网易云、本地音乐和 Navidrome 导航。
2. GridView 已覆盖相应的集合详情、播放队列和必要的管理动作。
3. 搜索结果不再依赖旧的 Playlist / Album / Artist 详情 wrapper。
4. 对应路由、overlay、导入和测试已迁移到新入口。

在移除前，应保留现有功能的最小回归测试；不要为了保留旧组件而向其引入新的共享状态或数据接口。
