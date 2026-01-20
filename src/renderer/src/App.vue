<script setup lang="ts">
import { ref, onMounted, computed, watch, reactive, nextTick } from 'vue'
import CustomScrollbar from '@renderer/components/CustomScrollbar.vue'
import Icons from '@renderer/components/Icons.vue'

// --- 全局状态 ---
const isMaximized = ref(false)
const showSettings = ref(false)
const showEditor = ref(false) // 🟢 控制添加/编辑弹窗
const settingsTab = ref('theme')
const activeCategory = ref('all')
const searchQuery = ref('')
const loading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const editorRef = ref<HTMLDivElement | null>(null)
const copiedPromptId = ref<string | null>(null)
const copiedImageId = ref<string | null>(null) // 图片复制提示

// --- 瀑布流布局 ---
const masonryContainerRef = ref<HTMLDivElement | null>(null)
const masonryColumns = ref(4) // 默认4列

// --- 配置数据 ---
const config = reactive({
  isDark: false,
  theme: 'modern',
  primaryColor: '#6366f1',
  neuTone: 'gray',
  glassBg: { type: 'gradient', value: 0, image: '', customGradient: '', blur: 0, color1: '#667eea', color2: '#764ba2', position1: 0, position2: 100 },
  fontColor: '#333333',
  dataPath: '',
  categories: [{ id: 'all', name: '全部' }]
})

// --- 提示词数据 ---
interface PromptData {
  id?: string
  title: string
  categoryId: string
  description: string
  prompt?: string
  image?: string     // 原始路径
  thumbnail?: string // 缩略图路径
  tempImage?: string // 仅用于编辑时预览新上传的图片
}

const promptList = ref<PromptData[]>([]) // 真实数据列表

// 编辑器表单数据
const form = reactive<PromptData>({
  id: '', title: '', categoryId: '', description: '', prompt: '', image: '', thumbnail: ''
})
const isEditMode = ref(false) // 是否为编辑模式
const removeImageFlag = ref(false) // 是否需要移除图片
const showDeleteConfirm = ref(false) // 是否显示删除确认窗口
const itemToDelete = ref<PromptData | null>(null) // 待删除的项

// 数据迁移确认
const showMigrateConfirm = ref(false) // 是否显示数据迁移确认窗口
const pendingNewPath = ref('') // 待迁移的新路径

// 分类删除确认
const showCategoryDeleteConfirm = ref(false) // 是否显示分类删除确认窗口
const categoryToDeleteIndex = ref<number | null>(null) // 待删除的分类索引

// 预设
const presetColors = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6', '#64748b', '#0ea5e9', '#84cc16']
const presetFontColors = ['#ffffff', '#000000', '#999999', '#1e3a8a', '#374151', '#6b7280', '#4b5563', '#1f2937', '#111827', '#f3f4f6', '#e5e7eb', '#d1d5db']
const gradients = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(to top, #cfd9df 0%, #e2ebf0 100%)',
  'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  'linear-gradient(to right, #43e97b 0%, #38f9d7 100%)'
]

// @ts-ignore
const win = window.windowControls

// --- 计算属性 ---
const appBgStyle = computed(() => {
  if (config.theme !== 'glass') return {}
  const bg = config.glassBg
  if (bg.type === 'image' && bg.image) {
    const style: any = {
      backgroundImage: `url('${bg.image}')`,
      backgroundSize: 'cover'
    }
    if (bg.blur > 0) {
      style.filter = `blur(${bg.blur}px)`
    }
    return style
  }
  if (bg.type === 'custom') {
    return { backgroundImage: `linear-gradient(135deg, ${bg.color1} ${bg.position1}%, ${bg.color2} ${bg.position2}%)` }
  }
  return { backgroundImage: gradients[bg.value] || gradients[0] }
})

const sidebarClass = computed(() => {
  if (config.theme === 'glass') return 'sidebar-glass'
  if (config.theme === 'neu') return 'sidebar-neu'
  return 'sidebar-modern'
})

// 过滤后的列表
const filteredList = computed(() => {
  return promptList.value.filter(item => {
    const matchCat = activeCategory.value === 'all' || item.categoryId === activeCategory.value
    const matchSearch = !searchQuery.value ||
      item.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (item.prompt && item.prompt.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
      item.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchCat && matchSearch
  })
})

// --- 初始化 ---
onMounted(() => {
  // 初始化瀑布流列数
  nextTick(() => {
    calculateMasonryColumns()
  })

  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    calculateMasonryColumns()
  })

  // 添加全局点击监听器，用于取消编辑状态
  const handleClickOutside = (e: MouseEvent) => {
    // 点击外部时，如果正在编辑分类，取消编辑
    if (editingCategory.value !== null) {
      const target = e.target as HTMLElement
      if (!target.closest('input')) {
        closeCategoryEditModal()
      }
    }
  }
  document.addEventListener('click', handleClickOutside)

  win.onInitConfig((savedConfig: any) => {
    Object.assign(config, savedConfig)

    // 数据迁移：确保categories是对象数组格式
    if (config.categories && Array.isArray(config.categories) && config.categories.length > 0) {
      const firstCat = config.categories[0]
      if (typeof firstCat === 'string') {
        // 旧格式：字符串数组，需要转换
        config.categories = config.categories.map((cat: any, idx: number) => ({
          id: cat === '全部' ? 'all' : `cat_${Date.now()}_${idx}`,
          name: cat
        }))
        console.log('[前端配置迁移] categories已从字符串数组转换为对象数组')
        // 保存迁移后的配置
        win.saveConfig(JSON.parse(JSON.stringify(config)))
      }
    }

    updateCSSVariables()
    loadData()
  })
  
  // 🟢 全局粘贴监听 (用于在主界面粘贴图片直接唤起添加?) 暂时只在弹窗内处理
  
  // 🟢 托盘菜单监听 - 直接注册，不等待tray-ready事件
  console.log('[渲染进程] 注册托盘菜单监听器')

  win.onOpenAddPrompt(() => {
    console.log('[渲染进程] 收到 open-add-prompt 消息')
    openAddModal()
  })

  win.onOpenSettings(() => {
    console.log('[渲染进程] 收到 open-settings 消息')
    console.log('[渲染进程] 当前 showSettings:', showSettings.value)
    console.log('[渲染进程] 当前 settingsTab:', settingsTab.value)
    showSettings.value = true
    settingsTab.value = 'theme'
    console.log('[渲染进程] 设置 showSettings 为 true, settingsTab 为 theme')
  })

  win.onOpenCategory(() => {
    console.log('[渲染进程] 收到 open-category 消息')
    console.log('[渲染进程] 当前 showSettings:', showSettings.value)
    console.log('[渲染进程] 当前 settingsTab:', settingsTab.value)
    showSettings.value = true
    settingsTab.value = 'category'
    console.log('[渲染进程] 设置 showSettings 为 true, settingsTab 为 category')
  })

  win.onOpenData(() => {
    console.log('[渲染进程] 收到 open-data 消息')
    console.log('[渲染进程] 当前 showSettings:', showSettings.value)
    console.log('[渲染进程] 当前 settingsTab:', settingsTab.value)
    showSettings.value = true
    settingsTab.value = 'data'
    console.log('[渲染进程] 设置 showSettings 为 true, settingsTab 为 data')
  })

  win.onOpenAbout(() => {
    console.log('[渲染进程] 收到 open-about 消息')
    console.log('[渲染进程] 当前 showSettings:', showSettings.value)
    console.log('[渲染进程] 当前 settingsTab:', settingsTab.value)
    showSettings.value = true
    settingsTab.value = 'about'
    console.log('[渲染进程] 设置 showSettings 为 true, settingsTab 为 about')
  })

  // 监听tray-ready事件，仅用于调试
  window.addEventListener('tray-ready', () => {
    console.log('[渲染进程] 收到 tray-ready 事件')
  })
})

watch(config, (newVal) => {
  updateCSSVariables()
  win.saveConfig(JSON.parse(JSON.stringify(newVal)))
}, { deep: true })

// --- 瀑布流列数计算 ---
const calculateMasonryColumns = () => {
  if (!masonryContainerRef.value) return

  const containerWidth = masonryContainerRef.value.clientWidth
  const availableWidth = containerWidth

  // 根据宽度范围确定列数
  if (availableWidth < 1240) {
    // 宽度 < 1240: 3列
    masonryColumns.value = 3
  } else if (availableWidth >= 1240 && availableWidth < 1550) {
    // 1240 <= 宽度 < 1550: 4列，拉伸填补空白
    masonryColumns.value = 4
  } else if (availableWidth >= 1550) {
    // 宽度 >= 1550: 5列
    masonryColumns.value = 5
  }
}

const updateCSSVariables = () => {
  const root = document.documentElement
  root.classList.toggle('dark', config.isDark)
  root.setAttribute('data-theme', config.theme)
  root.setAttribute('data-neu-tone', config.neuTone)
  if (config.theme !== 'neu') {
    root.style.setProperty('--primary', config.primaryColor)
    root.style.setProperty('--primary-hover', config.primaryColor) 
  }
}

// --- 🟢 核心：加载数据 ---
const loadData = async () => {
  loading.value = true
  const data = await win.loadPrompts()
  promptList.value = data || []
  loading.value = false
}

// --- 🟢 核心：表单操作 ---
const openAddModal = () => {
  isEditMode.value = false
  // 重置表单，使用当前激活的分类作为默认分类
  const defaultCategoryId = activeCategory.value
  Object.assign(form, { id: '', title: '', categoryId: defaultCategoryId, description: '', prompt: '', image: '', thumbnail: '', tempImage: '' })
  showEditor.value = true
  // 弹窗显示后自动设置焦点，使其能够响应键盘事件
  nextTick(() => {
    editorRef.value?.focus()
  })
}

const openEditModal = (item: PromptData) => {
  isEditMode.value = true
  Object.assign(form, JSON.parse(JSON.stringify(item))) // 深拷贝
  form.tempImage = '' // 清空临时图
  removeImageFlag.value = false // 重置移除标记
  showEditor.value = true
  // 弹窗显示后自动设置焦点，使其能够响应键盘事件
  nextTick(() => {
    editorRef.value?.focus()
  })
}

// 保存
const handleSave = async () => {
  // 移除标题必填验证，允许标题为空
  // if (!form.title) return alert('请输入标题')

  console.log('[前端保存] 开始保存')
  console.log('[前端保存] form.tempImage:', form.tempImage ? form.tempImage.substring(0, 50) : 'null')
  console.log('[前端保存] form.image:', form.image)
  console.log('[前端保存] form.thumbnail:', form.thumbnail)

  const payload = {
    id: form.id,
    title: form.title,
    categoryId: form.categoryId,
    description: form.description,
    prompt: form.prompt,
    // 统一使用 base64（文件选择、拖拽、粘贴都转为 base64）
    tempImagePath: form.tempImage || '',
    // 是否需要移除图片
    removeImage: removeImageFlag.value
  }

  console.log('[前端保存] payload.tempImagePath:', payload.tempImagePath ? payload.tempImagePath.substring(0, 50) : 'null')
  console.log('[前端保存] payload.removeImage:', payload.removeImage)

  console.log('[前端保存] 准备调用 win.savePrompt')
  const res = await win.savePrompt(payload)
  console.log('[前端保存] win.savePrompt 返回结果:', res)

  if (res.success) {
    // 区分编辑模式和新增模式，避免数据覆盖BUG
    if (res.data) {
      if (isEditMode.value) {
        // 编辑模式：更新现有项
        const idx = promptList.value.findIndex(p => p.id === res.data.id)
        if (idx !== -1) {
          promptList.value[idx] = { ...promptList.value[idx], ...res.data }
        }
      } else {
        // 新增模式：直接添加到列表开头
        promptList.value.unshift(res.data)
      }
    }
    showEditor.value = false
    // 重新刷新列表以确保数据一致性
    loadData()
  } else {
    alert('保存失败: ' + res.error)
  }
}

// 删除
const handleDelete = (item: PromptData) => {
  itemToDelete.value = item
  showDeleteConfirm.value = true
}

// 确认删除
const confirmDelete = async () => {
  if (!itemToDelete.value) return
  
  const item = itemToDelete.value
  // 只传递必要的属性，避免克隆错误
  const deleteData = {
      id: item.id,
      image: item.image,
      thumbnail: item.thumbnail
    }
    const success = await win.deletePrompt(deleteData)
    if (success) loadData()
    else alert('删除失败')
  
  showDeleteConfirm.value = false
  itemToDelete.value = null
}

// 取消删除
const cancelDelete = () => {
  showDeleteConfirm.value = false
  itemToDelete.value = null
}

// 复制提示词
const copyPrompt = (text: string | undefined, itemId: string | undefined) => {
  if (!text) return
  navigator.clipboard.writeText(text)
  copiedPromptId.value = itemId || ''
  setTimeout(() => {
    copiedPromptId.value = null
  }, 1000)
}

// 查看原图（单击按钮）
const viewOriginal = (path: string | undefined) => {
  if (!path) return
  const cleanPath = path.replace(/^file:\/\/\//, '') // 去除 file:/// 协议头以便 shell 打开
  win.openFile(decodeURIComponent(cleanPath))
}

// 复制原图到剪贴板（双击预览图）
const copyOriginalImage = async (path: string | undefined) => {
  if (!path) return

  try {
    const result = await win.copyImage(path)
    if (result.success) {
      copiedImageId.value = Date.now().toString()
      setTimeout(() => {
        copiedImageId.value = null
      }, 2000)
    } else {
      alert('复制图片失败：' + result.error)
    }
  } catch (error) {
    alert('复制图片失败：' + String(error))
  }
}

// --- 🟢 图片处理 (拖拽/粘贴/选择) ---
const handleFileSelect = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    processFile(file)
    // 重置 input 值，确保可以重复选择同一个文件
    ;(e.target as HTMLInputElement).value = ''
  }
}

const handleDrop = (e: DragEvent) => {
  const file = e.dataTransfer?.files[0]
  if (file && file.type.startsWith('image/')) processFile(file)
}

const handlePaste = (e: ClipboardEvent) => {
  // 检查焦点是否在文本输入框中（input 或 textarea）
  const activeElement = document.activeElement
  const isTextInput = activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA'
  )

  // 如果焦点在文本输入框中，不处理图片粘贴（让浏览器处理文本粘贴）
  if (isTextInput) {
    return
  }

  // 否则，检查剪贴板中是否有图片
  const items = e.clipboardData?.items
  if (items) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          e.preventDefault() // 阻止默认粘贴行为
          processFile(file)
        }
        break
      }
    }
  }
}

const processFile = (file: File) => {
  console.log('[前端processFile] 开始处理文件')
  console.log('[前端processFile] file.name:', file.name)
  console.log('[前端processFile] file.size:', file.size)
  console.log('[前端processFile] file.type:', file.type)

  // 生成预览 URL（用于显示）
  const previewUrl = URL.createObjectURL(file)
  console.log('[前端processFile] previewUrl:', previewUrl)

  // 清空旧的 tempImagePath，避免混淆
  delete (form as any).tempImagePath

  // 统一使用 base64 处理所有图片（文件选择、拖拽、粘贴）
  // 这样可以避免依赖 file.path 属性
  console.log('[前端processFile] 转换为 base64')
  const reader = new FileReader()
  reader.onload = (e) => {
    form.tempImage = e.target?.result as string // base64 用于显示和保存
    console.log('[前端processFile] base64转换完成, 长度:', form.tempImage?.length)
  }
  reader.onerror = (e) => {
    console.error('[前端processFile] base64转换失败:', e)
    alert('图片读取失败，请重试')
  }
  reader.readAsDataURL(file)
}

const removeImage = () => {
  form.image = ''
  form.tempImage = ''
  form.thumbnail = ''
  removeImageFlag.value = true // 标记需要移除图片
}

// --- 辅助功能 ---
const handleDataPathChange = async () => {
  const newPath = await win.selectDataPath()
  if (!newPath || newPath === config.dataPath) return

  // 先更改路径
  const result = await win.changeDataPath(newPath)
  
  if (result.success) {
    config.dataPath = result.newPath
    pendingNewPath.value = result.newPath
    // 显示迁移确认弹窗
    showMigrateConfirm.value = true
  } else {
    alert('更改路径失败：' + result.message)
  }
}

// 确认数据迁移
const confirmMigrate = async () => {
  showMigrateConfirm.value = false
  
  // 迁移数据
  const migrateResult = await win.migratePrompts(config.dataPath)
  if (migrateResult.success) {
    alert('数据迁移成功！')
    loadData()
  } else {
    alert('数据迁移失败：' + migrateResult.message)
  }
}

// 取消数据迁移
const cancelMigrate = () => {
  showMigrateConfirm.value = false
  // 不迁移数据，只重新加载
  loadData()
}

// 导出数据
const handleExportData = async () => {
  const exportPath = await win.selectExportPath()
  if (!exportPath) return

  try {
    const result = await win.exportData(exportPath)
    if (result.success) {
      alert(`导出成功！\n文件路径：${result.path}`)
    } else {
      alert(`导出失败：${result.message}`)
    }
  } catch (error) {
    alert(`导出失败：${String(error)}`)
  }
}

// 导入数据
const handleImportData = async () => {
  const zipPath = await win.selectImportFile()
  if (!zipPath) return

  if (!confirm('导入数据将覆盖现有数据，确定继续吗？')) {
    return
  }

  try {
    const result = await win.importData(zipPath)
    if (result.success) {
      alert('导入成功！')
      // 重新加载配置和数据
      loadData()
    } else {
      alert(`导入失败：${result.message}`)
    }
  } catch (error) {
    alert(`导入失败：${String(error)}`)
  }
}

// 其他设置逻辑...
const newCategoryName = ref('')
const editingCategory = ref<number | null>(null)
const editingCategoryName = ref('')
const showCategoryEditModal = ref(false) // 分类编辑弹窗
const editingCategoryIndex = ref<number | null>(null) // 正在编辑的分类索引
const editingCategoryTempName = ref('') // 临时编辑名称

const addCategory = () => {
  if (newCategoryName.value && !config.categories.some(c => c.name === newCategoryName.value)) {
    config.categories.push({
      id: 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: newCategoryName.value
    })
    newCategoryName.value = ''
  }
}
const removeCategory = (idx: number) => {
  categoryToDeleteIndex.value = idx
  showCategoryDeleteConfirm.value = true
}

// 确认删除分类
const confirmDeleteCategory = () => {
  if (categoryToDeleteIndex.value !== null) {
    config.categories.splice(categoryToDeleteIndex.value, 1)
  }
  showCategoryDeleteConfirm.value = false
  categoryToDeleteIndex.value = null
}

// 取消删除分类
const cancelDeleteCategory = () => {
  showCategoryDeleteConfirm.value = false
  categoryToDeleteIndex.value = null
}

const startEditCategory = (idx: number, name: string) => {
  console.log('[分类编辑] 打开编辑弹窗', { idx, name })
  editingCategoryIndex.value = idx
  editingCategoryTempName.value = name
  showCategoryEditModal.value = true
}

const closeCategoryEditModal = () => {
  showCategoryEditModal.value = false
  editingCategoryIndex.value = null
  editingCategoryTempName.value = ''
}

const saveCategoryEdit = () => {
  if (editingCategoryIndex.value === null) return
  
  const idx = editingCategoryIndex.value
  const newName = editingCategoryTempName.value.trim()
  
  if (newName && newName !== config.categories[idx].name) {
    config.categories[idx].name = newName
  }
  
  closeCategoryEditModal()
}

const cancelEditCategory = () => {
  editingCategory.value = null
  editingCategoryName.value = ''
}

const draggedIndex = ref<number | null>(null) // 拖拽的索引

const handleDragStart = (idx: number) => {
  // 如果正在编辑，先取消编辑
  if (editingCategory.value !== null) {
    cancelEditCategory()
  }
  draggedIndex.value = idx
}

const handleCategoryDrop = (targetIdx: number) => {
  if (draggedIndex.value === null || draggedIndex.value === targetIdx) {
    draggedIndex.value = null
    return
  }

  // 使用数组解构来避免响应式问题
  const newCategories = [...config.categories]
  const draggedItem = newCategories[draggedIndex.value]
  newCategories.splice(draggedIndex.value, 1)
  newCategories.splice(targetIdx, 0, draggedItem)

  // 一次性更新整个数组
  config.categories = newCategories

  draggedIndex.value = null
}

// 选择背景图片
const selectBgImage = async () => {
  const imagePath = await win.selectBgImage()
  if (imagePath) {
    config.glassBg.image = imagePath
  }
}

const toggleMaximize = async () => {
  await win?.toggleMaximize()
  isMaximized.value = !isMaximized.value
}
</script>

<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden text-sm relative">
    <!-- 背景层 -->
    <div 
      v-if="config.theme === 'glass'" 
      class="absolute inset-0 -z-10 bg-cover bg-center transition-all duration-500"
      :style="appBgStyle"
    ></div>
    <div v-if="config.theme === 'glass' && config.isDark" class="absolute inset-0 bg-black/50 pointer-events-none z-0"></div>

    <header class="drag-region relative z-40 flex h-14 shrink-0 items-center justify-between px-5">
      <div v-if="config.theme === 'modern'" class="absolute inset-0 bg-bg/90 backdrop-blur border-b border-[var(--border)] -z-10"></div>
      <div v-if="config.theme === 'glass'" class="absolute inset-0 bg-white/10 backdrop-blur-md border-b border-[var(--border)] -z-10"></div>
      <div class="flex items-center gap-2 text-lg font-bold tracking-wide opacity-90 text-txt">
        <img src="@renderer/assets/PromptHub.png" class="w-6 h-6" alt="PromptHub" /> <span class="text-primary">PromptHub</span>
      </div>
      <div class="no-drag flex items-center gap-3">
        <button @click="showSettings = true" class="btn-ghost flex h-8 w-8 items-center justify-center rounded-lg border border-transparent hover:border-gray-200/30 dark:hover:border-gray-600/30" :style="{ color: config.fontColor }">
          <Icons name="settings" />
        </button>
        <div class="mx-2 h-4 w-px bg-gray-400/30 dark:bg-white/20"></div>
        <button @click="win?.minimize()" class="btn-ghost flex h-8 w-8 items-center justify-center rounded-lg border border-transparent hover:border-gray-200/30 dark:hover:border-gray-600/30" :style="{ color: config.fontColor }">
          <Icons name="minimize" />
        </button>
        <button @click="toggleMaximize" class="btn-ghost flex h-8 w-8 items-center justify-center rounded-lg border border-transparent hover:border-gray-200/30 dark:hover:border-gray-600/30" :style="{ color: config.fontColor }">
          <Icons :name="isMaximized ? 'restore' : 'maximize'" />
        </button>
        <button @click="win?.close()" class="btn-ghost flex h-8 w-8 items-center justify-center rounded-lg border border-transparent hover:bg-red-500 hover:text-white hover:border-red-500/30" :style="{ color: config.fontColor }">
          <Icons name="close" />
        </button>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden z-10">
      <aside class="flex w-60 shrink-0 flex-col gap-2 p-4 transition-colors duration-300" :class="sidebarClass">
        <div class="mb-2 px-3 text-xs font-bold uppercase tracking-wider opacity-40 text-sub">Collections</div>
        <button
          v-for="cat in config.categories" :key="cat.id"
          class="rounded-lg px-4 py-2.5 text-left font-medium transition-all"
          :class="activeCategory === cat.id ? (config.theme === 'neu' ? 'neu-active' : 'bg-primary text-white shadow-lg font-bold') + (config.theme === 'glass' ? ' backdrop-blur-md bg-primary/80' : '') : 'btn-ghost'"
          :style="activeCategory !== cat.id ? { color: config.fontColor } : {}"
          @click="activeCategory = cat.id"
        >
          {{ cat.name }}
        </button>
      </aside>

      <main class="flex-1">
        <CustomScrollbar height="100%">
          <div class="p-6 pt-10">
            <div class="sticky top-4 z-30 mb-6 flex justify-center">
              <div class="relative w-full max-w-xl">
                <input v-model="searchQuery" type="text" placeholder="Search Prompts..." class="card-style w-full rounded-xl px-5 py-3 pr-12 outline-none transition-all focus:ring-2 focus:ring-primary/50 placeholder-gray-400" :style="{ color: config.fontColor }" />
                <button @click="openAddModal" class="absolute right-2 top-1.5 bottom-1.5 aspect-square rounded-lg bg-primary text-white hover:opacity-90 transition flex items-center justify-center shadow-sm text-lg" :class="config.theme === 'glass' ? 'backdrop-blur-md bg-primary/80' : ''">+</button>
              </div>
            </div>

            <div v-if="filteredList.length > 0" ref="masonryContainerRef" class="grid gap-2.5 pb-20" :style="{ gridTemplateColumns: `repeat(${masonryColumns}, 1fr)` }">
          <div
            v-for="item in filteredList"
            :key="item.id"
            class="card-style group rounded-xl p-3 transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-xl relative"
          >
            <div class="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button @click.stop="openEditModal(item)" class="w-6 h-6 rounded bg-white/90 text-black shadow hover:text-primary flex items-center justify-center" title="编辑">
                <Icons name="edit" />
              </button>
              <button @click.stop="handleDelete(item)" class="w-6 h-6 rounded bg-white/90 text-red-500 shadow hover:bg-red-500 hover:text-white flex items-center justify-center" title="删除">
                <Icons name="delete" />
              </button>
            </div>
            <div class="absolute top-4 left-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
               <button @click.stop="viewOriginal(item.image || '')" class="w-6 h-6 rounded bg-white/90 text-black shadow flex items-center justify-center" title="查看原图">
                 <Icons name="view" />
               </button>
            </div>

            <div v-if="item.thumbnail || item.image" class="relative overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700 aspect-auto mb-3 cursor-pointer" @dblclick="copyOriginalImage(item.image || '')">
              <img
                v-if="item.thumbnail || item.image"
                :src="item.thumbnail || item.image"
                class="w-full object-cover"
                loading="lazy"
                @error="(e) => { const target = e.target as HTMLImageElement; target.style.display = 'none'; const next = target.nextElementSibling as HTMLElement; if (next) next.style.display = 'flex'; }"
              />
              <div class="absolute inset-0 hidden items-center justify-center text-gray-400 text-xs">
                <span>图片加载失败</span>
              </div>
              <!-- 复制成功提示 -->
              <div v-if="copiedImageId" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 bg-green-500/80 text-white rounded-lg text-xs font-bold shadow-lg backdrop-blur-sm">
                复制成功
              </div>
            </div>

            <div>
              <div class="mb-1">
                 <h3 class="truncate text-sm font-bold text-txt opacity-90">{{ item.title }}</h3>
              </div>
              <p v-if="item.description" class="text-xs text-sub mb-2 line-clamp-2">{{ item.description }}</p>
              
              <div
                v-if="item.prompt"
                class="p-2 rounded text-[10px] font-mono break-all transition relative group/prompt border"
                :class="copiedPromptId === item.id
                  ? 'bg-green-500/80 text-white border-green-500/80 backdrop-blur-sm'
                  : 'bg-gray-50/10 dark:bg-gray-800/10 border-gray-200/10 dark:border-gray-700/10 text-sub hover:bg-gray-100/20 dark:hover:bg-gray-700/20'"
                @dblclick="item.prompt ? copyPrompt(item.prompt, item.id) : null"
                title="双击复制"
              >
                <span v-if="copiedPromptId === item.id" class="font-bold text-center block">✓ 复制成功</span>
                <span v-else>{{ item.prompt }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="mt-20 flex flex-col items-center justify-center text-sub opacity-50">
          <div class="mb-4">
            <Icons name="folder" />
          </div>
          <p>没有找到相关提示词</p>
          <p class="text-xs mt-2">点击上方 + 号添加</p>
        </div>
        </div>
        </CustomScrollbar>
      </main>
    </div>
    </div>

    <div v-if="showEditor" class="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in p-8" @paste="handlePaste">
      <div ref="editorRef" tabindex="-1" class="card-style w-full max-w-2xl flex flex-col overflow-hidden rounded-2xl shadow-2xl outline-none" :class="config.theme === 'glass' ? 'glass-modal' : ''" style="max-height: 90vh">
        <div class="flex items-center justify-between border-b border-gray-200/50 p-4 dark:border-gray-700/50" :class="config.theme === 'glass' ? '!border-white/20' : ''">
          <h2 class="text-lg font-bold text-txt" :class="config.theme === 'glass' && !config.isDark ? '!text-gray-800' : ''">{{ isEditMode ? '编辑提示词' : '添加提示词' }}</h2>
          <button @click="showEditor = false" class="btn-ghost rounded-full w-8 h-8 flex items-center justify-center">
            <Icons name="close" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-4" :class="config.theme === 'glass' ? '!text-gray-800 dark:!text-gray-100' : ''">
            <div class="grid grid-cols-3 gap-4">
            <div class="col-span-2">
              <label class="block text-xs font-bold mb-1 text-sub">标题</label>
              <input v-model="form.title" type="text" class="card-style w-full px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-primary !shadow-inner bg-gray-50 dark:bg-gray-900" placeholder="给提示词起个名字..." />
            </div>
            <div>
              <label class="block text-xs font-bold mb-1 text-sub">分类</label>
              <div class="relative">
                <select
                  v-model="form.categoryId"
                  class="card-style w-full px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer backdrop-blur-sm"
                  :class="{
                    'bg-white/70 border-gray-200/50 text-gray-800': !config.isDark,
                    'bg-black/60 border-gray-600/50 text-gray-200': config.isDark
                  }"
                >
                  <option
                    v-for="cat in config.categories"
                    :key="cat.id"
                    :value="cat.id"
                    :class="{
                      'bg-white/80 text-gray-800': !config.isDark,
                      'bg-black/70 text-gray-200': config.isDark
                    }"
                  >{{ cat.name }}</option>
                </select>
                <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" :class="{ 'text-gray-500': !config.isDark, 'text-gray-400': config.isDark }">
                  <Icons name="chevron-down" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold mb-1 text-sub">描述 (可选)</label>
            <textarea v-model="form.description" rows="2" class="card-style w-full px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-primary !shadow-inner bg-gray-50 dark:bg-gray-900 resize-none" placeholder="备注信息..."></textarea>
          </div>

          <div>
            <label class="block text-xs font-bold mb-1 text-sub">Prompt 提示词</label>
            <textarea v-model="form.prompt" rows="4" class="card-style w-full px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-primary !shadow-inner bg-gray-50 dark:bg-gray-900 font-mono text-xs" placeholder="在此输入 Prompt..."></textarea>
          </div>

          <div>
             <label class="block text-xs font-bold mb-1 text-sub">参考图</label>
             <div 
               class="relative rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 transition hover:border-primary hover:bg-primary/5 min-h-[160px] flex items-center justify-center overflow-hidden group"
               @dragover.prevent
               @drop.prevent="handleDrop"
               @paste="handlePaste"
               tabindex="0" 
             >
               <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="handleFileSelect" />
               
               <div v-if="form.tempImage || form.image" class="absolute inset-0 flex items-center justify-center bg-transparent">
                 <img :src="form.tempImage || form.image" class="max-w-full max-h-full object-contain" />
                 <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4">
                    <button @click="removeImage" class="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow hover:bg-red-600">移除图片</button>
                    <button @click="fileInputRef?.click()" class="bg-white text-black px-3 py-1.5 rounded-lg text-xs font-bold shadow hover:bg-gray-100">更换</button>
                 </div>
               </div>

               <div v-else class="text-center p-8 cursor-pointer" @click.stop="fileInputRef?.click()">
                 <div class="mb-2 opacity-30">
                   <Icons name="image" />
                 </div>
                 <p class="text-xs font-bold text-sub">点击上传、拖入图片 或 Ctrl+V 粘贴</p>
               </div>
             </div>
          </div>
        </div>

        <div class="border-t border-gray-200/50 p-4 flex justify-end gap-3 dark:border-gray-700/50">
          <button @click="showEditor = false" class="px-5 py-2 rounded-lg font-bold text-xs btn-ghost border border-gray-200 dark:border-gray-700">取消</button>
          <button @click="handleSave" class="px-6 py-2 rounded-lg font-bold text-xs btn-primary shadow-lg">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showSettings" class="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in p-10" @click.self="showSettings = false">
       <div class="card-style w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden rounded-2xl shadow-2xl" :class="{ 'neu-modal': config.theme === 'neu', 'glass-modal': config.theme === 'glass' }">
        <div class="settings-header flex items-center justify-between border-b border-gray-200/50 p-4 dark:border-gray-700/50 backdrop-blur-sm" :class="{ 'border-white/20': config.theme === 'glass', '!text-gray-800': config.theme === 'glass' && !config.isDark }">
          <h2 class="text-lg font-bold text-txt flex items-center gap-2" :class="config.theme === 'glass' && !config.isDark ? '!text-gray-800' : ''">
            <Icons name="settings" />
            设置
          </h2>
          <button @click="showSettings = false" class="btn-ghost rounded-full w-8 h-8 flex items-center justify-center">
            <Icons name="close" />
          </button>
        </div>
        <div class="flex overflow-hidden h-full">
        <div class="w-48 shrink-0 border-r border-gray-200/50 dark:border-gray-700/50 p-4 flex flex-col gap-2 h-full" :class="{ '!border-none !bg-transparent': config.theme === 'neu', '!border-white/20 !bg-transparent': config.theme === 'glass', '!bg-transparent': config.theme === 'modern' }">
          <button @click="settingsTab = 'theme'" :class="[settingsTab === 'theme' ? (config.theme === 'neu' ? 'neu-active' : 'bg-primary text-white shadow-md') : 'btn-ghost', 'text-left px-4 py-2.5 rounded-lg font-medium transition flex items-center gap-2', { '!text-gray-700 hover:!text-gray-900': config.theme === 'glass' && !config.isDark, '!text-white hover:!text-gray-200': config.isDark && config.theme === 'modern' }]">
            <Icons name="theme" />
            主题风格
          </button>
          <button @click="settingsTab = 'category'" :class="[settingsTab === 'category' ? (config.theme === 'neu' ? 'neu-active' : 'bg-primary text-white shadow-md') : 'btn-ghost', 'text-left px-4 py-2.5 rounded-lg font-medium transition flex items-center gap-2', { '!text-gray-700 hover:!text-gray-900': config.theme === 'glass' && !config.isDark, '!text-white hover:!text-gray-200': config.isDark && config.theme === 'modern' }]">
            <Icons name="category" />
            分类管理
          </button>
          <button @click="settingsTab = 'data'" :class="[settingsTab === 'data' ? (config.theme === 'neu' ? 'neu-active' : 'bg-primary text-white shadow-md') : 'btn-ghost', 'text-left px-4 py-2.5 rounded-lg font-medium transition flex items-center gap-2', { '!text-gray-700 hover:!text-gray-900': config.theme === 'glass' && !config.isDark, '!text-white hover:!text-gray-200': config.isDark && config.theme === 'modern' }]">
            <Icons name="data" />
            数据管理
          </button>
          <button @click="settingsTab = 'about'" :class="[settingsTab === 'about' ? (config.theme === 'neu' ? 'neu-active' : 'bg-primary text-white shadow-md') : 'btn-ghost', 'text-left px-4 py-2.5 rounded-lg font-medium transition flex items-center gap-2', { '!text-gray-700 hover:!text-gray-900': config.theme === 'glass' && !config.isDark, '!text-white hover:!text-gray-200': config.isDark && config.theme === 'modern' }]">
            <Icons name="about" />
            关于
          </button>
        </div>
        <div class="flex-1 p-8 relative overflow-y-auto h-full" :class="{ '!bg-transparent': config.theme === 'neu', '!bg-transparent !text-gray-800 dark:!text-gray-100': config.theme === 'glass' }">
           <div v-if="settingsTab === 'theme'" class="space-y-8 animate-in slide-in">
             <h2 class="text-xl font-bold mb-6 text-txt">界面外观</h2>
             <div class="grid grid-cols-4 gap-4">
                <button v-for="t in ['modern', 'glass', 'neu']" :key="t" @click="config.theme = t" class="relative h-24 rounded-xl border-2 transition-all overflow-hidden group" :class="config.theme === t ? 'border-primary ring-2 ring-primary/30' : 'border-transparent opacity-70 hover:opacity-100'">
                  <div class="absolute inset-0" :class="{ 'bg-gray-100': t==='modern', 'bg-gradient-to-br from-blue-300 to-purple-300': t==='glass', 'bg-[#e0e5ec]': t==='neu' }"></div>
                  <span class="absolute bottom-2 left-3 font-bold text-black/70">{{ {modern:'简约', glass:'毛玻璃', neu:'新拟物'}[t] }}</span>
                </button>
                <button @click="config.isDark = !config.isDark" class="relative h-24 rounded-xl border-2 border-transparent transition-all hover:scale-105" :class="config.isDark ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'">
                   <div class="absolute inset-0 flex items-center justify-center">
                     <Icons :name="config.isDark ? 'moon' : 'sun'" />
                   </div>
                </button>
             </div>
             <div v-if="config.theme !== 'neu'" class="mt-6">
                <label class="block text-xs font-bold mb-3 text-sub uppercase">主题色</label>
                <div class="flex items-center gap-3">
                  <button v-for="c in presetColors" :key="c" @click="config.primaryColor = c" class="w-8 h-8 rounded-full border-2 transition hover:scale-110" :style="{backgroundColor: c, borderColor: config.primaryColor === c ? 'white' : 'transparent'}"></button>
                  <input type="color" v-model="config.primaryColor" class="h-8 w-12 cursor-pointer rounded bg-transparent ml-2">
                </div>
             </div>
             <div v-if="config.theme !== 'neu'" class="mt-6">
                <label class="block text-xs font-bold mb-3 text-sub uppercase">字体颜色</label>
                <div class="flex items-center gap-3">
                  <button v-for="c in presetFontColors" :key="c" @click="config.fontColor = c" class="w-8 h-8 rounded-full border-2 transition hover:scale-110" :style="{backgroundColor: c, borderColor: config.fontColor === c ? 'white' : 'transparent'}"></button>
                  <input type="color" v-model="config.fontColor" class="h-8 w-12 cursor-pointer rounded bg-transparent ml-2">
                </div>
             </div>
             <div v-if="config.theme === 'glass'" class="mt-6">
                <label class="block text-xs font-bold mb-3 text-sub uppercase">背景设置</label>
                <div class="space-y-4">
                  <!-- 背景类型选择 -->
                  <div class="flex gap-2">
                    <button @click="config.glassBg.type = 'gradient'" :class="config.glassBg.type === 'gradient' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'" class="px-4 py-2 rounded-lg text-xs font-bold transition">预设渐变</button>
                    <button @click="config.glassBg.type = 'custom'" :class="config.glassBg.type === 'custom' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'" class="px-4 py-2 rounded-lg text-xs font-bold transition">自定义渐变</button>
                    <button @click="config.glassBg.type = 'image'" :class="config.glassBg.type === 'image' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'" class="px-4 py-2 rounded-lg text-xs font-bold transition">背景图片</button>
                  </div>
                  
                  <!-- 预设渐变选择 -->
                  <div v-if="config.glassBg.type === 'gradient'" class="grid grid-cols-5 gap-2">
                    <button v-for="(grad, idx) in gradients" :key="idx" @click="config.glassBg.value = idx" class="h-16 rounded-lg border-2 transition hover:scale-105" :class="config.glassBg.value === idx ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'" :style="{background: grad}"></button>
                  </div>
                  
                  <!-- 自定义渐变 -->
                  <div v-if="config.glassBg.type === 'custom'">
                    <div class="flex items-center gap-4">
                      <div class="flex flex-col items-center gap-1">
                        <label class="text-xs font-bold text-sub">颜色 1</label>
                        <input 
                          type="color" 
                          v-model="config.glassBg.color1" 
                          class="w-8 h-8 cursor-pointer rounded-lg border-2 border-transparent transition hover:scale-110"
                          :style="{ borderColor: config.glassBg.color1 === config.primaryColor ? 'white' : 'transparent' }"
                        />
                      </div>
                      <div class="flex flex-col items-center gap-1">
                        <label class="text-xs font-bold text-sub">位置 1</label>
                        <input 
                          v-model.number="config.glassBg.position1" 
                          type="number" 
                          min="0" 
                          max="100"
                          class="w-16 px-2 py-1 rounded-lg outline-none focus:ring-2 focus:ring-primary/50 text-xs text-center bg-transparent border border-gray-200/50 dark:border-gray-700/50 [&::-webkit-inner-spin-button]:bg-transparent [&::-webkit-outer-spin-button]:bg-transparent"
                        />
                      </div>
                      <div class="flex flex-col items-center gap-1">
                        <label class="text-xs font-bold text-sub">颜色 2</label>
                        <input 
                          type="color" 
                          v-model="config.glassBg.color2" 
                          class="w-8 h-8 cursor-pointer rounded-lg border-2 border-transparent transition hover:scale-110"
                          :style="{ borderColor: config.glassBg.color2 === config.primaryColor ? 'white' : 'transparent' }"
                        />
                      </div>
                      <div class="flex flex-col items-center gap-1">
                        <label class="text-xs font-bold text-sub">位置 2</label>
                        <input 
                          v-model.number="config.glassBg.position2" 
                          type="number" 
                          min="0" 
                          max="100"
                          class="w-16 px-2 py-1 rounded-lg outline-none focus:ring-2 focus:ring-primary/50 text-xs text-center bg-transparent border border-gray-200/50 dark:border-gray-700/50 [&::-webkit-inner-spin-button]:bg-transparent [&::-webkit-outer-spin-button]:bg-transparent"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <!-- 背景图片 -->
                  <div v-if="config.glassBg.type === 'image'">
                    <div class="flex gap-2 items-center">
                      <div
                        v-if="config.glassBg.image"
                        class="w-[6rem] h-[6rem] rounded-xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50 flex-shrink-0"
                      >
                        <img :src="config.glassBg.image" class="w-full h-full object-cover" alt="背景图片" />
                      </div>
                      <button @click="selectBgImage" class="btn-primary px-4 py-2 rounded-lg text-xs font-bold">选择图片</button>
                    </div>
                    <div class="mt-3">
                      <label class="block text-xs font-bold mb-2 text-sub">背景模糊: {{ Math.round(config.glassBg.blur / 20 * 100) }}%</label>
                      <input 
                        v-model.number="config.glassBg.blur" 
                        type="range" 
                        min="0" 
                        max="20" 
                        step="1"
                        class="w-1/2 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                      />
                    </div>
                  </div>
                </div>
             </div>
             <div v-if="config.theme === 'neu'" class="mt-6">
                <label class="block text-xs font-bold mb-3 text-sub uppercase">基调风格</label>
                <div class="flex gap-4">
                  <button v-for="tone in [{id: 'gray', name: '灰'}, {id: 'blue', name: '蓝'}, {id: 'green', name: '绿'}]" :key="tone.id" @click="config.neuTone = tone.id" class="w-12 h-12 rounded-full text-xs font-bold transition shadow-sm flex items-center justify-center" :class="config.neuTone === tone.id ? 'ring-2 ring-primary ring-offset-2' : ''" :style="{ backgroundColor: tone.id === 'gray' ? '#e0e5ec' : tone.id === 'blue' ? '#e4ebf5' : '#e6eee6', color: '#475569' }">{{ tone.name }}</button>
                </div>
             </div>
           </div>
           <div v-if="settingsTab === 'category'" class="space-y-6 animate-in slide-in">
             <h2 class="text-xl font-bold text-txt">分类管理</h2>
             <div class="card-style p-6 rounded-xl opacity-80">
               <div class="flex gap-2 mb-6">
                 <input v-model="newCategoryName" type="text" placeholder="输入新分类名称..." class="flex-1 card-style px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-primary/50" :style="{ color: config.fontColor }">
                 <button @click="addCategory" class="btn-primary px-4 py-2 rounded-lg font-bold shadow-md">添加</button>
               </div>
               <CustomScrollbar>
                 <div
                   v-for="(cat, idx) in config.categories"
                   :key="cat.id"
                   class="flex items-center justify-between h-10 px-4 rounded-lg backdrop-blur-sm border cursor-move hover:shadow-md transition-all duration-200"
                   :class="{
                     'mb-[5px]': idx < config.categories.length - 1,
                     'bg-white/70 border-gray-200/50 hover:bg-white/80': !config.isDark,
                     'bg-black/50 border-gray-700/50 hover:bg-black/60': config.isDark
                   }"
                   draggable="true"
                   @dragstart="handleDragStart(idx)"
                   @dragover.prevent
                   @drop="handleCategoryDrop(idx)"
                 >
                   <div class="flex items-center gap-3 flex-1">
                     <span class="cursor-grab active:cursor-grabbing" :class="{ 'text-gray-600': !config.isDark, 'text-gray-300': config.isDark }">
                       <Icons name="drag" />
                     </span>
                     <span
                       class="font-medium text-sm"
                       :class="{ 'text-gray-800': !config.isDark, 'text-gray-200': config.isDark }"
                     >{{ cat.name }}</span>
                   </div>
                   <div class="flex items-center gap-2">
                     <button
                       v-if="cat.id !== 'all'"
                       @click="startEditCategory(idx, cat.name)"
                       class="p-1.5 rounded-lg text-sm transition hover:bg-black/10 dark:hover:bg-white/10"
                       :class="{ 'text-gray-600 hover:text-gray-800': !config.isDark, 'text-gray-400 hover:text-gray-200': config.isDark }"
                       title="重命名"
                     >
                       <Icons name="edit" />
                     </button>
                     <button
                       v-if="cat.id !== 'all'"
                       @click="removeCategory(idx)"
                       class="p-1.5 rounded-lg text-sm transition hover:bg-red-100 dark:hover:bg-red-900/50"
                       :class="{ 'text-red-500 hover:text-red-700': !config.isDark, 'text-red-400 hover:text-red-300': config.isDark }"
                       title="删除"
                     >
                       <Icons name="delete" />
                     </button>
                   </div>
                 </div>
                 </CustomScrollbar>
             </div>
           </div>
           <div v-if="settingsTab === 'data'" class="space-y-6 animate-in slide-in">
             <h2 class="text-xl font-bold text-txt">数据存储</h2>
             <div class="card-style p-6 rounded-xl space-y-4 opacity-80">
               <div class="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-200 p-4 rounded-lg text-xs leading-5 flex items-center gap-2">
                 <Icons name="info" />
                 数据保存在：{{ config.dataPath }}
               </div>
               <div class="flex gap-3">
                 <button @click="handleDataPathChange" class="btn-primary px-4 py-2 rounded-lg text-xs font-bold">更改路径</button>
               </div>
             </div>

             <div class="card-style p-6 rounded-xl space-y-4 opacity-80">
               <h3 class="text-sm font-bold text-txt mb-4">数据备份与恢复</h3>
               <div class="flex gap-3">
                 <button @click="handleExportData" class="btn-primary px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
                   <Icons name="data" />
                   导出数据
                 </button>
                 <button @click="handleImportData" class="btn-primary px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
                   <Icons name="data" />
                   导入数据
                 </button>
               </div>
               <p class="text-xs text-sub mt-3">
                 导出功能会将所有数据打包为 zip 文件，导入功能会从 zip 文件恢复数据。
               </p>
             </div>
           </div>
           <div v-if="settingsTab === 'about'" class="flex flex-col items-center justify-center h-full animate-in slide-in">
             <div class="text-center space-y-8">
               <div class="animate-pulse">
                 <img src="@renderer/assets/PromptHub.png" class="w-24 h-24 mx-auto" alt="PromptHub" />
               </div>
               <h1 class="text-3xl font-bold text-txt tracking-wide">PromptHub</h1>
               <div class="flex items-center justify-center gap-2 text-sub">
                 <span class="w-8 h-px bg-gray-300 dark:bg-gray-600"></span>
                 <span class="text-sm font-medium">v1.0.2</span>
                 <span class="w-8 h-px bg-gray-300 dark:bg-gray-600"></span>
               </div>
               <div class="space-y-4 text-sub pt-4">
                 <p class="flex items-center justify-center gap-2">
                   <Icons name="user" />
                   <span class="text-txt">作者: 伯符yoy</span>
                 </p>
                 <p class="flex items-center justify-center gap-2">
                   <Icons name="mail" />
                   <span class="text-txt">bfyoy@qq.com</span>
                 </p>
               </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 删除确认窗口 - 移到最外层容器之外 -->
  <div v-if="showDeleteConfirm" class="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in p-8" @click.self="cancelDelete">
    <div class="card-style w-full max-w-md flex flex-col overflow-hidden rounded-2xl shadow-2xl" :class="{ 'glass-modal': config.theme === 'glass', 'neu-modal': config.theme === 'neu' }">
      <div class="p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Icons name="trash" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-txt">删除至回收站！</h3>
            <p class="text-xs text-sub">7天内可从回收站恢复</p>
          </div>
        </div>
        <p class="text-sm text-txt mb-6">确定要删除此数据吗？</p>
        <div class="flex gap-3 justify-end">
          <button @click="cancelDelete" class="px-5 py-2 rounded-lg font-bold text-xs btn-ghost border border-gray-200 dark:border-gray-700">取消</button>
          <button @click="confirmDelete" class="px-5 py-2 rounded-lg font-bold text-xs bg-red-500 text-white shadow-lg hover:bg-red-600 transition">确认删除</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 数据迁移确认弹窗 -->
  <div v-if="showMigrateConfirm" class="absolute inset-0 z-[61] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in p-8" @click.self="cancelMigrate">
    <div class="card-style w-full max-w-md flex flex-col overflow-hidden rounded-2xl shadow-2xl" :class="{ 'glass-modal': config.theme === 'glass', 'neu-modal': config.theme === 'neu' }">
      <div class="p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Icons name="data" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-txt">数据迁移</h3>
            <p class="text-xs text-sub">路径已更改</p>
          </div>
        </div>
        <p class="text-sm text-txt mb-6">是否迁移现有数据到新路径？</p>
        <div class="flex gap-3 justify-end">
          <button @click="cancelMigrate" class="px-5 py-2 rounded-lg font-bold text-xs btn-ghost border border-gray-200 dark:border-gray-700">不迁移</button>
          <button @click="confirmMigrate" class="px-5 py-2 rounded-lg font-bold text-xs bg-primary text-white shadow-lg hover:opacity-90 transition">确认迁移</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 分类删除确认弹窗 -->
  <div v-if="showCategoryDeleteConfirm" class="absolute inset-0 z-[62] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in p-8" @click.self="cancelDeleteCategory">
    <div class="card-style w-full max-w-md flex flex-col overflow-hidden rounded-2xl shadow-2xl" :class="{ 'glass-modal': config.theme === 'glass', 'neu-modal': config.theme === 'neu' }">
      <div class="p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Icons name="trash" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-txt">删除分类</h3>
            <p class="text-xs text-sub">此操作不可恢复</p>
          </div>
        </div>
        <p class="text-sm text-txt mb-6">确定要删除此分类吗？</p>
        <div class="flex gap-3 justify-end">
          <button @click="cancelDeleteCategory" class="px-5 py-2 rounded-lg font-bold text-xs btn-ghost border border-gray-200 dark:border-gray-700">取消</button>
          <button @click="confirmDeleteCategory" class="px-5 py-2 rounded-lg font-bold text-xs bg-red-500 text-white shadow-lg hover:bg-red-600 transition">确认删除</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 分类编辑弹窗 -->
  <div v-if="showCategoryEditModal" class="absolute inset-0 z-[65] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in p-8" @click.self="closeCategoryEditModal">
    <div class="card-style w-full max-w-md flex flex-col overflow-hidden rounded-2xl shadow-2xl" :class="{ 'glass-modal': config.theme === 'glass', 'neu-modal': config.theme === 'neu' }">
      <div class="p-6">
        <h3 class="text-lg font-bold text-txt mb-4">编辑分类名称</h3>
        <input
          v-model="editingCategoryTempName"
          type="text"
          class="w-full px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-primary/50 mb-4"
          :class="{
            'bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200': true
          }"
          placeholder="输入分类名称"
          @keyup.enter="saveCategoryEdit"
          @keyup.esc="closeCategoryEditModal"
        />
        <div class="flex gap-3 justify-end">
          <button @click="closeCategoryEditModal" class="px-5 py-2 rounded-lg font-bold text-xs btn-ghost border border-gray-200 dark:border-gray-700">取消</button>
          <button @click="saveCategoryEdit" class="px-5 py-2 rounded-lg font-bold text-xs btn-primary">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drag-region { -webkit-app-region: drag; }
.no-drag { -webkit-app-region: no-drag; }
.sidebar-modern { @apply border-r bg-white dark:bg-gray-900; border-right-color: var(--border); }
.sidebar-glass { @apply border-r border-white/20 bg-white/10 backdrop-blur-md; }
.sidebar-neu { @apply bg-transparent border-none; }

.btn-ghost { @apply hover:bg-black/5 dark:hover:bg-white/10 transition; }
.btn-primary { @apply bg-primary text-white shadow-lg transition active:scale-95; }
.btn-primary:hover { background-color: var(--primary-hover); }

.animate-in { animation: fade-in 0.2s ease-out; }
.slide-in { animation: slide-in 0.3s ease-out; }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes slide-in { from { transform: translateY(10px); } to { transform: translateY(0); } }

/* 新拟物模式设置界面 */
html[data-theme='neu'] .neu-modal {
  box-shadow: 20px 20px 60px var(--neu-shadow-dark), -20px -20px 60px var(--neu-shadow-light);
}

/* 毛玻璃模式设置和编辑界面 */
html[data-theme='glass'] .glass-modal {
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  background-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.2);
}

html.dark[data-theme='glass'] .glass-modal {
  background-color: rgba(15, 23, 42, 0.3);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
}
</style>