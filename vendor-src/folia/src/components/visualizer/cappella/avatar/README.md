# Cappella 头像

此文件夹内存放供 Cappella 使用的内置头像。

运行时由上级 `../avatarImages.ts` 通过 Vite `import.meta.glob` 自动加载目录中的图片文件（png、jpg、jpeg、gif、webp、svg），文件名去掉扩展名后作为头像名称，并生成 `builtin-avatar-*` id。头像选择按 seed、左右位置和 avatar index 稳定分配，不需要在这里维护额外的注册表。

用户上传的自定义头像不放入此目录，而是由 `src/services/cappellaAvatarPack.ts` 经 `src/services/db.ts` 保存到 IndexedDB，并通过 Cappella 设置面板选择或清空。选择 `color` 时不读取图片，选择 `cover` 时可直接使用歌曲封面。

# disclaimer

文件夹中的图片人物为 Folia 拟人形象(folia-chan)，任何与已有人物的相似之处纯属巧合。

这些头像图片皆为 GPT Image2 模型生成，即AI生成的图片。

这些图片的版权不受本仓库代码的 AGPL-3.0 许可证的约束，任何人都可以自由地使用，修改和分发这些图片，因为这些图片是由 AI 模型生成的，而不是由人类艺术家创作的，因此不受传统版权法的保护。

向所有曾上传作品至互联网的艺术家们致敬，他们的作品使得这些图片的生成成为可能。我们鼓励用户尊重人类艺术家的创作，关注那些真正的艺术家和他们的作品。
