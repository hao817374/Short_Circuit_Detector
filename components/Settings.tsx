
import React, { useState, useEffect } from 'react';
import { Settings2, Sliders, RotateCcw, Gauge, Zap, Target, ArrowLeftRight, Scale, AlertTriangle, Save, Check, Sun, Moon } from 'lucide-react';
import { Language, ThemeMode } from '../types';

interface SettingsProps {
  language: Language;
  setLanguage: (l: Language) => void;
  themeMode: ThemeMode;
  setThemeMode: (t: ThemeMode) => void;

  threshold: number;
  setThreshold: (v: number) => void;
  thresholdMin: number;
  setThresholdMin: (v: number) => void;
  thresholdMax: number;
  setThresholdMax: (v: number) => void;
  thresholdStep: number;
  setThresholdStep: (v: number) => void;
  
  globalOffset: number;
  setGlobalOffset: (v: number) => void;
  win1Offset: number;
  setWin1Offset: (v: number) => void;
  win2Offset: number;
  setWin2Offset: (v: number) => void;

  probeThreshold: number;
  setProbeThreshold: (v: number) => void;

  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  language, setLanguage,
  themeMode, setThemeMode,
  threshold, setThreshold,
  thresholdMin, setThresholdMin,
  thresholdMax, setThresholdMax,
  thresholdStep, setThresholdStep,
  globalOffset, setGlobalOffset,
  win1Offset, setWin1Offset,
  win2Offset, setWin2Offset,
  probeThreshold, setProbeThreshold,
  onClose
}) => {

  // Local State for Buffering Changes
  const [localThreshold, setLocalThreshold] = useState(threshold);
  const [localThresholdMin, setLocalThresholdMin] = useState(thresholdMin);
  const [localThresholdMax, setLocalThresholdMax] = useState(thresholdMax);
  const [localThresholdStep, setLocalThresholdStep] = useState(thresholdStep);
  
  const [localGlobalOffset, setLocalGlobalOffset] = useState(globalOffset);
  const [localWin1Offset, setLocalWin1Offset] = useState(win1Offset);
  const [localWin2Offset, setLocalWin2Offset] = useState(win2Offset);
  const [localProbeThreshold, setLocalProbeThreshold] = useState(probeThreshold);

  const [isSaved, setIsSaved] = useState(false);

  // Sync local state if props change externally (though unlikely in this view)
  useEffect(() => {
    setLocalThreshold(threshold);
    setLocalThresholdMin(thresholdMin);
    setLocalThresholdMax(thresholdMax);
    setLocalThresholdStep(thresholdStep);
    setLocalGlobalOffset(globalOffset);
    setLocalWin1Offset(win1Offset);
    setLocalWin2Offset(win2Offset);
    setLocalProbeThreshold(probeThreshold);
  }, [threshold, thresholdMin, thresholdMax, thresholdStep, globalOffset, win1Offset, win2Offset, probeThreshold]);

  const handleSave = () => {
      setThreshold(localThreshold);
      setThresholdMin(localThresholdMin);
      setThresholdMax(localThresholdMax);
      setThresholdStep(localThresholdStep);
      setGlobalOffset(localGlobalOffset);
      setWin1Offset(localWin1Offset);
      setWin2Offset(localWin2Offset);
      setProbeThreshold(localProbeThreshold);
      
      onClose();
  };

  const handleResetDefaults = () => {
      setLocalThreshold(50);
      setLocalThresholdMin(5);
      setLocalThresholdMax(500);
      setLocalThresholdStep(5);
      setLocalGlobalOffset(160);
      setLocalWin1Offset(0);
      setLocalWin2Offset(0);
      setLocalProbeThreshold(-4300);
      // Note: We update local state. User must still click Save to apply.
  };

  const t = {
    title: language === 'zh' ? "系统配置" : "System Configuration",
    subtitle: language === 'zh' ? "校准与界面参数" : "Calibration & UI Parameters",
    reset: language === 'zh' ? "恢复默认值" : "RESET DEFAULTS",
    save: language === 'zh' ? "确认并保存" : "CONFIRM & SAVE",
    saved: language === 'zh' ? "已保存" : "SAVED",
    
    // Cards
    cardThreshold: language === 'zh' ? "阈值控制" : "Threshold Controls",
    cardCalib: language === 'zh' ? "信号校准" : "Signal Calibration",
    
    // Thresholds
    initThreshold: language === 'zh' ? "初始短路阈值" : "Initial Threshold",
    sliderMin: language === 'zh' ? "滑动条最小值" : "Slider Min",
    sliderMax: language === 'zh' ? "滑动条最大值" : "Slider Max",
    step: language === 'zh' ? "步进精度" : "Step Granularity",
    stepDesc: language === 'zh' ? "定义主界面阈值滑动条的调节精度" : "Defines the precision of the threshold slider on the main compass view.",
    
    // Probe
    probeTitle: language === 'zh' ? "表笔断开判定" : "Probe Disconnect Detection",
    probeDesc: language === 'zh' ? "当原始ADC值低于此阈值时，视为表笔断开。通常为负值（如 -4300）。" : "Raw ADC values below this threshold trigger 'Disconnected' status. Typically negative (e.g. -4300).",

    // Calibration
    bias: language === 'zh' ? "全局偏置 (Bias)" : "Global Bias (Offset)",
    biasDesc: language === 'zh' ? "应用于所有ADC读数的基础偏移量，用于信号归零。" : "Base offset applied to all ADC readings to center the signal.",
    axis1: language === 'zh' ? "轴 1 (Q0)" : "Axis 1 (Q0)",
    axis2: language === 'zh' ? "轴 2 (Q1)" : "Axis 2 (Q1)",
    note: language === 'zh' ? "注意：这些数值会偏移各轴的零点。建议在调试视图中使用“零点校准”功能自动获取。" : "Note: These values shift the zero-point of each axis. Use the \"ZERO CALIB\" function in the Debug view for automatic calibration."
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
            <div className="p-4 bg-slate-200 dark:bg-slate-800/50 rounded-2xl border border-slate-300 dark:border-white/5">
                <Settings2 className="text-cyan-500 dark:text-cyan-400" size={32} />
            </div>
            <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t.title}</h2>
                <p className="text-slate-500 font-mono text-xs uppercase tracking-widest mt-1">{t.subtitle}</p>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="flex bg-slate-200 dark:bg-slate-900 rounded-lg p-1 border border-slate-300 dark:border-white/10">
                <button 
                    onClick={() => setThemeMode('light')} 
                    className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-all ${themeMode === 'light' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    <Sun size={14} /> {language === 'zh' ? '日间' : 'Light'}
                </button>
                <button 
                    onClick={() => setThemeMode('dark')} 
                    className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-all ${themeMode === 'dark' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    <Moon size={14} /> {language === 'zh' ? '夜间' : 'Dark'}
                </button>
            </div>
            <div className="flex bg-slate-200 dark:bg-slate-900 rounded-lg p-1 border border-slate-300 dark:border-white/10">
                <button 
                    onClick={() => setLanguage('en')} 
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${language === 'en' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    EN
                </button>
                <button 
                    onClick={() => setLanguage('zh')} 
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${language === 'zh' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    中文
                </button>
            </div>
            <button 
                onClick={handleResetDefaults}
                className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all text-xs font-bold tracking-wider border border-slate-300 dark:border-white/5"
            >
                <RotateCcw size={14} /> {t.reset}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Threshold Configuration Card */}
        <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 rounded-3xl p-6 backdrop-blur-sm shadow-xl relative overflow-hidden group transition-colors duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-10 dark:group-hover:opacity-20 transition-opacity">
                <Gauge size={120} />
            </div>
            
            <div className="relative z-10">
                <h3 className="text-lg font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-2 mb-6">
                    <Sliders size={20} /> {t.cardThreshold}
                </h3>

                <div className="space-y-6">
                    <div className="bg-slate-100 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-200 dark:border-white/5 transition-colors duration-300">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{t.initThreshold}</label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="range" 
                                min={localThresholdMin} max={localThresholdMax} step={localThresholdStep}
                                value={localThreshold}
                                onChange={(e) => setLocalThreshold(Number(e.target.value))}
                                className="flex-grow h-2 bg-slate-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                            <input 
                                type="number" 
                                value={localThreshold}
                                onChange={(e) => setLocalThreshold(Number(e.target.value))}
                                className="w-20 bg-white dark:bg-slate-900 border border-cyan-500/30 rounded-lg py-1 px-2 text-right font-mono text-cyan-600 dark:text-cyan-400 font-bold outline-none focus:border-cyan-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{t.sliderMin}</label>
                            <input 
                                type="number" 
                                value={localThresholdMin}
                                onChange={(e) => setLocalThresholdMin(Number(e.target.value))}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl py-3 px-4 font-mono text-slate-800 dark:text-slate-300 outline-none focus:border-cyan-500/50 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{t.sliderMax}</label>
                            <input 
                                type="number" 
                                value={localThresholdMax}
                                onChange={(e) => setLocalThresholdMax(Number(e.target.value))}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl py-3 px-4 font-mono text-slate-800 dark:text-slate-300 outline-none focus:border-cyan-500/50 transition-colors"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{t.step}</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={localThresholdStep}
                                onChange={(e) => setLocalThresholdStep(Number(e.target.value))}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl py-3 px-4 font-mono text-slate-800 dark:text-slate-300 outline-none focus:border-cyan-500/50 transition-colors"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 dark:text-slate-600 font-black pointer-events-none">UNIT</div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 px-1">{t.stepDesc}</p>
                    </div>

                     <div className="pt-4 border-t border-slate-300 dark:border-slate-800">
                        <label className="text-[10px] font-black text-red-500 dark:text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <AlertTriangle size={12} /> {t.probeTitle}
                        </label>
                         <div className="relative">
                            <input 
                                type="number" 
                                value={localProbeThreshold}
                                onChange={(e) => setLocalProbeThreshold(Number(e.target.value))}
                                className="w-full bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-900/50 rounded-xl py-3 px-4 font-mono text-red-600 dark:text-red-400 font-bold outline-none focus:border-red-500/50 transition-colors"
                            />
                         </div>
                        <p className="text-[10px] text-slate-500 mt-2 px-1">{t.probeDesc}</p>
                    </div>

                </div>
            </div>
        </div>

        {/* Calibration Configuration Card */}
        <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 rounded-3xl p-6 backdrop-blur-sm shadow-xl relative overflow-hidden group transition-colors duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-10 dark:group-hover:opacity-20 transition-opacity">
                <Target size={120} />
            </div>

            <div className="relative z-10">
                <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 mb-6">
                    <Scale size={20} /> {t.cardCalib}
                </h3>

                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Zap size={12} className="text-amber-500" /> {t.bias}
                        </label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                value={localGlobalOffset}
                                onChange={(e) => setLocalGlobalOffset(Number(e.target.value))}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl py-3 px-4 font-mono text-xl font-bold text-amber-600 dark:text-amber-500 outline-none focus:border-amber-500/50 transition-colors"
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 px-1">{t.biasDesc}</p>
                    </div>

                    <div className="h-px bg-slate-300 dark:bg-slate-800 my-4 transition-colors" />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <ArrowLeftRight size={12} className="text-emerald-500" /> {t.axis1}
                            </label>
                            <input 
                                type="number" 
                                value={localWin1Offset}
                                onChange={(e) => setLocalWin1Offset(Number(e.target.value))}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-bold outline-none focus:border-emerald-500/50 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <ArrowLeftRight size={12} className="text-violet-500" /> {t.axis2}
                            </label>
                            <input 
                                type="number" 
                                value={localWin2Offset}
                                onChange={(e) => setLocalWin2Offset(Number(e.target.value))}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl py-3 px-4 font-mono text-violet-600 dark:text-violet-400 font-bold outline-none focus:border-violet-500/50 transition-colors"
                            />
                        </div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-3 transition-colors">
                         <p className="text-[10px] text-blue-600 dark:text-blue-400 leading-relaxed">
                            {t.note}
                         </p>
                    </div>
                </div>
            </div>
        </div>

      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-700">
        <button 
            onClick={handleSave}
            disabled={isSaved}
            className={`
                flex items-center gap-3 px-8 py-4 rounded-2xl shadow-2xl font-black tracking-widest uppercase transition-all transform hover:scale-105 active:scale-95
                ${isSaved ? 'bg-emerald-500 text-white' : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]'}
            `}
        >
            {isSaved ? <Check size={24} /> : <Save size={24} />}
            {isSaved ? t.saved : t.save}
        </button>
      </div>

    </div>
  );
};
