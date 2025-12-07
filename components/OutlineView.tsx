
import React, { useState } from 'react';
import { ICONS } from '../constants';
import { Chapter, NovelConfig } from '../types';
import * as geminiService from '../geminiService';

interface OutlineViewProps {
  outline: string;
  config: NovelConfig;
  apiKey: string;
  onUpdateOutline: (newOutline: string) => void;
  onChaptersGenerated: (chapters: Chapter[]) => void;
  onBack: () => void;
}

const OutlineView: React.FC<OutlineViewProps> = ({ outline, config, apiKey, onUpdateOutline, onChaptersGenerated, onBack }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localOutline, setLocalOutline] = useState(outline);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{current: number, total: number} | null>(null);

  const handleSave = () => {
    onUpdateOutline(localOutline);
    setIsEditing(false);
  };

  const handleGenerateChapters = async () => {
    setIsGenerating(true);
    setProgress({ current: 0, total: config.targetChapterCount });
    
    const BATCH_SIZE = 20; 
    let allChapters: Chapter[] = [];
    
    try {
      while (allChapters.length < config.targetChapterCount) {
        const remaining = config.targetChapterCount - allChapters.length;
        const currentBatchSize = Math.min(BATCH_SIZE, remaining);
        const startIndex = allChapters.length;

        const newBatch = await geminiService.generateChapterBatch(
          apiKey,
          config,
          localOutline,
          startIndex,
          currentBatchSize,
          allChapters 
        );

        allChapters = [...allChapters, ...newBatch];
        setProgress({ current: allChapters.length, total: config.targetChapterCount });
        
        await new Promise(r => setTimeout(r, 500));
      }
      
      onChaptersGenerated(allChapters);
    } catch (e) {
      console.error(e);
      alert("章节生成过程中断，已保存当前生成的部分。请稍后重试。");
      if (allChapters.length > 0) {
        onChaptersGenerated(allChapters);
      }
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-2">
           &larr; 返回设定
        </button>
        <div className="flex gap-3 items-center">
          {progress && (
            <div className="text-yellow-400 text-sm flex items-center gap-2 mr-4 animate-pulse">
               <ICONS.Loader />
               正在生成目录: {progress.current} / {progress.total}
            </div>
          )}
          
          {isEditing ? (
             <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded text-white flex items-center gap-2">
              <ICONS.Save /> 保存修改
            </button>
          ) : (
             <button 
               onClick={() => setIsEditing(true)} 
               disabled={isGenerating}
               className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-white border border-gray-600 disabled:opacity-50"
             >
              编辑大纲
            </button>
          )}
         
          <button 
            onClick={handleGenerateChapters}
            disabled={isGenerating || isEditing}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-6 py-2 rounded text-white font-semibold flex items-center gap-2 shadow-lg"
          >
             {isGenerating ? "生成中..." : <><ICONS.List /> 生成完整分章 ({config.targetChapterCount}章)</>}
          </button>
        </div>
      </div>

      <div className="flex-1 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col">
        <div className="bg-gray-900 px-6 py-4 border-b border-gray-700 flex items-center gap-3">
          <div className="text-yellow-400"><ICONS.Sparkles /></div>
          <h3 className="font-bold text-lg text-white">AI 生成大纲</h3>
        </div>
        
        <div className="flex-1 overflow-auto p-6">
          {isEditing ? (
            <textarea
              className="w-full h-full bg-gray-900 text-gray-200 p-4 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-serif leading-relaxed"
              value={localOutline}
              onChange={(e) => setLocalOutline(e.target.value)}
            />
          ) : (
            <div className="prose prose-invert max-w-none font-serif leading-relaxed whitespace-pre-wrap text-gray-300">
              {localOutline}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutlineView;
