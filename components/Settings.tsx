
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

  isDeveloperMode: boolean;
  setIsDeveloperMode: (v: boolean) => void;

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
  isDeveloperMode, setIsDeveloperMode,
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
  const [localDevMode, setLocalDevMode] = useState(isDeveloperMode);

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
    setLocalDevMode(isDeveloperMode);
  }, [threshold, thresholdMin, thresholdMax, thresholdStep, globalOffset, win1Offset, win2Offset, probeThreshold, isDeveloperMode]);

  const handleSave = () => {
      setThreshold(localThreshold);
      setThresholdMin(localThresholdMin);
      setThresholdMax(localThresholdMax);
      setThresholdStep(localThresholdStep);
      setGlobalOffset(localGlobalOffset);
      setWin1Offset(localWin1Offset);
      setWin2Offset(localWin2Offset);
      setProbeThreshold(localProbeThreshold);
      setIsDeveloperMode(localDevMode);
      
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
    note: language === 'zh' ? "注意：这些数值会偏移各轴的零点。建议在调试视图中使用“零点校准”功能自动获取。" : "Note: These values shift the zero-point of each axis. Use the \"ZERO CALIB\" function in the Debug view for automatic calibration.",

    devMode: language === 'zh' ? "开发者模式" : "Developer Mode",
    devDesc: language === 'zh' ? "开启后可查看实时波形调试视图并调整核心算法参数。非专业人员请勿随意修改。" : "Enable real-time waveform debugging and core algorithm parameter adjustment. Professionals only.",
    advancedSection: language === 'zh' ? "高级算法参数" : "Advanced Algorithm Parameters",
    basicSection: language === 'zh' ? "基础显示设置" : "Basic Display Settings",
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
        
        {/* Threshold Configuration Card (Basic) */}
        <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 rounded-3xl p-6 backdrop-blur-sm shadow-xl relative overflow-hidden group transition-colors duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-5 transition-opacity">
                <Sliders size={120} />
            </div>
            
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Sliders size={20} className="text-cyan-500" /> {t.basicSection}
                    </h3>
                    <span className="text-[8px] font-black px-2 py-0.5 bg-cyan-500/10 text-cyan-500 rounded uppercase tracking-tighter">UI Controls</span>
                </div>

                <div className="space-y-6">
                    <div className="bg-slate-100 dark:bg-slate-950/50 p-5 rounded-2xl border border-slate-200 dark:border-white/5 transition-colors duration-300">
                        <div className="flex justify-between items-end mb-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.initThreshold}</label>
                            <span className="text-lg font-mono font-black text-cyan-600 dark:text-cyan-400">{localThreshold}</span>
                        </div>
                        <input 
                            type="range" 
                            min={localThresholdMin} max={localThresholdMax} step={localThresholdStep}
                            value={localThreshold}
                            onChange={(e) => setLocalThreshold(Number(e.target.value))}
                            className="w-full h-2 bg-slate-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-black/20 p-4 rounded-2xl border border-slate-200 dark:border-white/5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">{t.sliderMin}</label>
                            <input 
                                type="number" 
                                value={localThresholdMin}
                                onChange={(e) => setLocalThresholdMin(Number(e.target.value))}
                                className="w-full bg-transparent font-mono text-xl font-bold text-slate-800 dark:text-slate-200 outline-none"
                            />
                        </div>
                        <div className="bg-white dark:bg-black/20 p-4 rounded-2xl border border-slate-200 dark:border-white/5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">{t.sliderMax}</label>
                            <input 
                                type="number" 
                                value={localThresholdMax}
                                onChange={(e) => setLocalThresholdMax(Number(e.target.value))}
                                className="w-full bg-transparent font-mono text-xl font-bold text-slate-800 dark:text-slate-200 outline-none"
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-black/10 rounded-2xl border border-dashed border-slate-300 dark:border-white/5">
                         <div className="flex justify-between items-center">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">{t.step}</label>
                                <p className="text-[8px] text-slate-400 dark:text-slate-500 mt-0.5">{t.stepDesc}</p>
                            </div>
                            <input 
                                type="number" 
                                value={localThresholdStep}
                                onChange={(e) => setLocalThresholdStep(Number(e.target.value))}
                                className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-lg py-1 px-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300 outline-none"
                            />
                         </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Developer Mode & Advanced Calibration */}
        <div className="space-y-6">
            {/* Developer Mode Toggle Card */}
            <div className={`rounded-3xl p-6 border transition-all duration-500 ${localDevMode ? 'bg-cyan-600/5 border-cyan-500/30' : 'bg-slate-100/50 dark:bg-slate-900/40 border-slate-300 dark:border-white/5'}`}>
                <div className="flex items-center justify-between gap-6">
                    <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-1">
                            <Activity size={18} className={localDevMode ? 'text-cyan-500' : 'text-slate-400'} />
                            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">{t.devMode}</h3>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-500 leading-relaxed max-w-sm">{t.devDesc}</p>
                    </div>
                    <button 
                        onClick={() => setLocalDevMode(!localDevMode)}
                        className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${localDevMode ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-800'}`}
                    >
                        <div className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full transition-transform duration-300 shadow-md ${localDevMode ? 'translate-x-7' : 'translate-x-0'}`} />
                    </button>
                </div>
            </div>

            {/* Advanced Algorithm Parameters (Visible only when Dev Mode is on) */}
            {localDevMode ? (
                <div className="bg-white/80 dark:bg-slate-900/60 border border-cyan-500/20 rounded-3xl p-6 backdrop-blur-sm shadow-xl relative overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Target size={120} />
                    </div>

                    <div className="relative z-10">
                        <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 mb-6">
                            <Scale size={20} className="text-emerald-500" /> {t.advancedSection}
                        </h3>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                                    <label className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Zap size={12} /> {t.bias}
                                    </label>
                                    <input 
                                        type="number" 
                                        value={localGlobalOffset}
                                        onChange={(e) => setLocalGlobalOffset(Number(e.target.value))}
                                        className="w-full bg-transparent font-mono text-2xl font-black text-amber-600 dark:text-amber-500 outline-none"
                                    />
                                    <p className="text-[8px] text-amber-600/60 dark:text-amber-500/40 mt-1 uppercase font-bold">{t.biasDesc}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 transition-all">
                                        <label className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-2 block">{t.axis1}</label>
                                        <input 
                                            type="number" 
                                            value={localWin1Offset}
                                            onChange={(e) => setLocalWin1Offset(Number(e.target.value))}
                                            className="w-full bg-transparent font-mono text-xl font-bold text-emerald-600 dark:text-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div className="bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4 transition-all">
                                        <label className="text-[10px] font-black text-violet-600 dark:text-violet-500 uppercase tracking-widest mb-2 block">{t.axis2}</label>
                                        <input 
                                            type="number" 
                                            value={localWin2Offset}
                                            onChange={(e) => setLocalWin2Offset(Number(e.target.value))}
                                            className="w-full bg-transparent font-mono text-xl font-bold text-violet-600 dark:text-violet-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-300 dark:border-slate-800">
                                <label className="text-[10px] font-black text-red-500 dark:text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <AlertTriangle size={12} /> {t.probeTitle}
                                </label>
                                <input 
                                    type="number" 
                                    value={localProbeThreshold}
                                    onChange={(e) => setLocalProbeThreshold(Number(e.target.value))}
                                    className="w-full bg-transparent font-mono text-xl font-black text-red-600 dark:text-red-500 outline-none"
                                />
                                <p className="text-[8px] text-red-500/50 mt-1 uppercase font-bold">{t.probeDesc}</p>
                            </div>

                            <div className="bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                                 <p className="text-[9px] text-blue-600 dark:text-blue-400 leading-tight font-medium">
                                    <AlertCircle size={10} className="inline mr-1 mb-0.5" /> {t.note}
                                 </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-white/5 rounded-[2.5rem] bg-slate-50/30 dark:bg-black/10 transition-all group hover:bg-slate-50/50 dark:hover:bg-black/20">
                    <AlertCircle className="text-slate-300 dark:text-slate-800 mb-4 transition-transform group-hover:scale-110 duration-500" size={48} />
                    <p className="text-xs font-black text-slate-400 dark:text-slate-700 uppercase tracking-widest">Advanced parameters hidden</p>
                    <p className="text-[9px] text-slate-300 dark:text-slate-800 mt-1">Enable Developer Mode to adjust core algorithms</p>
                </div>
            )}
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
