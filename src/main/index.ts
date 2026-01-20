import { app, shell, BrowserWindow, ipcMain, dialog, nativeImage, Tray, Menu } from 'electron'
import { join } from 'path'
import { readdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { randomUUID } from 'crypto' // 用于生成唯一ID
import icon from '../../resources/icon.png?asset'
import { ConfigManager } from './config'

// 单实例锁定
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // 当运行第二个实例时，聚焦到主窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
const configManager = new ConfigManager()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1100,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#f3f4f6',
    roundedCorners: true,
    icon: icon, // 为 Windows 添加图标
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.webContents.send('init-config', configManager.data)
    
    // 窗口准备好后，注册托盘菜单命令监听
    mainWindow?.webContents.send('tray-ready')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.prompthub')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 修改 CSP 策略，允许 file:// 协议加载图片
  const { session } = require('electron')
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: file:; img-src 'self' data: blob: file: *;"]
      }
    })
  })

  createWindow()
  createTray()

  // --- 窗口控制 ---
  ipcMain.handle('window-min', () => mainWindow?.minimize())
  ipcMain.handle('window-max', () => {
    if (mainWindow?.isMaximized()) mainWindow?.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window-close', () => {
    // 关闭窗口时隐藏到托盘，而不是退出应用
    mainWindow?.hide()
  })

  // --- 配置管理 ---
  ipcMain.handle('config:save', (_, data) => configManager.save(data))
  ipcMain.handle('dialog:selectDataPath', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory']
    })
    return canceled ? null : filePaths[0]
  })
  
  // 更换数据路径
  ipcMain.handle('data:changePath', (_, newPath) => {
    return configManager.changeDataPath(newPath)
  })
  
  // 迁移提示词数据
  ipcMain.handle('data:migratePrompts', (_, oldPath) => {
    return configManager.migratePromptsDataFrom(oldPath)
  })
  
  // 导出数据
  ipcMain.handle('data:export', async (_, exportPath) => {
    return await configManager.exportData(exportPath)
  })
  
  // 导入数据
  ipcMain.handle('data:import', async (_, zipPath) => {
    return await configManager.importData(zipPath)
  })
  
  // 选择导出位置
  ipcMain.handle('dialog:selectExportPath', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
      title: '选择导出位置'
    })
    return canceled ? null : filePaths[0]
  })
  
  // 选择导入文件
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
  ipcMain.handle('dialog:openDirectory', async () => { /* 保留旧接口，可选 */ })
  ipcMain.handle('file:open', (_, path) => shell.openPath(path)) // 打开文件
  ipcMain.handle('file:getAbsolutePath', (_, relativeOrBlobPath) => {
    // 如果是 blob URL，无法获取绝对路径
    if (relativeOrBlobPath.startsWith('blob:')) {
      return null
    }
    // 如果已经是绝对路径，直接返回
    if (relativeOrBlobPath.includes(':') || relativeOrBlobPath.startsWith('/')) {
      return relativeOrBlobPath
    }
    // 否则返回原值（相对路径）
    return relativeOrBlobPath
  })
  ipcMain.handle('dialog:selectBgImage', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
      ]
    })
    if (canceled || !filePaths[0]) return null
    return pathToFileURL(filePaths[0]).href
  })

  // --- 🟢 核心功能：复制图片到剪贴板 ---
  ipcMain.handle('image:copy', async (_, imagePath: string) => {
    try {
      const { clipboard, nativeImage } = require('electron')
      
      // 去除 file:// 协议头
      const cleanPath = imagePath.replace('file:///', '')
      
      // 读取图片文件
      const imageBuffer = readFileSync(cleanPath)
      
      // 创建图片并复制到剪贴板
      const image = nativeImage.createFromBuffer(imageBuffer)
      clipboard.writeImage(image)
      
      return { success: true }
    } catch (error) {
      console.error('复制图片失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // --- 🟢 核心功能：加载所有提示词卡片 ---
  ipcMain.handle('data:loadPrompts', () => {
    try {
      const promptHubDataPath = configManager.getPromptHubDataFullPath()
      const jsDir = configManager.getJsPath()

      // 确保目录存在
      configManager.initDataDir(configManager.data.dataPath)

      if (!existsSync(jsDir)) return []

      const files = readdirSync(jsDir).filter(f => f.endsWith('.json'))
      
      const prompts = files.map(file => {
        try {
          const content = readFileSync(join(jsDir, file), 'utf-8')
          const data = JSON.parse(content)

          // 数据迁移：将旧的category字段转换为categoryId
          if (data.category && !data.categoryId) {
            const categoryObj = configManager.data.categories.find((c: any) => c.name === data.category)
            if (categoryObj) {
              data.categoryId = categoryObj.id
            } else {
              data.categoryId = 'all'
            }
            delete data.category
          }

          // 转换相对路径为 file:// URL
          if (data.thumbnail) {
            let absThumbPath = data.thumbnail
            // 如果是相对路径，转换为绝对路径
            if (!data.thumbnail.startsWith('file:///') && !data.thumbnail.includes(':')) {
              absThumbPath = join(promptHubDataPath, data.thumbnail)
            } else if (data.thumbnail.startsWith('file:///')) {
              absThumbPath = data.thumbnail.replace('file:///', '')
            }

            if (existsSync(absThumbPath)) {
              data.thumbnail = pathToFileURL(absThumbPath).href
            } else {
              data.thumbnail = ''
            }
          }

          if (data.image) {
            let absImagePath = data.image
            if (!data.image.startsWith('file:///') && !data.image.includes(':')) {
              absImagePath = join(promptHubDataPath, data.image)
            } else if (data.image.startsWith('file:///')) {
              absImagePath = data.image.replace('file:///', '')
            }

            if (existsSync(absImagePath)) {
              data.image = pathToFileURL(absImagePath).href
            } else {
              data.image = ''
            }
          }

          // 如果缩略图不存在但原图存在，用原图代替缩略图
          if (!data.thumbnail && data.image) {
            data.thumbnail = data.image
          }

          return data
        } catch (e) {
          return null
        }
      }).filter(Boolean)

      // 按创建时间倒序
      return prompts.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
    } catch (e) {
      console.error(e)
      return []
    }
  })

  // --- 🟢 核心功能：保存/更新提示词 ---
  ipcMain.handle('prompt:save', async (_, { id, title, categoryId, description, prompt, tempImagePath, removeImage }) => {
    try {
      const promptHubDataPath = configManager.getPromptHubDataFullPath()
      const imgDir = configManager.getImagePath()
      const img400Dir = configManager.getImage400Path()
      const jsDir = configManager.getJsPath()
      
      configManager.initDataDir(configManager.data.dataPath)

      // 1. 生成或使用现有 ID
      const promptId = id || randomUUID()
      const jsonPath = join(jsDir, `${promptId}.json`)
      
      let finalImagePath = ''
      let finalThumbPath = ''

      // 2. 处理图片
      const ext = '.png' // 统一存为 PNG 方便处理
      const fileName = `${promptId}${ext}`
      const thumbName = `${promptId}_thumb${ext}`

      // 如果是编辑模式且需要移除图片，先删除旧图片
      if (id && existsSync(jsonPath) && removeImage) {
        try {
          const oldData = JSON.parse(readFileSync(jsonPath, 'utf-8'))
          
          // 删除旧原图
          if (oldData.image) {
            let oldImgPath = oldData.image.startsWith('image/')
              ? join(promptHubDataPath, oldData.image)
              : oldData.image.replace('file:///', '')
            
            if (existsSync(oldImgPath)) {
              unlinkSync(oldImgPath)
            }
          }
          
          // 删除旧缩略图
          if (oldData.thumbnail) {
            let oldThumbPath = oldData.thumbnail.startsWith('image-400/')
              ? join(promptHubDataPath, oldData.thumbnail)
              : oldData.thumbnail.replace('file:///', '')
            
            if (existsSync(oldThumbPath)) {
              unlinkSync(oldThumbPath)
            }
          }
        } catch (e) {
          console.error('[保存] 删除旧图片失败:', e)
        }
      }

      // 如果有新图片传入
      let imageBuffer: Buffer | undefined
      if (tempImagePath) {
        // 检查是否是 file:// 路径（用于复制功能）
        if (tempImagePath.startsWith('file://')) {
          const cleanPath = tempImagePath.replace('file:///', '')
          const absPath = cleanPath.includes(':') ? cleanPath : join(promptHubDataPath, cleanPath)
          imageBuffer = readFileSync(absPath)
        } else {
          // 统一处理 base64 数据
          try {
            const nativeImg = nativeImage.createFromDataURL(tempImagePath)
            imageBuffer = nativeImg.toPNG()
            
            if (imageBuffer.length === 0) {
              const matches = tempImagePath.match(/^data:image\/(\w+);base64,(.+)$/)
              if (!matches) {
                throw new Error('无效的 base64 格式')
              }
              const base64Data = matches[2]
              imageBuffer = Buffer.from(base64Data, 'base64')
            }
          } catch (e) {
            return { success: false, error: 'base64 转换失败: ' + String(e) }
          }
        }
      }

      if (imageBuffer && imageBuffer.length > 0) {
        finalImagePath = join(imgDir, fileName)
        finalThumbPath = join(img400Dir, thumbName)

        // 处理图片：检查是否超过4K，如果超过则压缩
        const image = nativeImage.createFromBuffer(imageBuffer)
        const size = image.getSize()
        const MAX_WIDTH = 3840 // 4K 宽度
        const MAX_HEIGHT = 2160 // 4K 高度
        const JPEG_QUALITY = 95 // 95% 质量

        let finalImageBuffer = imageBuffer

        // 如果图片超过4K分辨率，进行压缩
        if (size.width > MAX_WIDTH || size.height > MAX_HEIGHT) {
          console.log('[保存] 图片超过4K，进行压缩，原始尺寸:', size.width, 'x', size.height)
          
          // 计算缩放比例
          const scale = Math.min(MAX_WIDTH / size.width, MAX_HEIGHT / size.height)
          const newWidth = Math.round(size.width * scale)
          const newHeight = Math.round(size.height * scale)
          
          // 调整大小
          const resizedImage = image.resize({
            width: newWidth,
            height: newHeight,
            quality: 'best'
          })
          
          // 转换为 JPEG 格式（95%质量）
          finalImageBuffer = resizedImage.toJPEG(JPEG_QUALITY)
          console.log('[保存] 图片压缩完成，新尺寸:', newWidth, 'x', newHeight, '文件大小:', finalImageBuffer.length, 'bytes')
        }

        // 写入原图
        try {
          writeFileSync(finalImagePath, finalImageBuffer)
        } catch (e) {
          return { success: false, error: '原图写入失败: ' + String(e) }
        }

        // 生成缩略图 (400px宽)
        try {
          const thumbImage = nativeImage.createFromBuffer(finalImageBuffer)
          const thumbSize = thumbImage.getSize()
          const thumb = thumbImage.resize({ 
            width: 400, 
            height: Math.round(thumbSize.height * (400 / thumbSize.width)),
            quality: 'best'
          })
          const thumbBuffer = thumb.toJPEG(JPEG_QUALITY)
          writeFileSync(finalThumbPath, thumbBuffer)
        } catch (e) {
          return { success: false, error: '缩略图生成失败: ' + String(e) }
        }
      } else if (!removeImage) {
        // 如果不是移除图片，且没有新图片，保留旧图片
        if (existsSync(jsonPath)) {
          const oldData = JSON.parse(readFileSync(jsonPath, 'utf-8'))
          const oldImgPath = oldData.image
          const oldThumbPath = oldData.thumbnail

          if (oldImgPath) {
            if (oldImgPath.startsWith('file:///')) {
              finalImagePath = oldImgPath.replace('file:///', '')
            } else if (oldImgPath.startsWith('image/')) {
              finalImagePath = join(promptHubDataPath, oldImgPath)
            } else {
              finalImagePath = oldImgPath
            }
          }
          if (oldThumbPath) {
            if (oldThumbPath.startsWith('file:///')) {
              finalThumbPath = oldThumbPath.replace('file:///', '')
            } else if (oldThumbPath.startsWith('image-400/')) {
              finalThumbPath = join(promptHubDataPath, oldThumbPath)
            } else {
              finalThumbPath = oldThumbPath
            }
          }
        }
      }

      // 3. 保存 JSON - 使用相对路径（相对于 PromptHubData）
      let relativeImagePath = ''
      let relativeThumbPath = ''

      if (tempImagePath) {
        // 有新图片，使用新的文件名
        relativeImagePath = join('image', fileName)
        relativeThumbPath = join('image-400', thumbName)
      } else if (finalImagePath && finalThumbPath) {
        // 编辑模式且保留原图，将绝对路径转回相对路径
        const normalizedBasePath = promptHubDataPath.replace(/\\/g, '/')
        const normalizedImgPath = finalImagePath.replace(/\\/g, '/')
        const normalizedThumbPath = finalThumbPath.replace(/\\/g, '/')

        if (normalizedImgPath.startsWith(normalizedBasePath)) {
          relativeImagePath = normalizedImgPath.slice(normalizedBasePath.length + 1)
        } else if (finalImagePath.startsWith('image/')) {
          relativeImagePath = finalImagePath
        } else {
          relativeImagePath = finalImagePath
        }

        if (normalizedThumbPath.startsWith(normalizedBasePath)) {
          relativeThumbPath = normalizedThumbPath.slice(normalizedBasePath.length + 1)
        } else if (finalThumbPath.startsWith('image-400/')) {
          relativeThumbPath = finalThumbPath
        } else {
          relativeThumbPath = finalThumbPath
        }
      }

      const data = {
        id: promptId,
        title,
        categoryId,
        description,
        prompt,
        image: relativeImagePath,
        thumbnail: relativeThumbPath,
        createdAt: Date.now()
      }

      writeFileSync(jsonPath, JSON.stringify(data, null, 2))

      // 返回更新后的数据（包含图片路径），让前端能立即更新预览
      return {
        success: true,
        data: {
          id: promptId,
          title,
          categoryId,
          description,
          prompt,
          image: relativeImagePath ? pathToFileURL(join(promptHubDataPath, relativeImagePath)).href : '',
          thumbnail: relativeThumbPath ? pathToFileURL(join(promptHubDataPath, relativeThumbPath)).href : ''
        }
      }
    } catch (error) {
      console.error(error)
      return { success: false, error: String(error) }
    }
  })

  // --- 🟢 核心功能：删除提示词 ---
  ipcMain.handle('prompt:delete', (_, promptData) => {
    try {
      const promptHubDataPath = configManager.getPromptHubDataFullPath()
      const jsonPath = join(promptHubDataPath, 'js', `${promptData.id}.json`)

      // 处理图片路径（可能是相对路径或 file:// URL）
      let imgPath = ''
      let thumbPath = ''

      if (promptData.image && promptData.image !== '') {
        imgPath = promptData.image.replace('file:///', '')
        if (imgPath.startsWith('image/')) {
          imgPath = join(promptHubDataPath, imgPath)
        }
      }

      if (promptData.thumbnail && promptData.thumbnail !== '') {
        thumbPath = promptData.thumbnail.replace('file:///', '')
        if (thumbPath.startsWith('image-400/')) {
          thumbPath = join(promptHubDataPath, thumbPath)
        }
      }

      // 删除文件
      if (existsSync(jsonPath)) {
        unlinkSync(jsonPath)
      }
      
      if (imgPath && existsSync(imgPath)) {
        unlinkSync(imgPath)
      }
      
      if (thumbPath && existsSync(thumbPath)) {
        unlinkSync(thumbPath)
      }

      return true
    } catch (e) {
      console.error('[删除] 删除失败:', e)
      return false
    }
  })
})

// --- 托盘图标功能 ---
function createTray() {
  // 创建托盘图标
  const trayIcon = icon
  tray = new Tray(trayIcon)

  // 创建托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主界面',
      click: () => {
        showWindow()
      }
    },
    {
      label: '添加提示词',
      click: () => {
        showWindow()
        console.log('[托盘] 发送 open-add-prompt 消息')
        console.log('[托盘] 窗口可见:', mainWindow?.isVisible())
        console.log('[托盘] 窗口已加载:', mainWindow?.webContents.isLoading())
        // 延迟发送IPC消息，确保窗口已完全加载
        setTimeout(() => {
          console.log('[托盘] 准备发送 open-add-prompt 消息')
          mainWindow?.webContents.send('open-add-prompt')
          console.log('[托盘] open-add-prompt 消息已发送')
        }, 300)
      }
    },
    {
      label: '主题设置',
      click: () => {
        showWindow()
        console.log('[托盘] 发送 open-settings 消息')
        console.log('[托盘] 窗口可见:', mainWindow?.isVisible())
        console.log('[托盘] 窗口已加载:', mainWindow?.webContents.isLoading())
        // 延迟发送IPC消息，确保窗口已完全加载
        setTimeout(() => {
          console.log('[托盘] 准备发送 open-settings 消息')
          mainWindow?.webContents.send('open-settings')
          console.log('[托盘] open-settings 消息已发送')
        }, 300)
      }
    },
    {
      label: '分类管理',
      click: () => {
        showWindow()
        console.log('[托盘] 发送 open-category 消息')
        console.log('[托盘] 窗口可见:', mainWindow?.isVisible())
        console.log('[托盘] 窗口已加载:', mainWindow?.webContents.isLoading())
        // 延迟发送IPC消息，确保窗口已完全加载
        setTimeout(() => {
          console.log('[托盘] 准备发送 open-category 消息')
          mainWindow?.webContents.send('open-category')
          console.log('[托盘] open-category 消息已发送')
        }, 300)
      }
    },
    {
      label: '数据设置',
      click: () => {
        showWindow()
        console.log('[托盘] 发送 open-data 消息')
        console.log('[托盘] 窗口可见:', mainWindow?.isVisible())
        console.log('[托盘] 窗口已加载:', mainWindow?.webContents.isLoading())
        // 延迟发送IPC消息，确保窗口已完全加载
        setTimeout(() => {
          console.log('[托盘] 准备发送 open-data 消息')
          mainWindow?.webContents.send('open-data')
          console.log('[托盘] open-data 消息已发送')
        }, 300)
      }
    },
    {
      label: '关于',
      click: () => {
        showWindow()
        console.log('[托盘] 发送 open-about 消息')
        console.log('[托盘] 窗口可见:', mainWindow?.isVisible())
        console.log('[托盘] 窗口已加载:', mainWindow?.webContents.isLoading())
        // 延迟发送IPC消息，确保窗口已完全加载
        setTimeout(() => {
          console.log('[托盘] 准备发送 open-about 消息')
          mainWindow?.webContents.send('open-about')
          console.log('[托盘] open-about 消息已发送')
        }, 300)
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setToolTip('PromptHub - 提示词管理')
  tray.setContextMenu(contextMenu)

  // 单击托盘图标显示/隐藏窗口
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        showWindow()
      }
    }
  })
}

function showWindow() {
  if (mainWindow) {
    console.log('[主进程] showWindow 被调用')
    console.log('[主进程] 窗口当前状态 - 可见:', mainWindow.isVisible(), '最小化:', mainWindow.isMinimized())
    
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
      console.log('[主进程] 窗口已恢复')
    }
    
    if (!mainWindow.isVisible()) {
      mainWindow.show()
      console.log('[主进程] 窗口已显示')
    }
    
    mainWindow.focus()
    console.log('[主进程] 窗口已聚焦')
  }
}

app.on('window-all-closed', () => {
  // 不退出应用，保持托盘图标
  // if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  // 清理托盘图标
  if (tray) {
    tray.destroy()
    tray = null
  }
})

app.on('activate', () => {
  // macOS: 点击Dock图标时重新创建窗口
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  } else {
    showWindow()
  }
})