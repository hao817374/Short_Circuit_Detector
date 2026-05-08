import React from 'react';
import { Cpu } from 'lucide-react';

export const Analyzer: React.FC = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-500">
      <Cpu size={48} className="mb-4 opacity-20" />
      <h3 className="text-lg font-semibold">AI Module Disabled</h3>
      <p className="text-sm">This feature is not required for Short Circuit Detection.</p>
    </div>
  );
};