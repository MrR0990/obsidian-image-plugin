# Obsidian Image Plugin

一个强大的 Obsidian 图片管理插件，提供交互式图片缩放、拖动调整大小和 GitHub 图床功能。

## 功能特性

### 🖼️ 交互式图片控制

- **预设缩放比例**: 快速按钮切换常见尺寸（25%, 50%, 75%, 100%, 150%, 200%）
- **点击放大**: 点击图片在原始尺寸和当前尺寸间切换
- **拖动调整**: 拖动图片右下角的手柄自由调整大小
- **鼠标悬停控制**: 控件仅在悬停时显示，保持界面整洁

### ☁️ GitHub 图床

- **一键上传**: 将图片上传到 GitHub 仓库作为 CDN
- **自动生成唯一文件名**: 基于时间戳避免文件冲突
- **支持批量上传**: 一次上传多张图片
- **配置灵活**: 支持自定义仓库、分支和存储路径

### 🎨 美观的用户界面

- **现代化设计**: 圆角按钮，平滑动画
- **深色模式适配**: 完美支持 Obsidian 的亮/暗主题
- **响应式布局**: 移动端和桌面端均可良好使用
- **视觉反馈**: 上传状态、加载动画、成功提示

## 安装

### 手动安装

1. 下载最新版本的 `main.js`、`manifest.json` 和 `styles.css`
2. 在你的 Obsidian vault 中创建插件目录：
   ```
   <vault>/.obsidian/plugins/obsidian-image-plugin/
   ```
3. 将下载的文件复制到该目录
4. 在 Obsidian 中：设置 → 社区插件 → 重新加载插件 → 启用 "Image Plugin"

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/yourusername/obsidian-image-plugin.git
cd obsidian-image-plugin

# 安装依赖
npm install

# 开发模式（自动监听和重新编译）
npm run dev

# 或构建生产版本
npm run build
```

## 配置

### GitHub 图床设置

1. **创建 GitHub 仓库**
   - 创建一个新的公开仓库用于存储图片
   - 例如：`username/my-images`

2. **生成 Personal Access Token**
   - 访问：GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - 点击 "Generate new token (classic)"
   - 勾选 `repo` 权限（完整仓库控制）
   - 生成并复制 token（格式：`ghp_xxxxxxxxxxxx`）

3. **在插件中配置**
   - 打开 Obsidian 设置 → Image Plugin
   - 填写以下信息：
     - **GitHub Token**: 你的 personal access token
     - **GitHub Repository**: `username/repo-name`
     - **Branch**: `main` 或你的分支名
     - **Storage Path**: `images/` 或自定义路径

4. **测试连接**
   - 使用命令面板（Ctrl/Cmd + P）
   - 运行 "Test GitHub connection"
   - 确认连接成功

### 显示设置

- **Default Image Width**: 图片默认显示宽度（1-100%）
- **Enable Click to Zoom**: 允许点击图片放大
- **Enable Drag to Resize**: 允许拖动调整大小
- **Zoom Presets**: 自定义缩放预设（逗号分隔，如：25,50,75,100）

### 自动上传设置

- **Auto Upload Pasted Images**: 粘贴图片时自动上传
- **Auto Upload Dropped Images**: 拖放图片时自动上传

## 使用方法

### 基本图片显示

在笔记中插入图片：

```markdown
![](image.png)
或
![[image.png]]
```

插件会自动增强所有图片，添加交互控制。

### 调整图片大小

**方法 1：使用预设按钮**
- 鼠标悬停在图片上
- 点击顶部出现的百分比按钮（25%, 50%, 75%, 等）

**方法 2：点击放大**
- 点击图片切换到 100% 尺寸
- 再次点击返回之前的尺寸

**方法 3：拖动调整**
- 鼠标悬停在图片上
- 拖动右下角的 ⊙ 图标
- 左右拖动来调整宽度

### 上传图片到 GitHub

1. 鼠标悬停在要上传的图片上
2. 点击 "📤 Upload" 按钮
3. 等待上传完成
4. 图片 URL 会自动更新为 GitHub 的直链

上传后的图片会显示 ✓ 标记。

## 命令

插件提供以下命令（通过命令面板 Ctrl/Cmd + P 访问）：

- **Upload current image to GitHub**: 上传当前图片
- **Test GitHub connection**: 测试 GitHub 连接

## 开发

### 项目结构

```
obsidian-image-plugin/
├── main.ts                  # 插件入口
├── src/
│   ├── types.ts            # TypeScript 类型定义
│   ├── settings.ts         # 设置管理
│   ├── githubUploader.ts   # GitHub API 集成
│   ├── imageZoom.ts        # 图片缩放功能
│   └── imageRenderer.ts    # Markdown 渲染处理
├── styles.css              # 插件样式
├── manifest.json           # 插件元数据
└── CLAUDE.md               # 开发者文档
```

### 架构说明

查看 [CLAUDE.md](./CLAUDE.md) 获取详细的架构说明和开发指南。

### 开发命令

```bash
npm run dev      # 开发模式（自动重新编译）
npm run build    # 生产构建
npm run version  # 更新版本号
```

### 技术栈

- **TypeScript**: 主要开发语言
- **esbuild**: 快速打包工具
- **Obsidian API**: 插件接口
- **GitHub API**: 图床功能

## 常见问题

### Q: 图片上传失败？

**A:** 检查以下几点：
1. GitHub token 是否正确且有 `repo` 权限
2. 仓库名称格式是否正确（`username/repo`）
3. 分支名是否存在
4. 网络连接是否正常

使用 "Test GitHub connection" 命令验证配置。

### Q: 控制按钮不显示？

**A:** 确保：
1. 插件已启用
2. 鼠标悬停在图片上
3. 图片已完全加载

### Q: 拖动调整不工作？

**A:** 检查设置中 "Enable Drag to Resize" 是否开启。

### Q: 如何修改默认缩放预设？

**A:** 在设置中找到 "Zoom Presets"，输入自定义百分比，用逗号分隔。

## 路线图

未来计划功能：

- [ ] 支持更多图床服务（S3、Imgur、自定义服务器）
- [ ] 图片压缩和优化
- [ ] 批量操作多张图片
- [ ] 键盘快捷键
- [ ] 图片编辑（裁剪、旋转）
- [ ] 本地缓存
- [ ] 撤销/重做功能

## 贡献

欢迎贡献！请提交 Pull Request 或创建 Issue。

## 许可证

MIT License

## 致谢

- [Obsidian](https://obsidian.md) - 优秀的笔记应用
- [Obsidian Plugin Developer Docs](https://docs.obsidian.md/Plugins) - 详细的开发文档
- 所有贡献者和用户

## 支持

如果你觉得这个插件有用，请：
- ⭐ Star 这个项目
- 🐛 报告 Bug
- 💡 提出新功能建议
- 📖 改进文档

---

Made with ❤️ for the Obsidian community
