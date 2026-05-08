import React from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, Code, Settings, Menu, X, Activity } from 'lucide-react';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, isOpen, toggleSidebar }) => {
  const menuItems = [
    { id: ViewState.DASHBOARD, label: 'Overview', icon: LayoutDashboard },
    { id: ViewState.ANALYZER, label: 'Code Analyzer', icon: Code },
    { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-slate-900/50 z-20 transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={toggleSidebar}
      />

      {/* Sidebar Container */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-slate-900 text-slate-300 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20 lg:hover:w-64 group'}
        flex flex-col border-r border-slate-800 shadow-xl
      `}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          <div className="flex items-center space-x-3 overflow-hidden whitespace-nowrap">
            <div className="min-w-[2rem] h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <Activity size={20} />
            </div>
            <span className={`font-bold text-lg text-white transition-opacity ${isOpen ? 'opacity-100' : 'lg:opacity-0 lg:group-hover:opacity-100'}`}>
              CodePhoenix
            </span>
          </div>
          <button onClick={toggleSidebar} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  onChangeView(item.id);
                  if (window.innerWidth < 1024) toggleSidebar();
                }}
                className={`
                  w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-colors whitespace-nowrap overflow-hidden
                  ${isActive ? 'bg-blue-600/10 text-blue-400' : 'hover:bg-slate-800 hover:text-white'}
                `}
              >
                <Icon size={22} className="min-w-[22px]" />
                <span className={`transition-opacity ${isOpen ? 'opacity-100' : 'lg:opacity-0 lg:group-hover:opacity-100'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className={`flex items-center space-x-3 whitespace-nowrap overflow-hidden ${isOpen ? 'justify-start' : 'lg:justify-center lg:group-hover:justify-start'}`}>
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className={`text-xs text-emerald-500 font-medium transition-opacity ${isOpen ? 'opacity-100' : 'lg:opacity-0 lg:group-hover:opacity-100'}`}>
              System Active
            </span>
          </div>
        </div>
      </div>
    </>
  );
};