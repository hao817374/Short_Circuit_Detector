import React from 'react';
import { Bell, Search, User } from 'lucide-react';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8">
      <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
      
      <div className="flex items-center space-x-4">
        <div className="hidden md:flex items-center px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
          <Search size={16} className="text-slate-400 mr-2" />
          <input 
            type="text" 
            placeholder="Search restored files..." 
            className="bg-transparent border-none outline-none text-sm text-slate-600 placeholder-slate-400 w-48"
          />
        </div>
        
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border border-white"></span>
        </button>
        
        <div className="h-8 w-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 border border-slate-300">
          <User size={18} />
        </div>
      </div>
    </header>
  );
};