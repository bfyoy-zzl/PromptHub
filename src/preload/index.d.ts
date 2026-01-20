import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    windowControls: {
      minimize: () => Promise<void>
      toggleMaximize: () => Promise<void>
      close: () => Promise<void>
      saveConfig: (data: any) => Promise<void>
      onInitConfig: (callback: (value: any) => void) => void
      selectDataPath: () => Promise<string | null>
      changeDataPath: (newPath: string) => Promise<any>
      migratePrompts: (oldPath: string) => Promise<any>
      exportData: (exportPath: string) => Promise<any>
      importData: (zipPath: string) => Promise<any>
      selectExportPath: () => Promise<string | null>
      selectImportFile: () => Promise<string | null>
      loadPrompts: () => Promise<any[]>
      savePrompt: (data: any) => Promise<any>
      deletePrompt: (data: any) => Promise<boolean>
      copyImage: (imagePath: string) => Promise<any>
      openFile: (path: string) => Promise<void>
      selectBgImage: () => Promise<string | null>
      openDirectory: () => Promise<any>
      onOpenAddPrompt: (callback: () => void) => void
      onOpenSettings: (callback: () => void) => void
      onOpenCategory: (callback: () => void) => void
      onOpenData: (callback: () => void) => void
      onOpenAbout: (callback: () => void) => void
    }
  }
}
