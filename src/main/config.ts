import { app } from 'electron'
import { join, basename, dirname } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, copyFileSync, createWriteStream } from 'fs'
import archiver from 'archiver'
import AdmZip from 'adm-zip'

// 默认主题配置
const defaultThemeConfig = {
  theme: 'modern',
  isDark: false,
  primaryColor: '#6366f1',
  fontColor: '#374151',
  neuTone: 'gray',
  glassBg: {
    type: 'gradient',
    value: 0,
    image: '',
    color1: '#667eea',
    position1: 0,
    color2: '#764ba2',
    position2: 100,
    blur: 0
  }
}

// 默认分类配置
const defaultCategories = [
  { id: 'all', name: '全部' },
  { id: 'cat_portrait', name: '人像摄影' },
  { id: 'cat_game', name: '游戏原画' },
  { id: 'cat_ui', name: 'UI界面' },
  { id: 'cat_logo', name: 'Logo设计' },
  { id: 'cat_3d', name: '3D渲染' }
]

// 默认配置
const defaultConfig = {
  theme: 'modern',
  isDark: false,
  primaryColor: '#6366f1',
  fontColor: '#374151',
  neuTone: 'gray',
  glassBg: { type: 'gradient', value: 0, image: '', customGradient: '', color1: '#667eea', color2: '#764ba2', position1: 0, position2: 100, blur: 0 },
  // 默认数据路径：系统 AppData/PromptHub
  dataPath: join(app.getPath('userData')),
  categories: defaultCategories
}

// 数据目录结构
const DATA_DIR_NAME = 'PromptHubData'
const SUB_DIRS = {
  JS: 'js',
  IMAGE: 'image',
  IMAGE_400: 'image-400',
  THEME_IMG: 'Theme-img'
}

const FILES = {
  CATEGORIES: 'categories.json', // 分类配置文件，存储在 PromptHubData 根目录
  THEME: 'Theme.json',
  BACKGROUND: 'background.jpg',
  DATAPATH: 'dataPath.json' // 数据路径配置文件
}

export class ConfigManager {
  private settingsPath: string
  private dataPathConfigPath: string // 数据路径配置文件路径
  public data: typeof defaultConfig

  constructor() {
    this.settingsPath = join(app.getPath('userData'), 'settings.json')
    this.dataPathConfigPath = join(app.getPath('userData'), FILES.DATAPATH)
    
    // 先读取数据路径配置
    const dataPath = this.loadDataPath()
    
    // 初始化配置
    this.data = this.load()
    
    // 使用独立的数据路径配置
    this.data.dataPath = dataPath
    
    this.initDataDir(this.data.dataPath)
  }

  // 读取数据路径配置（独立文件）
  loadDataPath(): string {
    try {
      if (existsSync(this.dataPathConfigPath)) {
        const saved = JSON.parse(readFileSync(this.dataPathConfigPath, 'utf-8'))
        if (saved.dataPath && existsSync(saved.dataPath)) {
          return saved.dataPath
        }
      }
    } catch (e) {
      console.error('加载数据路径配置失败', e)
    }
    // 默认路径
    return join(app.getPath('userData'))
  }

  // 保存数据路径配置（独立文件）
  saveDataPath(dataPath: string) {
    try {
      writeFileSync(this.dataPathConfigPath, JSON.stringify({ dataPath }, null, 2))
    } catch (e) {
      console.error('保存数据路径配置失败', e)
    }
  }

  // 获取 PromptHubData 根目录
  getPromptHubDataPath(userPath: string): string {
    // 检查路径最后一层是否为 PromptHubData
    const lastDir = basename(userPath)
    if (lastDir === DATA_DIR_NAME) {
      return userPath
    }
    // 如果不是，则添加 PromptHubData
    return join(userPath, DATA_DIR_NAME)
  }

  // 初始化数据目录结构
  initDataDir(basePath: string) {
    const promptHubDataPath = this.getPromptHubDataPath(basePath)
    
    // 创建所有子目录
    const dirs = [
      join(promptHubDataPath, SUB_DIRS.JS),
      join(promptHubDataPath, SUB_DIRS.IMAGE),
      join(promptHubDataPath, SUB_DIRS.IMAGE_400),
      join(promptHubDataPath, SUB_DIRS.THEME_IMG)
    ]

    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    })

    // 初始化主题配置文件
    const themePath = join(promptHubDataPath, FILES.THEME)
    if (!existsSync(themePath)) {
      writeFileSync(themePath, JSON.stringify(defaultThemeConfig, null, 2))
    }

    // 初始化分类配置文件（在 PromptHubData 根目录）
    const categoriesPath = join(promptHubDataPath, FILES.CATEGORIES)
    if (!existsSync(categoriesPath)) {
      writeFileSync(categoriesPath, JSON.stringify(defaultCategories, null, 2))
    }

    return promptHubDataPath
  }

  // 从文件加载分类配置
  loadCategories(): typeof defaultCategories {
    const promptHubDataPath = this.getPromptHubDataPath(this.data.dataPath)
    const categoriesPath = join(promptHubDataPath, FILES.CATEGORIES)

    if (existsSync(categoriesPath)) {
      try {
        const data = JSON.parse(readFileSync(categoriesPath, 'utf-8'))

        // 数据迁移：将旧的字符串数组categories转换为对象数组
        if (Array.isArray(data) && data.length > 0) {
          const firstCat = data[0]
          if (typeof firstCat === 'string') {
            // 旧格式：字符串数组，需要转换
            const migrated = data.map((name: string, idx: number) => ({
              id: name === '全部' ? 'all' : `cat_${Date.now()}_${idx}`,
              name: name
            }))
            // 保存迁移后的数据
            writeFileSync(categoriesPath, JSON.stringify(migrated, null, 2))
            console.log('[配置迁移] categories已从字符串数组转换为对象数组')
            return migrated
          }
        }
        return data
      } catch (e) {
        console.error('加载分类配置失败', e)
        return defaultCategories
      }
    }
    return defaultCategories
  }

  // 保存分类配置到文件
  saveCategories(categories: typeof defaultCategories) {
    const promptHubDataPath = this.getPromptHubDataPath(this.data.dataPath)
    const categoriesPath = join(promptHubDataPath, FILES.CATEGORIES)

    try {
      writeFileSync(categoriesPath, JSON.stringify(categories, null, 2))
    } catch (e) {
      console.error('保存分类配置失败', e)
    }
  }

  // 从文件加载主题配置
  loadThemeConfig(): typeof defaultThemeConfig {
    const promptHubDataPath = this.getPromptHubDataPath(this.data.dataPath)
    const themePath = join(promptHubDataPath, FILES.THEME)
    
    if (existsSync(themePath)) {
      try {
        const data = JSON.parse(readFileSync(themePath, 'utf-8'))
        return { ...defaultThemeConfig, ...data }
      } catch (e) {
        console.error('加载主题配置失败', e)
        return defaultThemeConfig
      }
    }
    return defaultThemeConfig
  }

  // 保存主题配置到文件
  saveThemeConfig(themeConfig: Partial<typeof defaultThemeConfig>) {
    const promptHubDataPath = this.getPromptHubDataPath(this.data.dataPath)
    const themePath = join(promptHubDataPath, FILES.THEME)
    
    try {
      const currentConfig = this.loadThemeConfig()
      const newConfig = { ...currentConfig, ...themeConfig }
      writeFileSync(themePath, JSON.stringify(newConfig, null, 2))
    } catch (e) {
      console.error('保存主题配置失败', e)
    }
  }

  // 获取主题背景图片路径
  getThemeBackgroundPath(): string | null {
    const promptHubDataPath = this.getPromptHubDataPath(this.data.dataPath)
    const backgroundPath = join(promptHubDataPath, SUB_DIRS.THEME_IMG, FILES.BACKGROUND)
    
    if (existsSync(backgroundPath)) {
      return backgroundPath
    }
    return null
  }

  // 保存主题背景图片
  saveThemeBackground(sourcePath: string) {
    const promptHubDataPath = this.getPromptHubDataPath(this.data.dataPath)
    const destPath = join(promptHubDataPath, SUB_DIRS.THEME_IMG, FILES.BACKGROUND)
    
    try {
      copyFileSync(sourcePath, destPath)
      // 更新主题配置
      this.saveThemeConfig({
        glassBg: { ...this.loadThemeConfig().glassBg, image: destPath }
      })
      return true
    } catch (e) {
      console.error('保存主题背景图片失败', e)
      return false
    }
  }

  // 加载配置
  load() {
    try {
      if (existsSync(this.settingsPath)) {
        const saved = JSON.parse(readFileSync(this.settingsPath, 'utf-8'))

        // 先临时设置 this.data 以便 loadCategories 和 loadThemeConfig 使用
        this.data = { ...defaultConfig, ...saved }

        // 从文件加载分类和主题配置
        const categories = this.loadCategories()
        const themeConfig = this.loadThemeConfig()

        return {
          ...this.data,
          ...themeConfig,
          categories
        }
      }
    } catch (e) {
      console.error('加载配置失败', e)
    }
    return defaultConfig
  }

  // 保存配置
  save(newData: any) {
    this.data = { ...this.data, ...newData }
    
    try {
      // 保存 settings.json
      writeFileSync(this.settingsPath, JSON.stringify(this.data, null, 2))
      
      // 保存分类配置到文件
      if (newData.categories) {
        this.saveCategories(newData.categories)
      }
      
      // 保存主题配置到文件
      const themeConfig = {
        theme: this.data.theme,
        isDark: this.data.isDark,
        primaryColor: this.data.primaryColor,
        fontColor: this.data.fontColor,
        neuTone: this.data.neuTone,
        glassBg: this.data.glassBg
      }
      this.saveThemeConfig(themeConfig)
    } catch (e) {
      console.error('保存配置失败', e)
    }
  }

  // 更换数据路径（自动检测和创建文件夹）
  changeDataPath(newPath: string) {
    const oldPath = this.data.dataPath
    const oldPromptHubDataPath = this.getPromptHubDataPath(oldPath)
    const newPromptHubDataPath = this.getPromptHubDataPath(newPath)

    if (oldPromptHubDataPath === newPromptHubDataPath) {
      return { success: false, message: '新旧路径相同' }
    }

    try {
      // 1. 检查新路径最后一层是否为 PromptHubData
      const lastDir = basename(newPath)
      const targetPath = lastDir === DATA_DIR_NAME ? newPath : join(newPath, DATA_DIR_NAME)

      // 2. 创建新的 PromptHubData 文件夹和子文件夹
      if (!existsSync(targetPath)) {
        mkdirSync(targetPath, { recursive: true })
      }

      // 创建子文件夹
      const dirs = [
        join(targetPath, SUB_DIRS.JS),
        join(targetPath, SUB_DIRS.IMAGE),
        join(targetPath, SUB_DIRS.IMAGE_400),
        join(targetPath, SUB_DIRS.THEME_IMG)
      ]
      dirs.forEach(dir => {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }
      })

      // 3. 复制分类配置文件（从 PromptHubData 根目录）
      const oldCategoriesPath = join(oldPromptHubDataPath, FILES.CATEGORIES)
      const newCategoriesPath = join(targetPath, FILES.CATEGORIES)
      if (existsSync(oldCategoriesPath)) {
        copyFileSync(oldCategoriesPath, newCategoriesPath)
      } else {
        writeFileSync(newCategoriesPath, JSON.stringify(defaultCategories, null, 2))
      }

      // 4. 复制主题配置文件
      const oldThemePath = join(oldPromptHubDataPath, FILES.THEME)
      const newThemePath = join(targetPath, FILES.THEME)
      if (existsSync(oldThemePath)) {
        copyFileSync(oldThemePath, newThemePath)
      } else {
        writeFileSync(newThemePath, JSON.stringify(defaultThemeConfig, null, 2))
      }

      // 5. 复制主题背景图片文件夹
      const oldThemeImgPath = join(oldPromptHubDataPath, SUB_DIRS.THEME_IMG)
      const newThemeImgPath = join(targetPath, SUB_DIRS.THEME_IMG)
      if (existsSync(oldThemeImgPath)) {
        cpSync(oldThemeImgPath, newThemeImgPath, { recursive: true })
      }

      // 6. 更新数据路径并保存到独立文件
      this.data.dataPath = targetPath
      this.saveDataPath(targetPath)

      return { 
        success: true, 
        oldPath: oldPromptHubDataPath,
        newPath: targetPath
      }
    } catch (error) {
      console.error('更换路径失败', error)
      return { success: false, message: String(error) }
    }
  }

  // 迁移提示词数据（带旧路径参数）
  migratePromptsDataFrom(oldPath: string) {
    const newPromptHubDataPath = this.getPromptHubDataPath(this.data.dataPath)

    if (oldPath === newPromptHubDataPath) {
      return { success: false, message: '新旧路径相同' }
    }

    try {
      // 1. 复制提示词数据
      const oldJsPath = join(oldPath, SUB_DIRS.JS)
      const newJsPath = join(newPromptHubDataPath, SUB_DIRS.JS)
      if (existsSync(oldJsPath)) {
        cpSync(oldJsPath, newJsPath, { recursive: true })
      }

      // 2. 复制原图
      const oldImagePath = join(oldPath, SUB_DIRS.IMAGE)
      const newImagePath = join(newPromptHubDataPath, SUB_DIRS.IMAGE)
      if (existsSync(oldImagePath)) {
        cpSync(oldImagePath, newImagePath, { recursive: true })
      }

      // 3. 复制缩略图
      const oldImage400Path = join(oldPath, SUB_DIRS.IMAGE_400)
      const newImage400Path = join(newPromptHubDataPath, SUB_DIRS.IMAGE_400)
      if (existsSync(oldImage400Path)) {
        cpSync(oldImage400Path, newImage400Path, { recursive: true })
      }

      return { success: true }
    } catch (error) {
      console.error('迁移提示词数据失败', error)
      return { success: false, message: String(error) }
    }
  }

  // 导出数据为 zip
  async exportData(exportPath: string) {
    const promptHubDataPath = this.getPromptHubDataPath(this.data.dataPath)
    
    if (!existsSync(promptHubDataPath)) {
      return { success: false, message: '数据目录不存在' }
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const zipFileName = `${DATA_DIR_NAME}-${timestamp}.zip`
      const zipFilePath = join(exportPath, zipFileName)

      const output = createWriteStream(zipFilePath)
      const archive = archiver('zip', {
        zlib: { level: 9 }
      })

      return new Promise((resolve) => {
        output.on('close', () => {
          resolve({ success: true, path: zipFilePath })
        })

        archive.on('error', (err) => {
          resolve({ success: false, message: String(err) })
        })

        archive.pipe(output)
        archive.directory(promptHubDataPath, DATA_DIR_NAME)
        archive.finalize()
      })
    } catch (error) {
      console.error('导出数据失败', error)
      return { success: false, message: String(error) }
    }
  }

  // 导入数据从 zip
  async importData(zipPath: string) {
    const promptHubDataPath = this.getPromptHubDataPath(this.data.dataPath)

    try {
      if (!existsSync(zipPath)) {
        return { success: false, message: '文件不存在' }
      }

      const zip = new AdmZip(zipPath)
      const entries = zip.getEntries()

      // 检查 zip 文件结构
      let hasPromptHubDataRoot = false
      for (const entry of entries) {
        const entryName = entry.entryName
        // 检查是否有 PromptHubData/ 开头的文件
        if (entryName.startsWith(DATA_DIR_NAME + '/') || entryName.startsWith(DATA_DIR_NAME + '\\')) {
          hasPromptHubDataRoot = true
          break
        }
      }

      // 解压到目标路径
      if (hasPromptHubDataRoot) {
        // zip 文件包含 PromptHubData 根目录，直接解压到父目录
        const parentDir = dirname(promptHubDataPath)
        zip.extractAllTo(parentDir, true)
      } else {
        // zip 文件不包含 PromptHubData 根目录，直接解压到 PromptHubData 目录
        zip.extractAllTo(promptHubDataPath, true)
      }

      // 重新加载配置
      this.data = this.load()

      return { success: true }
    } catch (error) {
      console.error('导入数据失败', error)
      return { success: false, message: String(error) }
    }
  }

  // 获取数据路径
  getDataPath() {
    return this.data.dataPath
  }

  // 获取 PromptHubData 完整路径
  getPromptHubDataFullPath() {
    return this.getPromptHubDataPath(this.data.dataPath)
  }

  // 获取子目录路径
  getJsPath() {
    return join(this.getPromptHubDataFullPath(), SUB_DIRS.JS)
  }

  getImagePath() {
    return join(this.getPromptHubDataFullPath(), SUB_DIRS.IMAGE)
  }

  getImage400Path() {
    return join(this.getPromptHubDataFullPath(), SUB_DIRS.IMAGE_400)
  }
}