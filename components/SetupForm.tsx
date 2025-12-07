
import React, { useState, useEffect } from 'react';
import { NovelConfig } from '../types';
import { ICONS } from '../constants';
import * as geminiService from '../geminiService';

interface SetupFormProps {
  initialConfig: NovelConfig;
  onSave: (config: NovelConfig) => void;
  onCancel: () => void;
  isGenerating: boolean;
  onForceSave: () => void;
}

const SetupForm: React.FC<SetupFormProps> = ({ initialConfig, onSave, onCancel, isGenerating, onForceSave }) => {
  const [config, setConfig] = useState<NovelConfig>(initialConfig);
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  // Debounced save for local file system sync if inputs change
  useEffect(() => {
     // Save config changes to parent state/disk after 3 seconds of inactivity
     const timer = setTimeout(() => {
        onSave(config); // Update parent state without regenerating outline
        onForceSave();  // Trigger disk save
     }, 3000);
     return () => clearTimeout(timer);
  }, [config, onForceSave]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleAutoFill = async () => {
    setIsAutoFilling(true);
    try {
       const key = process.env.API_KEY || "";
       if (!key) {
         alert("API Key not found.");
         return;
       }
       const trendConfig = await geminiService.generateTrendConfig(key);
       const mergedConfig = { 
         ...config, 
         ...trendConfig,
         targetChapterCount: trendConfig.targetChapterCount || 80,
         targetWordCount: trendConfig.targetWordCount || 3000
       };
       setConfig(mergedConfig);
       // Trigger immediate save for auto-filled content
       onSave(mergedConfig);
       onForceSave();
    } catch (e) {
      console.error(e);
      alert("自动生成设定失败，请重试");
    } finally {
      setIsAutoFilling(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config); // This is the manual "Generate Outline" trigger
  };

  return (
    <div className="max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
        <div className="flex items-center justify-between mb-8 border-b border-gray-700 pb-4">
          <div className="flex items-center gap-3">
             <button onClick={onCancel} className="mr-2 text-gray-400 hover:text-white">&larr; 书架</button>
             <div className="text-purple-400"><ICONS.Book /></div>
             <h2 className="text-2xl font-bold text-white">小说设定 (World Building)</h2>
          </div>
          <button 
            type="button"
            onClick={handleAutoFill}
            disabled={isAutoFilling || isGenerating}
            className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-lg disabled:opacity-50"
          >
            {isAutoFilling ? <ICONS.Loader /> : <ICONS.MagicWand />}
            {isAutoFilling ? "正在分析爆款趋势..." : "🎲 生成爆款设定"}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">小说标题</label>
              <input
                type="text"
                name="title"
                required
                value={config.title}
                onChange={handleChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition placeholder-gray-600"
                placeholder="例如：重生之我才是大佬"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">类型</label>
              <input
                type="text"
                name="genre"
                required
                value={config.genre}
                onChange={handleChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none placeholder-gray-600"
                placeholder="例如：都市异能、赛博修仙"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">预计总章节数 (Max 1000)</label>
              <input
                type="number"
                name="targetChapterCount"
                required
                min={1}
                max={1000}
                value={config.targetChapterCount}
                onChange={handleChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none placeholder-gray-600"
                placeholder="例如：100"
               />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">单章字数要求</label>
              <input
                type="number"
                name="targetWordCount"
                required
                min={500}
                max={10000}
                value={config.targetWordCount}
                onChange={handleChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none placeholder-gray-600"
                placeholder="例如：3000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">基调 (Tone)</label>
              <input
                type="text"
                name="tone"
                value={config.tone}
                onChange={handleChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none placeholder-gray-600"
                placeholder="例如：热血、暗黑、轻松、杀伐果断"
               />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">核心爽点/风格</label>
              <input
                type="text"
                name="writingStyle"
                value={config.writingStyle}
                onChange={handleChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none placeholder-gray-600"
                placeholder="例如：智商在线、节奏快、反转多"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">主角设定</label>
            <textarea
              name="protagonist"
              required
              value={config.protagonist}
              onChange={handleChange}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none placeholder-gray-600"
              placeholder="姓名、性格、金手指、核心动机..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">世界观设定</label>
            <textarea
              name="worldSetting"
              required
              value={config.worldSetting}
              onChange={handleChange}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none placeholder-gray-600"
              placeholder="力量体系、地理环境、社会结构..."
            />
          </div>
          
           <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">额外备注</label>
            <textarea
              name="additionalNotes"
              value={config.additionalNotes}
              onChange={handleChange}
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none placeholder-gray-600"
              placeholder="任何其他特殊要求..."
            />
          </div>

          <div className="flex justify-end pt-4 gap-4">
             <button
              type="button"
              onClick={onCancel}
              className="text-gray-400 hover:text-white font-medium py-3 px-6 transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isGenerating || isAutoFilling}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <ICONS.Loader /> 正在构思大纲...
                </>
              ) : (
                <>
                  生成大纲 <ICONS.ChevronRight />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SetupForm;
