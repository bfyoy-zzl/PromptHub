import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    
    // 触发托盘准备就绪事件
    ipcRenderer.on('tray-ready', () => {
      window.dispatchEvent(new CustomEvent('tray-ready'))
    })
    
    contextBridge.exposeInMainWorld('windowControls', {
      minimize: (): Promise<void> => ipcRenderer.invoke('window-min'),
      toggleMaximize: (): Promise<void> => ipcRenderer.invoke('window-max'),
      close: (): Promise<void> => ipcRenderer.invoke('window-close'),
      
      // 配置
      saveConfig: (data: any): Promise<void> => ipcRenderer.invoke('config:save', data),
      onInitConfig: (callback: any): void => {
        ipcRenderer.on('init-config', (_event, value) => callback(value))
      },
      selectDataPath: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectDataPath'),
      
      // 数据管理
      changeDataPath: (newPath: string): Promise<any> => ipcRenderer.invoke('data:changePath', newPath),
      migratePrompts: (oldPath: string): Promise<any> => ipcRenderer.invoke('data:migratePrompts', oldPath),
      exportData: (exportPath: string): Promise<any> => ipcRenderer.invoke('data:export', exportPath),
      importData: (zipPath: string): Promise<any> => ipcRenderer.invoke('data:import', zipPath),
      selectExportPath: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectExportPath'),
      selectImportFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectImportFile'),
      
      // 🟢 提示词数据操作
      loadPrompts: (): Promise<any[]> => ipcRenderer.invoke('data:loadPrompts'),
      savePrompt: (data: any): Promise<any> => ipcRenderer.invoke('prompt:save', data),
      deletePrompt: (data: any): Promise<boolean> => ipcRenderer.invoke('prompt:delete', data),
      copyImage: (imagePath: string): Promise<any> => ipcRenderer.invoke('image:copy', imagePath),
      openFile: (path: string): Promise<void> => ipcRenderer.invoke('file:open', path),
      selectBgImage: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectBgImage'),
      
      // 辅助
      openDirectory: (): Promise<any> => ipcRenderer.invoke('dialog:openDirectory'),
      getFileAbsolutePath: (filePath: string): Promise<string | null> => ipcRenderer.invoke('file:getAbsolutePath', filePath),
      
      // 托盘菜单命令
      onOpenAddPrompt: (callback: any): void => {
        ipcRenderer.on('open-add-prompt', () => callback())
      },
      onOpenSettings: (callback: any): void => {
        ipcRenderer.on('open-settings', () => callback())
      },
      onOpenCategory: (callback: any): void => {
        ipcRenderer.on('open-category', () => callback())
      },
      onOpenData: (callback: any): void => {
        ipcRenderer.on('open-data', () => callback())
      },
      onOpenAbout: (callback: any): void => {
        ipcRenderer.on('open-about', () => callback())
      }
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.windowControls = {
    // fallback
  }
}