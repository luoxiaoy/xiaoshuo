
import React, { useState, useEffect } from 'react';
import { AppStep, NovelConfig, Novel, Chapter } from './types';
import SetupForm from './components/SetupForm';
import OutlineView from './components/OutlineView';
import WriterInterface from './components/WriterInterface';
import Library from './components/Library';
import * as geminiService from './geminiService';
import * as fileSystemService from './fileSystemService';
import { ICONS } from './constants';

const INITIAL_CONFIG: NovelConfig = {
  title: '',
  genre: '玄幻',
  tone: '热血',
  protagonist: '',
  worldSetting: '',
  writingStyle: '智商在线，剧情紧凑',
  targetChapterCount: 50,
  targetWordCount: 3000,
  additionalNotes: '',
};

function App() {
  const [apiKey] = useState<string | null>(process.env.API_KEY || null);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [activeNovelId, setActiveNovelId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFileSystemReady, setIsFileSystemReady] = useState(false);
  const [envStatus, setEnvStatus] = useState({ supported: true, reason: 'OK' });

  // Load Library on Mount
  useEffect(() => {
    const saved = localStorage.getItem('gemini_novel_library');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNovels(Array.isArray(parsed) ? parsed : []);
      } catch (e) { console.error("Restore failed", e); }
    }
    setEnvStatus(fileSystemService.getEnvStatus());
  }, []);

  // Persist Library to LocalStorage
  useEffect(() => {
    if (novels.length > 0) {
      localStorage.setItem('gemini_novel_library', JSON.stringify(novels));
    }
  }, [novels]);

  const activeNovel = novels.find(n => n.id === activeNovelId) || null;

  // Generic updater
  const updateActiveNovel = (updates: Partial<Novel>) => {
    if (!activeNovelId) return;
    setNovels(prev => prev.map(n => 
      n.id === activeNovelId 
        ? { ...n, ...updates, lastModified: Date.now() } 
        : n
    ));
  };

  // --- File System Logic ---
  const handleSelectDirectory = async () => {
    // Directly attempt to select, let the service handle errors/alerts
    const success = await fileSystemService.selectDirectory();
    setIsFileSystemReady(success);
    if (success && activeNovel) {
      // Sync everything immediately
      await fileSystemService.saveNovelConfig(activeNovel);
      await fileSystemService.saveOutline(activeNovel);
      await fileSystemService.saveAllChapters(activeNovel);
      alert("✅ 目录连接成功！内容将自动保存到本地。");
    }
  };

  const handleDownloadBackup = () => {
      if (!activeNovel) {
          alert("请先进入一本小说");
          return;
      }
      const dataStr = JSON.stringify(activeNovel, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeNovel.config.title || 'backup'}_full_backup.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const saveConfigToDisk = async (novel: Novel) => {
    if (isFileSystemReady) await fileSystemService.saveNovelConfig(novel);
  };
  const saveOutlineToDisk = async (novel: Novel) => {
    if (isFileSystemReady) await fileSystemService.saveOutline(novel);
  };
  const saveChapterToDisk = async (novel: Novel, chapterId: string) => {
    if (!isFileSystemReady) return;
    const index = novel.chapters.findIndex(c => c.id === chapterId);
    if (index >= 0) {
      await fileSystemService.saveChapter(novel, novel.chapters[index], index);
    }
  };

  // --- Actions ---

  const handleCreateNovel = () => {
    const newNovel: Novel = {
      id: crypto.randomUUID(),
      lastModified: Date.now(),
      config: { ...INITIAL_CONFIG },
      outline: '',
      chapters: [],
      currentChapterId: null,
      step: AppStep.SETUP
    };
    setNovels(prev => [newNovel, ...prev]);
    setActiveNovelId(newNovel.id);
  };

  const handleDeleteNovel = (id: string) => {
    setNovels(prev => prev.filter(n => n.id !== id));
    if (activeNovelId === id) setActiveNovelId(null);
  };

  const handleConfigSave = async (newConfig: NovelConfig) => {
    if (!apiKey) return;
    setIsGenerating(true);
    try {
      // Save config updates first
      updateActiveNovel({ config: newConfig });
      if (activeNovel) await saveConfigToDisk({ ...activeNovel, config: newConfig });

      const generatedOutline = await geminiService.generateOutline(apiKey, newConfig);
      
      const updatedNovel = { 
        ...activeNovel!, 
        config: newConfig, 
        outline: generatedOutline, 
        step: AppStep.OUTLINE 
      };

      setNovels(prev => prev.map(n => n.id === activeNovelId ? updatedNovel : n));
      await saveOutlineToDisk(updatedNovel); // Save generated outline

    } catch (error) {
      alert("大纲生成失败，请稍后重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChaptersGenerated = (generatedChapters: Chapter[]) => {
    if (!activeNovel) return;
    updateActiveNovel({ 
      chapters: generatedChapters, 
      step: AppStep.WRITING 
    });
  };

  const renderContent = () => {
    if (!activeNovel) {
      return (
        <Library 
          novels={novels} 
          onSelect={setActiveNovelId} 
          onCreate={handleCreateNovel} 
          onDelete={handleDeleteNovel}
        />
      );
    }

    switch (activeNovel.step) {
      case AppStep.SETUP:
        return (
          <SetupForm 
            initialConfig={activeNovel.config} 
            onSave={handleConfigSave} 
            onCancel={() => setActiveNovelId(null)}
            isGenerating={isGenerating} 
            onForceSave={() => saveConfigToDisk(activeNovel)}
          />
        );
      case AppStep.OUTLINE:
        return (
          <OutlineView
            outline={activeNovel.outline}
            config={activeNovel.config}
            apiKey={apiKey || ''}
            onUpdateOutline={(o) => {
               updateActiveNovel({ outline: o });
               if(activeNovel) saveOutlineToDisk({...activeNovel, outline: o});
            }}
            onChaptersGenerated={handleChaptersGenerated}
            onBack={() => updateActiveNovel({ step: AppStep.SETUP })}
          />
        );
      case AppStep.WRITING:
        return (
          <WriterInterface
            chapters={activeNovel.chapters}
            config={activeNovel.config}
            outline={activeNovel.outline}
            apiKey={apiKey || ''}
            onUpdateChapters={(newChapters) => {
              updateActiveNovel({ chapters: newChapters });
            }}
            onSaveChapterToDisk={(chapterId) => {
               // Interface to trigger saves
            }}
            saveChapterData={async (chapter: Chapter, index: number) => {
               if(isFileSystemReady && activeNovel) {
                 await fileSystemService.saveChapter(activeNovel, chapter, index);
               }
            }}
            onBack={() => setActiveNovelId(null)}
          />
        );
      default:
        return null;
    }
  };

  if (!apiKey) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">API Key Missing</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans selection:bg-purple-500 selection:text-white">
      {/* Header */}
      <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 sticky top-0 z-50 shadow-md">
        <button 
           onClick={() => setActiveNovelId(null)}
           className="flex items-center gap-3 hover:opacity-80 transition"
        >
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-lg text-white">
            <ICONS.Book />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 hidden md:block">
            Gemini Novel Architect
          </h1>
        </button>

        <div className="flex items-center gap-3">
          {/* Download Backup Fallback */}
          {activeNovel && (
              <button 
                onClick={handleDownloadBackup}
                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
                title="导出当前小说所有数据（JSON）"
              >
                 <ICONS.Download />
                 <span className="hidden sm:inline">下载备份</span>
              </button>
          )}

          {/* Connect Folder Button */}
          <button
            onClick={handleSelectDirectory}
            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition ${
              isFileSystemReady 
                ? 'bg-green-900/30 border-green-600 text-green-400' 
                : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700 hover:border-gray-500'
            }`}
            title={isFileSystemReady ? "自动保存开启中" : "连接本地文件夹以开启自动保存"}
          >
            <ICONS.Folder />
            <span className="hidden sm:inline">
                {isFileSystemReady ? "自动保存开启" : "选择保存文件夹"}
            </span>
          </button>

          <div className="flex items-center gap-2 text-xs text-gray-500 border-l border-gray-700 pl-4 ml-2">
            <span className="hidden md:inline">Gemini 3.0 Pro</span>
            <div className={`h-2 w-2 rounded-full ${isGenerating ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full mx-auto">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
