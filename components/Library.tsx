
import React from 'react';
import { Novel } from '../types';
import { ICONS } from '../constants';

interface LibraryProps {
  novels: Novel[];
  onSelect: (novelId: string) => void;
  onCreate: () => void;
  onDelete: (novelId: string) => void;
}

const Library: React.FC<LibraryProps> = ({ novels, onSelect, onCreate, onDelete }) => {
  return (
    <div className="max-w-6xl mx-auto p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
          <ICONS.Book /> 我的书架
        </h2>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-6 py-3 rounded-xl shadow-lg transition transform hover:scale-105"
        >
          <ICONS.Sparkles /> 创建新书
        </button>
      </div>

      {novels.length === 0 ? (
        <div className="text-center py-20 bg-gray-900 rounded-2xl border border-gray-800 border-dashed">
          <div className="text-gray-600 mb-4 scale-150 inline-block p-4"><ICONS.Book /></div>
          <h3 className="text-xl text-gray-400 mb-2">书架空空如也</h3>
          <p className="text-gray-600">点击“创建新书”开始你的创作之旅吧！</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {novels.map((novel) => (
            <div 
              key={novel.id}
              className="group relative bg-gray-800 rounded-xl border border-gray-700 hover:border-purple-500 transition-all duration-300 shadow-xl overflow-hidden cursor-pointer flex flex-col h-64"
              onClick={() => onSelect(novel.id)}
            >
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-2">
                   <span className="inline-block px-2 py-1 bg-gray-900 text-purple-400 text-xs rounded border border-gray-700">
                     {novel.config.genre || '未分类'}
                   </span>
                   <span className="text-xs text-gray-500">
                     {new Date(novel.lastModified).toLocaleDateString()}
                   </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 group-hover:text-purple-400 transition-colors">
                  {novel.config.title || '无题小说'}
                </h3>
                <p className="text-gray-400 text-sm line-clamp-3 mb-4">
                  {novel.config.protagonist ? `主角：${novel.config.protagonist}` : '暂无主角设定'}
                </p>
                <div className="text-gray-500 text-xs mt-auto">
                   <span className="mr-3">📚 {novel.chapters.length} 章计划</span>
                   <span>✍️ {novel.chapters.filter(c => c.content.length > 0).length} 章已写</span>
                </div>
              </div>
              
              <div className="bg-gray-900/50 p-4 flex justify-between items-center border-t border-gray-700">
                 <span className="text-sm font-medium text-purple-400 group-hover:underline">点击编辑 &rarr;</span>
                 <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if(confirm('确定要删除这本书吗？删除后无法恢复。')) onDelete(novel.id);
                    }}
                    className="text-gray-500 hover:text-red-500 p-2 rounded transition"
                    title="删除"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                 </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Library;
