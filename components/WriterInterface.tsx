
import React, { useState, useRef, useEffect } from 'react';
import { Chapter, NovelConfig } from '../types';
import { ICONS } from '../constants';
import * as geminiService from '../geminiService';

interface WriterInterfaceProps {
  chapters: Chapter[];
  config: NovelConfig;
  outline: string;
  apiKey: string;
  onUpdateChapters: (chapters: Chapter[]) => void;
  onSaveChapterToDisk: (chapterId: string) => void; // Trigger parent save
  saveChapterData: (chapter: Chapter, index: number) => Promise<void>; // Direct data save
  onBack: () => void;
}

const WriterInterface: React.FC<WriterInterfaceProps> = ({ 
  chapters, config, outline, apiKey, onUpdateChapters, saveChapterData, onBack 
}) => {
  const [activeChapterId, setActiveChapterId] = useState<string | null>(chapters[0]?.id || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number} | null>(null);
  const [logs, setLogs] = useState<string[]>([]); // For debugging/feedback
  
  const activeChapter = chapters.find(c => c.id === activeChapterId);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortBatchRef = useRef<boolean>(false); // Ref to signal batch abort

  // Auto-scroll Logs
  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logs.length > 0) {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-4), msg]);

  // Context Helper
  const getContext = (currentChap: Chapter, allChapters: Chapter[]): string => {
    const currentIndex = allChapters.findIndex(c => c.id === currentChap.id);
    let context = "这是第一章，暂无前情提要。";
    
    // Look back up to 2 chapters for better context window
    if (currentIndex > 0) {
      const prevChapter = allChapters[currentIndex - 1];
      let prevText = prevChapter.content;
      
      // If previous chapter is empty, use summary
      if (!prevText || prevText.length < 50) {
         context = `【上章梗概】：${prevChapter.summary}`;
      } else {
         // Take last 3000 chars to ensure continuity
         context = `【上章正文结尾】：\n...${prevText.slice(-3000)}`;
      }
    }
    return context;
  };

  const handleGenerateContent = async () => {
    if (!activeChapter) return;

    setIsGenerating(true);
    addLog(`开始生成章节：${activeChapter.title}`);
    try {
      const context = getContext(activeChapter, chapters);
      const content = await geminiService.generateChapterContent(apiKey, config, activeChapter, context, outline);
      
      const updatedChapter = { ...activeChapter, content, isGenerated: true };
      updateChapterInState(updatedChapter);
      
      // Save to disk immediately
      const idx = chapters.findIndex(c => c.id === activeChapter.id);
      await saveChapterData(updatedChapter, idx);
      addLog("✅ 生成完成并保存");
      
    } catch (err) {
      console.error(err);
      addLog("❌ 生成失败，请重试");
      alert("生成失败，可能是网络波动或 API 限制。请重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStopBatch = () => {
      abortBatchRef.current = true;
      addLog("🛑 正在停止生成...");
  };

  // --- BATCH GENERATION LOGIC ---
  const handleBatchGenerate = async () => {
    if (isGenerating) return;
    
    if (!chapters || chapters.length === 0) {
        alert("请先生成大纲和分章列表，再使用连更功能。");
        return;
    }
    
    abortBatchRef.current = false;
    const chaptersToGenCount = 10;
    
    // 1. Determine safe start index
    // If active chapter is full, search forward for the first empty one.
    let currentIdx = chapters.findIndex(c => c.id === activeChapterId);
    if (currentIdx === -1) currentIdx = 0;

    // Search forward for first non-generated chapter
    let startIndex = currentIdx;
    while (startIndex < chapters.length && chapters[startIndex].content.length > 500) {
        startIndex++;
    }

    if (startIndex >= chapters.length) {
        alert("所有已规划的章节都已完成！请先在大纲页面生成更多分章目录。");
        return;
    }
    
    setIsGenerating(true);
    setBatchProgress({ current: 0, total: chaptersToGenCount });
    addLog(`🚀 启动连更模式：从第 ${startIndex + 1} 章开始...`);

    // Important: We must maintain a local copy of chapters to provide accurate context
    let localChapters = [...chapters];
       
    try {
       for (let i = 0; i < chaptersToGenCount; i++) {
          if (abortBatchRef.current) {
              addLog("⛔ 用户已停止批量生成");
              break;
          }

          const targetIndex = startIndex + i;
          
          if (targetIndex >= localChapters.length) {
            addLog("🏁 已到达最后一章，停止生成。");
            break;
          }

          const targetChapter = localChapters[targetIndex];
          setActiveChapterId(targetChapter.id); // Follow along in UI
          
          addLog(`📝 [${i+1}/${chaptersToGenCount}] 正在撰写: ${targetChapter.title}...`);
          setBatchProgress({ current: i + 1, total: chaptersToGenCount });

          // Get fresh context from LOCAL array (crucial for continuity)
          const context = getContext(targetChapter, localChapters);
            
          // Generate
          const content = await geminiService.generateChapterContent(apiKey, config, targetChapter, context, outline);
            
          // Update LOCAL array
          localChapters[targetIndex] = {
            ...targetChapter,
            content: content,
            isGenerated: true
          };

          // Update APP state
          onUpdateChapters([...localChapters]);

          // Save to DISK immediately
          await saveChapterData(localChapters[targetIndex], targetIndex);
          
          addLog(`✅ 本章完成，已保存到本地`);
          
          // Tiny delay to allow UI to breathe
          await new Promise(r => setTimeout(r, 500));
       }
       
       if (!abortBatchRef.current) addLog("🎉 批量连更完成！");
    } catch (e: any) {
       console.error(e);
       addLog(`❌ 批量生成出错: ${e.message}`);
       alert("批量生成中断，已保存当前进度。如果是 API 过载，请稍后重试。");
    } finally {
       setIsGenerating(false);
       setBatchProgress(null);
       abortBatchRef.current = false;
    }
  };

  const updateChapterInState = (updatedChapter: Chapter) => {
    const updatedChapters = chapters.map(c => c.id === updatedChapter.id ? updatedChapter : c);
    onUpdateChapters(updatedChapters);
  };

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeChapter) return;
    const newContent = e.target.value;
    
    // Optimistic UI update
    const updatedChapter = { ...activeChapter, content: newContent };
    updateChapterInState(updatedChapter);

    // Debounce save to disk (2 seconds)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
        const idx = chapters.findIndex(c => c.id === activeChapter.id);
        saveChapterData(updatedChapter, idx);
    }, 2000);
  };

  const handleDownloadChapter = () => {
    if (!activeChapter) return;
    const blob = new Blob([activeChapter.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeChapter.title}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!activeChapter) return <div className="text-white p-10">请先生成章节列表</div>;

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* Sidebar - Chapter List */}
      <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col hidden md:flex shrink-0">
        <div className="p-4 border-b border-gray-800 bg-gray-950">
           <div className="flex justify-between items-center mb-3">
             <div className="flex items-center gap-2">
                <button onClick={onBack} className="text-gray-400 hover:text-white" title="返回书架">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <span className="font-bold text-gray-400 uppercase text-xs tracking-wider">目录 ({chapters.length})</span>
             </div>
           </div>
           
           {isGenerating && batchProgress ? (
              <button 
                onClick={handleStopBatch}
                className="w-full text-xs px-3 py-2 rounded flex items-center justify-center gap-2 bg-red-900/50 text-red-400 border border-red-800 hover:bg-red-900 transition"
              >
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                停止生成
              </button>
           ) : (
              <button 
                onClick={handleBatchGenerate}
                disabled={isGenerating}
                className="w-full text-xs px-3 py-2 rounded flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow transition"
              >
                <ICONS.Rocket />
                连更10章 (自动续写)
              </button>
           )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {chapters.map((chapter, idx) => (
            <button
              key={chapter.id}
              onClick={() => !isGenerating && setActiveChapterId(chapter.id)}
              disabled={isGenerating && activeChapterId !== chapter.id && batchProgress === null} 
              className={`w-full text-left px-4 py-3 text-sm border-l-2 transition-colors duration-200 ${
                activeChapterId === chapter.id
                  ? 'bg-gray-800 border-purple-500 text-white'
                  : 'border-transparent text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <div className="font-medium truncate flex items-center gap-2">
                <span>{idx + 1}.</span>
                <span className="truncate">{chapter.title}</span>
              </div>
              <div className="flex justify-between mt-1">
                 <span className="text-xs text-gray-600 truncate">{chapter.content.length > 0 ? `${chapter.content.length} 字` : '未写作'}</span>
                 {chapter.isGenerated && <span className="text-[10px] text-green-600 border border-green-900 px-1 rounded">AI</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col bg-gray-850 min-w-0">
        {/* Toolbar */}
        <div className="h-16 border-b border-gray-700 flex items-center justify-between px-6 bg-gray-900 shrink-0">
          <div className="min-w-0 mr-4">
            <h2 className="text-lg font-bold text-white truncate">{activeChapter.title}</h2>
            {batchProgress ? (
               <div className="flex items-center gap-2 text-yellow-400 text-xs">
                 <ICONS.Loader />
                 <span className="animate-pulse">连更进度: {batchProgress.current} / {batchProgress.total}</span>
               </div>
            ) : (
               <p className="text-xs text-gray-400 truncate max-w-md">{activeChapter.summary}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleDownloadChapter}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"
              title="下载本章TXT"
            >
              <ICONS.Download />
            </button>
            <button
              onClick={handleGenerateContent}
              disabled={isGenerating}
              className={`flex items-center gap-2 px-4 py-2 rounded font-medium text-sm transition ${
                isGenerating 
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg hover:scale-105'
              }`}
            >
              {isGenerating ? <ICONS.Loader /> : <ICONS.Feather />}
              {isGenerating ? '创作中...' : (activeChapter.content ? 'AI 润色' : 'AI 撰写本章')}
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-gray-850 relative">
           <div className="max-w-3xl mx-auto h-full flex flex-col">
             <textarea
                ref={editorRef}
                value={activeChapter.content}
                onChange={handleEditorChange}
                placeholder="点击右上角“AI 撰写本章”，或左侧“连更10章”开始自动创作..."
                className="flex-1 w-full bg-transparent text-gray-300 font-serif text-lg leading-loose resize-none outline-none placeholder-gray-700"
                spellCheck={false}
             />
           </div>
           
           {/* Floating Log Console */}
           {logs.length > 0 && (
             <div className="absolute bottom-4 right-4 bg-gray-900/95 p-4 rounded-lg border border-gray-700 max-w-sm text-xs text-gray-300 font-mono pointer-events-none transition-opacity duration-500 shadow-2xl z-10">
                <div className="font-bold mb-2 text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-1">System Logs</div>
                {logs.map((log, i) => (
                  <div key={i} className="mb-1 break-words">{log}</div>
                ))}
                <div ref={logEndRef} />
             </div>
           )}
        </div>
        
        {/* Status Bar */}
        <div className="h-8 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-4 text-xs text-gray-500 shrink-0">
           <span>目标字数: {config.targetWordCount || 2500}</span>
           <span>当前字数: {activeChapter.content.length}</span>
        </div>
      </div>
    </div>
  );
};

export default WriterInterface;
