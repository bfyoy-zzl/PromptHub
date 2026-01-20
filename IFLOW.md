# PromptHub 项目文档

## 项目概述

PromptHub 是一个基于 Electron + Vue 3 + TypeScript 构建的现代化桌面应用程序，专注于提示词管理和灵感收藏。该项目采用了自定义无边框窗口设计，支持多主题切换（现代简约、毛玻璃、新拟物）和深色模式，提供流畅的用户体验。

### 技术栈

- **框架**: Electron 39.2.6
- **前端框架**: Vue 3.5.25 (Composition API)
- **构建工具**: Vite 7.2.6 + electron-vite 5.0.0
- **语言**: TypeScript 5.9.3
- **样式**: Tailwind CSS 3.4.17 + PostCSS + Autoprefixer
- **代码质量**: ESLint 9.39.1 + Prettier 3.7.4
- **自动更新**: electron-updater 6.3.9
- **工具库**: @electron-toolkit/preload, @electron-toolkit/utils
- **数据压缩**: archiver 7.0.1, adm-zip 0.5.16

### 项目架构

```
src/
├── main/           # Electron 主进程
│   ├── config.ts   # 配置管理器（ConfigManager 类）
│   └── index.ts    # 主窗口创建、IPC 通信处理、窗口控制、托盘功能
├── preload/        # 预加载脚本（安全隔离层）
│   ├── index.ts    # 暴露 API 到渲染进程（窗口控制、electron API、数据操作）
│   └── index.d.ts  # TypeScript 类型定义（Window 接口扩展）
└── renderer/       # Vue 渲染进程
    ├── index.html  # HTML 入口文件
    └── src/
        ├── main.ts          # Vue 应用入口
        ├── App.vue          # 主应用组件（包含主题切换、窗口控制、提示词管理）
        ├── env.d.ts         # Vue 环境类型定义
        ├── assets/
        │   ├── base.css     # Tailwind 基础样式
        │   ├── main.css     # 全局样式和主题变量
        │   ├── electron.svg # Electron 图标
        │   ├── wavy-lines.svg # 装饰性 SVG
        │   ├── PromptHub.png # 应用图标
        │   ├── view.png     # 预览图片
        │   ├── view-1.png   # 预览图片 1
        │   └── view-2.png   # 预览图片 2
        └── components/
            ├── CustomScrollbar.vue # 自定义滚动条组件
            ├── Icons.vue          # 图标组件集合
            └── Versions.vue        # 版本信息显示组件
```

### 核心特性

- **自定义无边框窗口**: 使用 `frame: false` 移除原生窗口边框，通过 IPC 实现自定义窗口控制（最小化、最大化/还原、关闭）
- **多主题系统**: 支持三种视觉主题
  - **Modern (现代简约)**: 干净简洁的设计风格
  - **Glass (毛玻璃)**: 半透明模糊效果，支持三种背景类型
    - 预设渐变：5 种精美渐变预设
    - 自定义渐变：可自定义双色渐变及位置
    - 背景图片：支持自定义背景图片，可调节模糊度
  - **Neu (新拟物)**: 柔和阴影的拟物化设计，支持三种基调（灰、蓝、绿）
- **深色模式**: 支持手动切换深色/浅色模式，与主题系统独立工作
- **提示词管理**: 完整的 CRUD 功能
  - 添加/编辑/删除提示词
  - 支持图片上传（拖拽、粘贴、文件选择）
  - 自动生成缩略图（400px 宽）
  - 支持分类管理（拖拽排序、重命名、删除）
  - 双击复制提示词内容
  - **卡片复制**: 支持一键复制现有卡片
  - **原图查看**: 支持在新窗口中查看原图
  - **回收站功能**: 删除的提示词移至回收站，支持还原或彻底删除
    - 单项还原/删除
    - 批量还原所有项目
    - 批量清空回收站
  - **图片复制**: 支持将卡片图片复制到剪贴板
- **瀑布流布局**: 使用 CSS columns 实现响应式卡片布局，支持不同高度的卡片
- **自定义滚动条**: 针对不同主题优化的自定义滚动条组件
- **系统托盘**: 支持托盘图标和右键菜单
  - 快速打开主界面
  - 快速添加提示词
  - 快速访问各个设置页面（主题设置、分类管理、数据设置、关于）
  - 关闭窗口时隐藏到托盘而非退出应用
  - 单击托盘图标显示/隐藏窗口
- **数据持久化**: 
  - 配置保存在 `userData/settings.json`
  - 提示词数据保存在 `userData/PromptHubData/`
  - 支持自定义数据路径和数据迁移
  - **数据导出/导入**: 支持将所有提示词数据导出为 ZIP 包，或从 ZIP 包导入数据
- **拖拽区域**: 自定义窗口拖拽区域，保留按钮可点击性
- **硬件加速优化**: 开发时禁用硬件加速以避免渲染问题
- **字体颜色自定义**: 支持自定义主要文本颜色（10 种预设 + 自定义颜色选择器）
- **单实例锁定**: 防止同时运行多个应用实例

## 构建和运行

### 依赖安装

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

开发服务器运行在 `http://127.0.0.1:5173`

### 类型检查

```bash
# 检查 Node.js 类型（主进程）
npm run typecheck:node

# 检查 Web 类型（渲染进程）
npm run typecheck:web

# 检查所有类型
npm run typecheck
```

### 代码格式化

```bash
npm run format
```

### 代码检查

```bash
npm run lint
```

### 构建应用

```bash
# 完整构建（包含类型检查）
npm run build

# 仅构建不打包（用于测试）
npm run build:unpack

# Windows 平台打包
npm run build:win

# macOS 平台打包
npm run build:mac

# Linux 平台打包
npm run build:linux
```

### 预览构建结果

```bash
npm run start
```

## 开发约定

### 代码风格

- **TypeScript**: 严格类型检查，所有文件必须使用 TypeScript
- **ESLint**: 遵循 @electron-toolkit/eslint-config-ts 配置
- **Prettier**: 代码格式化，遵循 .prettierrc.yaml 配置
- **Vue 3**: 使用 Composition API (`<script setup>`)，所有 Vue 组件必须使用 TypeScript
- **Tailwind CSS**: 优先使用 Tailwind 工具类，复杂样式使用 CSS 变量
- **Vue 组件规则**:
  - 所有 `.vue` 文件的 `<script>` 块必须使用 `lang="ts"`
  - 组件名称可以是单个单词（禁用 `vue/multi-word-component-names` 规则）
  - Props 不需要默认值（禁用 `vue/require-default-prop` 规则）

### 导入路径别名

在渲染进程中使用 `@renderer/` 别名引用 `src/renderer/src/` 目录下的文件：

```typescript
import MyComponent from '@renderer/components/MyComponent.vue'
import myStyles from '@renderer/assets/main.css'
```

### TypeScript 类型定义

**预加载脚本类型** (`src/preload/index.d.ts`):
```typescript
import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    windowControls: {
      // 窗口控制
      minimize: () => Promise<void>
      toggleMaximize: () => Promise<void>
      close: () => Promise<void>
      
      // 配置管理
      saveConfig: (data: any) => Promise<void>
      onInitConfig: (callback: (value: any) => void) => void
      selectDataPath: () => Promise<string | null>
      
      // 数据管理
      changeDataPath: (newPath: string) => Promise<any>
      migratePrompts: (oldPath: string) => Promise<any>
      exportData: (exportPath: string) => Promise<any>
      importData: (zipPath: string) => Promise<any>
      selectExportPath: () => Promise<string | null>
      selectImportFile: () => Promise<string | null>
      
      // 提示词数据操作
      loadPrompts: () => Promise<any[]>
      savePrompt: (data: any) => Promise<any>
      deletePrompt: (data: any) => Promise<boolean>
      copyImage: (imagePath: string) => Promise<any>
      openFile: (path: string) => Promise<void>
      selectBgImage: () => Promise<string | null>
      
      // 辅助功能
      openDirectory: () => Promise<any>
      getFileAbsolutePath: (filePath: string) => Promise<string | null>
      
      // 托盘菜单命令
      onOpenAddPrompt: (callback: () => void) => void
      onOpenSettings: (callback: () => void) => void
      onOpenCategory: (callback: () => void) => void
      onOpenData: (callback: () => void) => void
      onOpenAbout: (callback: () => void) => void
    }
  }
}
```

### IPC 通信

IPC 通信通过预加载脚本进行安全隔离，主进程和渲染进程不能直接通信。

**主进程** (`src/main/index.ts`):
```typescript
import { ipcMain } from 'electron'

// 窗口控制处理器
ipcMain.handle('window-min', () => mainWindow?.minimize())
ipcMain.handle('window-max', () => {
  if (mainWindow?.isMaximized()) mainWindow?.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window-close', () => {
  // 关闭窗口时隐藏到托盘，而不是退出应用
  mainWindow?.hide()
})

// 配置管理
ipcMain.handle('config:save', (_, data) => configManager.save(data))
ipcMain.handle('dialog:selectDataPath', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory']
  })
  return canceled ? null : filePaths[0]
})
ipcMain.handle('data:changePath', (_, newPath) => configManager.changeDataPath(newPath))
ipcMain.handle('data:migratePrompts', (_, oldPath) => configManager.migratePromptsDataFrom(oldPath))
ipcMain.handle('data:export', async (_, exportPath) => configManager.exportData(exportPath))
ipcMain.handle('data:import', async (_, zipPath) => configManager.importData(zipPath))

// 提示词数据操作
ipcMain.handle('data:loadPrompts', () => {
  // 加载所有提示词卡片（排除回收站）
  // 返回排序后的提示词列表
  // 自动进行数据迁移（category -> categoryId）
})

ipcMain.handle('prompt:save', async (_, { id, title, categoryId, description, prompt, tempImagePath, removeImage }) => {
  // 保存或更新提示词
  // 处理图片上传和缩略图生成
  // 支持 file:// 路径复制功能
  // 超过4K分辨率的图片会自动压缩
  // 返回 { success: true, data: {...} }
})

ipcMain.handle('prompt:delete', (_, promptData) => {
  // 删除提示词及其关联的图片
  // 返回 true/false
})

// 图片复制
ipcMain.handle('image:copy', async (_, imagePath: string) => {
  // 将图片复制到剪贴板
  // 返回 { success: true } 或 { success: false, error: string }
})

// 文件和对话框
ipcMain.handle('file:open', (_, path) => shell.openPath(path))
ipcMain.handle('file:getAbsolutePath', (_, relativeOrBlobPath) => {
  // 获取文件的绝对路径
  // 处理 blob URL、相对路径、绝对路径
})
ipcMain.handle('dialog:selectBgImage', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
  })
  if (canceled || !filePaths[0]) return null
  return pathToFileURL(filePaths[0]).href
})
ipcMain.handle('dialog:selectExportPath', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: '选择导出位置'
  })
  return canceled ? null : filePaths[0]
})
ipcMain.handle('dialog:selectImportFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Zip Files', extensions: ['zip'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    title: '选择数据包文件'
  })
  return canceled ? null : filePaths[0]
})
```

**预加载脚本** (`src/preload/index.ts`):
```typescript
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 暴露 electron API
contextBridge.exposeInMainWorld('electron', electronAPI)

// 暴露自定义 API
contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.invoke('window-min'),
  toggleMaximize: () => ipcRenderer.invoke('window-max'),
  close: () => ipcRenderer.invoke('window-close'),
  
  saveConfig: (data: any) => ipcRenderer.invoke('config:save', data),
  onInitConfig: (callback: any) => {
    ipcRenderer.on('init-config', (_event, value) => callback(value))
  },
  
  loadPrompts: () => ipcRenderer.invoke('data:loadPrompts'),
  savePrompt: (data: any) => ipcRenderer.invoke('prompt:save', data),
  deletePrompt: (data: any) => ipcRenderer.invoke('prompt:delete', data),
  copyImage: (imagePath: string) => ipcRenderer.invoke('image:copy', imagePath),
  
  // ... 其他 API
})
```

**渲染进程** (`App.vue` 或其他 Vue 组件):
```typescript
// 使用 windowControls API
// @ts-ignore - API 在运行时注入
const win = window.windowControls

// 调用窗口控制
win?.minimize()
win?.toggleMaximize()
win?.close()

// 加载数据
const loadData = async () => {
  const data = await win.loadPrompts()
  promptList.value = data || []
  trashItems.value = data.filter(item => item.categoryId === 'trash')
}

// 保存提示词
const handleSave = async () => {
  const res = await win.savePrompt(payload)
  if (res.success) {
    // 处理成功
  }
}

// 复制卡片
const copyCard = async (item: PromptData) => {
  const res = await win.savePrompt({
    id: '', // 新卡片
    title: item.title + ' (副本)',
    categoryId: item.categoryId,
    description: item.description,
    prompt: item.prompt,
    tempImagePath: item.image ?? null // 传递原图路径用于复制
  })
  if (res.success) {
    loadData()
  }
}

// 复制图片到剪贴板
const copyImageToClipboard = async (imagePath: string) => {
  const res = await win.copyImage(imagePath)
  if (res.success) {
    // 显示复制成功提示
  }
}
```

### 主题系统

主题通过 CSS 变量定义在 `src/renderer/src/assets/main.css` 中：

**CSS 变量**:
- `--bg-app`: 应用背景色
- `--bg-panel`: 面板/卡片背景色
- `--primary`: 主色调
- `--primary-hover`: 主色调悬停色
- `--text-main`: 主要文本颜色
- `--text-sub`: 次要文本颜色
- `--border`: 边框颜色
- `--backdrop`: 模糊度（用于毛玻璃效果）
- `--shadow-md`: 默认阴影

**切换主题**:
```javascript
// 设置主题（modern/glass/neu）
document.documentElement.setAttribute('data-theme', 'glass')

// 切换深色模式
document.documentElement.classList.add('dark')
document.documentElement.classList.remove('dark')

// 设置字体颜色
document.documentElement.style.setProperty('--text-main', config.fontColor)
```

**Tailwind 配置** (`tailwind.config.js`):
```javascript
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        bg: 'var(--bg-app)',
        surface: 'var(--bg-panel)',
        txt: 'var(--text-main)',
        sub: 'var(--text-sub)',
      },
      boxShadow: {
        neu: 'var(--shadow-neu)',
        'neu-in': 'var(--shadow-neu-in)',
      }
    },
  },
}
```

### 窗口控制

**拖拽区域**:
```css
/* 定义可拖拽区域 */
.drag-region {
  -webkit-app-region: drag;
}

/* 定义不可拖拽区域（按钮等） */
.no-drag {
  -webkit-app-region: no-drag;
}
```

**窗口配置** (`src/main/index.ts`):
```typescript
const mainWindow = new BrowserWindow({
  frame: false,              // 移除原生边框
  autoHideMenuBar: true,     // 隐藏菜单栏
  backgroundColor: '#f3f4f6', // 避免黑屏
  width: 1590,
  height: 850,
  show: false,
  roundedCorners: true,      // 圆角窗口
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: false,
    webSecurity: false // 允许 file:// 协议加载图片
  }
})
```

### 数据存储结构

**配置数据** (`userData/settings.json`):
```json
{
  "theme": "modern",
  "isDark": false,
  "primaryColor": "#6366f1",
  "fontColor": "#374151",
  "neuTone": "gray",
  "glassBg": {
    "type": "gradient",
    "value": 0,
    "color1": "#667eea",
    "position1": 0,
    "color2": "#764ba2",
    "position2": 100,
    "image": "",
    "blur": 0
  },
  "dataPath": "系统 AppData/PromptHub",
  "categories": [
    { "id": "all", "name": "全部" },
    { "id": "cat_portrait", "name": "人像摄影" },
    { "id": "cat_game", "name": "游戏原画" },
    { "id": "cat_ui", "name": "UI界面" },
    { "id": "cat_logo", "name": "Logo设计" },
    { "id": "cat_3d", "name": "3D渲染" }
  ]
}
```

**提示词数据** (`PromptHubData/js/{id}.json`):
```json
{
  "id": "uuid",
  "title": "提示词标题",
  "categoryId": "cat_portrait",
  "description": "描述信息",
  "prompt": "提示词内容",
  "image": "image/{id}.png",
  "thumbnail": "image-400/{id}_thumb.png",
  "createdAt": 1234567890
}
```

**回收站数据**:
- 回收站中的提示词使用 `categoryId: 'trash'` 标识
- 还原时将 `categoryId` 改为 `'all'` 或其他分类
- 彻底删除时调用 `deletePrompt` 删除 JSON 文件和图片

**图片存储**:
- 原图: `PromptHubData/image/{id}.png`
- 缩略图: `PromptHubData/image-400/{id}_thumb.png` (400px 宽)

**数据目录结构**:
```
PromptHubData/
├── js/                    # 提示词 JSON 数据
├── image/                 # 原始图片
├── image-400/             # 缩略图（400px 宽）
├── Theme-img/             # 主题背景图片
├── classification.json    # 分类配置
└── Theme.json             # 主题配置
```

### 开发服务器配置

开发服务器配置在 `electron.vite.config.ts` 中：
- Host: `127.0.0.1`
- Port: `5173`

### 构建配置

**electron-builder 配置** (`electron-builder.yml`):
- App ID: `com.electron.app`
- Product Name: `PromptHub`
- 支持平台: Windows, macOS, Linux
- Windows: 
  - NSIS 安装程序，创建桌面快捷方式
  - Portable 版本（免安装）
  - 可自定义安装目录
- macOS: 包含权限声明（相机、麦克风、文档、下载文件夹）
- Linux: 支持 AppImage, Snap, Deb 格式
- 自动更新: Generic provider，URL: https://example.com/auto-updates
- Electron 镜像: 使用 npmmirror.com 镜像加速下载

**图标资源**:
- `build/icon.png`: 通用图标
- `build/icon.ico`: Windows 图标
- `build/icon.icns`: macOS 图标

### ESLint 配置

ESLint 配置在 `eslint.config.mjs` 中：
- 使用 @electron-toolkit/eslint-config-ts 推荐配置
- 使用 eslint-plugin-vue 的 flat/recommended 配置
- Vue 文件使用 vue-eslint-parser 解析
- 自定义规则:
  - `vue/require-default-prop`: off（Props 不需要默认值）
  - `vue/multi-word-component-names`: off（允许单词组件名）
  - `vue/block-lang`: 强制 `<script>` 使用 `lang="ts"`

### TypeScript 配置

项目使用项目引用（Project References）：
- `tsconfig.json`: 根配置，引用 node 和 web 配置
- `tsconfig.node.json`: Node.js 代码配置（主进程）
- `tsconfig.web.json`: Web/Vue 代码配置（渲染进程）

### PostCSS 配置

PostCSS 配置在 `postcss.config.js` 中：
- 使用 tailwindcss 插件
- 使用 autoprefixer 插件自动添加浏览器前缀

### 注意事项

1. **进程分离**: 主进程代码在 `src/main/` 目录，渲染进程代码在 `src/renderer/` 目录，预加载脚本在 `src/preload/` 目录
2. **IPC 安全**: 所有 IPC 通信需要通过预加载脚本 (`src/preload/`) 进行安全隔离，不能直接在渲染进程中使用 ipcRenderer
3. **主题变量**: 修改主题变量时，需同时更新 `main.css` 中的 CSS 变量和 Tailwind 配置
4. **硬件加速**: 开发时禁用了硬件加速（`app.disableHardwareAcceleration()`），如需启用请在 `src/main/index.ts` 中注释掉该行
5. **类型安全**: 使用 `@ts-ignore` 注释来忽略 window 对象的类型检查，因为 API 是在运行时通过 contextBridge 注入的
6. **样式导入**: 确保 `main.ts` 中导入了 `./assets/main.css`，否则 Tailwind 和主题样式不会生效
7. **Vue 组件**: 所有 Vue 组件必须使用 `<script setup lang="ts">` 语法
8. **路径别名**: 在渲染进程中使用 `@renderer/` 别名引用文件，避免相对路径
9. **毛玻璃主题**: 毛玻璃主题下的弹窗（设置、编辑器、删除确认）使用 `.glass-modal` 类，背景透明度为 30%，避免使用 `bg-surface` Tailwind 类
10. **图片路径**: 图片路径使用相对路径存储（相对于 PromptHubData），加载时转换为 file:// URL
11. **托盘功能**: 关闭窗口时隐藏到托盘而非退出应用，需要通过托盘菜单的"退出"选项完全关闭应用
12. **回收站**: 删除提示词时移至回收站（categoryId='trash'），需要彻底删除时再次删除
13. **数据迁移**: 
    - 配置支持自动迁移（categories 从字符串数组转换为对象数组）
    - 提示词数据支持自动迁移（category 字段转换为 categoryId）
14. **CSP 策略**: 已修改 CSP 策略允许 file:// 协议加载图片
15. **字体颜色**: 字体颜色通过 CSS 变量 `--text-main` 控制，可在主题设置中自定义
16. **单实例锁定**: 应用使用单实例锁定，防止同时运行多个实例
17. **图片压缩**: 超过 4K 分辨率的图片会自动压缩为 JPEG 格式（95% 质量）
18. **数据导出/导入**: 支持将所有提示词数据导出为 ZIP 包，或从 ZIP 包导入数据

## 调试

### 开发模式调试

- 在开发模式下，按 `F12` 打开 DevTools
- 主进程日志在终端中显示
- 渲染进程日志在 DevTools Console 中显示
- 使用 `console.log()` 在相应进程中输出调试信息

### 常见问题

1. **白屏问题**: 检查开发服务器是否正常运行在 `127.0.0.1:5173`
2. **样式不生效**: 确认 `main.ts` 中导入了 `./assets/main.css`
3. **窗口控制不工作**: 检查预加载脚本是否正确暴露了 `windowControls` API
4. **主题切换无效**: 确认 CSS 变量在 `main.css` 中正确定义
5. **TypeScript 错误**: 运行 `npm run typecheck` 检查类型错误
6. **图片无法加载**: 检查 CSP 策略是否允许 `file://` 协议，确认 `webSecurity: false`
7. **毛玻璃主题不透明**: 确认弹窗容器没有使用 `bg-surface` 类，使用 `.glass-modal` 类控制背景
8. **回收站功能不工作**: 检查 `loadPrompts` 是否正确过滤回收站项（categoryId='trash'）
9. **复制卡片失败**: 确认 `tempImagePath` 传递的是 file:// URL 或相对路径
10. **字体颜色不生效**: 检查 CSS 变量 `--text-main` 是否正确设置
11. **数据迁移失败**: 检查新旧路径是否正确，确保有足够的磁盘空间
12. **导出/导入失败**: 检查目标路径是否有写入权限，ZIP 文件是否完整

### 性能优化

- 开发时禁用硬件加速以避免渲染问题
- 生产环境可以启用硬件加速以提升性能
- 使用 CSS columns 实现瀑布流布局，性能优于 JavaScript 实现
- 使用 CSS 变量实现主题切换，避免重复样式定义
- 图片自动生成缩略图（400px 宽），减少内存占用和加载时间
- 超过 4K 分辨率的图片会自动压缩，减少存储空间
- 自定义滚动条组件，隐藏原生滚动条，提升视觉体验
- 回收站功能避免误删除，提供数据安全保障
- 单实例锁定避免资源浪费
- 使用 archiver 和 adm-zip 进行高效的数据压缩和解压