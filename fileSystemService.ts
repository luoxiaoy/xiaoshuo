
import { Novel, Chapter, NovelConfig } from "./types";

// Keep track of the directory handle in memory
let rootDirectoryHandle: any = null;

export const getEnvStatus = () => {
    if (typeof window === 'undefined') return { supported: false, reason: 'SSR' };
    
    // Check for API support
    if (!(window as any).showDirectoryPicker) {
        return { supported: false, reason: 'API Unsupported' };
    }

    // Check for Iframe (informative only)
    try {
        if (window.self !== window.top) {
            return { supported: false, reason: 'Iframe/Preview Mode' };
        }
    } catch (e) {
        return { supported: false, reason: 'Cross-origin' };
    }

    return { supported: true, reason: 'OK' };
};

/**
 * Prompt user to select a directory.
 */
export const selectDirectory = async (): Promise<boolean> => {
  // We do NOT block execution based on checks anymore. 
  // We let the browser attempt the call and handle the specific error if it fails.
  
  try {
    if (!(window as any).showDirectoryPicker) {
       throw new Error("BROWSER_UNSUPPORTED");
    }

    // This must be the first await call to preserve user activation
    rootDirectoryHandle = await (window as any).showDirectoryPicker();
    return true;
  } catch (error: any) {
    // Gracefully handle user cancellation
    if (error.name === 'AbortError') {
      return false;
    }

    if (error.message === "BROWSER_UNSUPPORTED") {
        alert("⚠️ 您的浏览器不支持文件夹访问功能。\n请使用 Chrome、Edge 或 Opera 桌面版。");
        return false;
    }

    // Handle iframe security restrictions
    if (error.name === 'SecurityError' || (error.message && error.message.includes('Cross origin'))) {
      alert("⚠️ 环境限制提示\n\n当前运行环境（如预览窗口/Iframe）禁止访问本地文件系统。\n\n解决方案：\n1. 点击顶部的「下载备份」按钮手动保存。\n2. 下载代码到本地，使用 VS Code + Live Server 运行即可正常使用此功能。");
      return false;
    }

    console.error("Directory selection failed:", error);
    alert(`无法访问文件夹: ${error.message}`);
    return false;
  }
};

export const isDirectorySelected = () => !!rootDirectoryHandle;

/**
 * Helpers to write files safely
 */
const getNovelDirectory = async (novelTitle: string) => {
  if (!rootDirectoryHandle) return null;
  // Sanitize directory name
  const safeTitle = novelTitle.replace(/[^a-z0-9\u4e00-\u9fa5-_]/gi, '_') || 'Untitled_Novel';
  try {
    return await rootDirectoryHandle.getDirectoryHandle(safeTitle, { create: true });
  } catch (e) {
    console.error("Failed to get/create directory handle", e);
    return null;
  }
};

export const saveNovelConfig = async (novel: Novel) => {
  if (!rootDirectoryHandle) return;
  try {
    const dir = await getNovelDirectory(novel.config.title);
    if (!dir) return;

    const fileHandle = await dir.getFileHandle('setting.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(novel.config, null, 2));
    await writable.close();
  } catch (e) {
    console.error("Error saving config:", e);
  }
};

export const saveOutline = async (novel: Novel) => {
  if (!rootDirectoryHandle) return;
  try {
    const dir = await getNovelDirectory(novel.config.title);
    if (!dir) return;

    const fileHandle = await dir.getFileHandle('outline.txt', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(novel.outline);
    await writable.close();
  } catch (e) {
    console.error("Error saving outline:", e);
  }
};

export const saveChapter = async (novel: Novel, chapter: Chapter, index: number) => {
  if (!rootDirectoryHandle) return;
  try {
    const dir = await getNovelDirectory(novel.config.title);
    if (!dir) return;

    const chaptersDir = await dir.getDirectoryHandle('chapters', { create: true });
    
    // Format: 001_ChapterTitle.txt
    const num = String(index + 1).padStart(4, '0');
    // Ensure filename is valid
    const safeTitle = (chapter.title || 'Untitled').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50); 
    const filename = `${num}_${safeTitle}.txt`;

    const fileHandle = await chaptersDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    
    const content = `第${index + 1}章：${chapter.title}\n\n${chapter.content || ''}`;
    await writable.write(content);
    await writable.close();
  } catch (e) {
    console.error(`Error saving chapter ${index + 1}:`, e);
  }
};

export const saveAllChapters = async (novel: Novel) => {
    if (!rootDirectoryHandle) return;
    try {
        for (let i = 0; i < novel.chapters.length; i++) {
            const chapter = novel.chapters[i];
            if (chapter.content && chapter.content.trim().length > 0) {
                await saveChapter(novel, chapter, i);
            }
        }
    } catch (e) {
        console.error("Error saving all chapters:", e);
    }
};
