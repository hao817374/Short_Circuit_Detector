import React from 'react';
import { ViewState } from '../types';
import { UploadCloud, FileCode, CheckCircle2, ArrowRight } from 'lucide-react';

interface DashboardProps {
  onViewChange: (view: ViewState) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onViewChange }) => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-4">Ready to Restore</h2>
        <p className="text-blue-100 max-w-2xl mb-8 text-lg">
          Welcome back. I am ready to analyze and reconstruct your software project. 
          Please send the partial code snippets you have recovered in the chat, and I will integrate them.
        </p>
        <button 
          onClick={() => onViewChange(ViewState.ANALYZER)}
          className="px-6 py-3 bg-white text-blue-700 font-semibold rounded-lg shadow-md hover:bg-blue-50 transition-colors inline-flex items-center"
        >
          Open Code Analyzer
          <ArrowRight size={18} className="ml-2" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4">
            <UploadCloud size={24} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">1. Input Code</h3>
          <p className="text-slate-600 text-sm">
            Paste your partial React, TypeScript, or CSS snippets into the chat or the analyzer tool.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="h-12 w-12 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-4">
            <FileCode size={24} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">2. Analysis</h3>
          <p className="text-slate-600 text-sm">
            Gemini AI will scan the fragments to identify component structure, dependencies, and missing logic.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mb-4">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">3. Restoration</h3>
          <p className="text-slate-600 text-sm">
            We will rebuild the application state, fixing errors and filling in the gaps to create a working build.
          </p>
        </div>
      </div>
      
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-6 text-center">
        <p className="text-slate-500 italic">
          "Waiting for input stream..."
        </p>
      </div>
    </div>
  );
};