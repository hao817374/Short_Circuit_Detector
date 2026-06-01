
import React, { useState, useEffect } from 'react';
import { Settings2, Sliders, RotateCcw, AlertTriangle, Save, Check, Sun, Moon, Activity, AlertCircle } from 'lucide-react';
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
  onEnterDevMode: () => void;
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
  onClose, onEnterDevMode
}) => {
  const [showDevWarning, setShowDevWarning] = useState(false);

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
      setLocalProbeThreshold(-3000);
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
    initThreshold: language === 'zh' ? "短路阈值" : "Threshold",
    sliderMin: language === 'zh' ? "滑动条最小值" : "Slider Min",
    sliderMax: language === 'zh' ? "滑动条最大值" : "Slider Max",
    step: language === 'zh' ? "步进精度" : "Step Granularity",
    stepDesc: language === 'zh' ? "定义主界面阈值滑动条的调节精度" : "Defines the precision of the threshold slider on the main compass view.",
    
    // Probe
    probeTitle: language === 'zh' ? "表笔断开判定" : "Probe Disconnect Detection",
    probeDesc: language === 'zh' ? "当原始ADC值低于此阈值时，视为表笔断开。通常为负值（如 -3000）。" : "Raw ADC values below this threshold trigger 'Disconnected' status. Typically negative (e.g. -3000).",

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
    <div className="w-full max-w-5xl mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      
      {/* Warning Modal for Developer Mode */}
      {showDevWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-8 mx-auto border border-amber-500/20">
                    <AlertTriangle className="text-amber-500" size={40} />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white text-center mb-4 uppercase tracking-tight">
                    {language === 'zh' ? '进入开发者模式？' : 'Enter Developer Mode?'}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm text-center leading-relaxed mb-10 font-medium">
                    {language === 'zh' 
                        ? '开发者模式允许修改底层核心算法参数。不当的设置可能导致测试结果严重偏差甚至硬件损坏。非专业人员请勿继续。' 
                        : 'Developer mode allows modification of core algorithms. Incorrect settings may cause significant measurement errors or hardware issues. Authorized personnel only.'}
                </p>
                <div className="flex gap-4">
                    <button 
                        onClick={() => setShowDevWarning(false)}
                        className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-black text-[10px] tracking-widest uppercase hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                    >
                        {language === 'zh' ? '取消' : 'CANCEL'}
                    </button>
                    <button 
                        onClick={() => {
                            setShowDevWarning(false);
                            onEnterDevMode();
                        }}
                        className="flex-1 py-4 rounded-2xl bg-amber-500 text-white font-black text-[10px] tracking-widest uppercase shadow-xl hover:bg-amber-400 transition-all active:scale-95"
                    >
                        {language === 'zh' ? '确认进入' : 'CONFIRM'}
                    </button>
                </div>
            </div>
        </div>
      )}

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
            <div className="flex bg-slate-200 dark:bg-slate-900 rounded-xl p-1 border border-slate-300 dark:border-white/10">
                <button
                    onClick={() => setThemeMode('light')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black tracking-widest transition-all ${themeMode === 'light' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xl' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    <Sun size={14} /> {language === 'zh' ? '日间' : 'LIGHT'}
                </button>
                <button
                    onClick={() => setThemeMode('dark')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black tracking-widest transition-all ${themeMode === 'dark' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xl' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    <Moon size={14} /> {language === 'zh' ? '夜间' : 'DARK'}
                </button>
            </div>
            <div className="flex bg-slate-200 dark:bg-slate-900 rounded-xl p-1 border border-slate-300 dark:border-white/10">
                <button
                    onClick={() => setLanguage('en')}
                    className={`px-4 py-2 rounded-lg text-xs font-black tracking-widest transition-all ${language === 'en' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xl' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    EN
                </button>
                <button
                    onClick={() => setLanguage('zh')}
                    className={`px-4 py-2 rounded-lg text-xs font-black tracking-widest transition-all ${language === 'zh' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xl' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    中文
                </button>
            </div>
            <button
                onClick={handleResetDefaults}
                className="flex items-center gap-2 px-5 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all text-xs font-black tracking-widest border border-slate-300 dark:border-white/5"
            >
                <RotateCcw size={14} /> {t.reset}
            </button>
            <button
                onClick={() => setShowDevWarning(true)}
                className="flex items-center gap-2 px-5 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-xl transition-all text-xs font-black tracking-widest border border-amber-500/30 shadow-inner group"
            >
                <Activity size={14} className="group-hover:animate-pulse" /> {t.devMode}
            </button>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Simplified Basic Settings Card */}
        <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-300 dark:border-white/5 rounded-[2.5rem] p-10 shadow-2xl backdrop-blur-xl transition-colors duration-300">
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-cyan-500/10 rounded-2xl text-cyan-500 border border-cyan-500/20"><Sliders size={24} /></div>
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t.basicSection}</h3>
                    <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-0.5">Threshold & Range Parameters</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
                {/* 滑动条最小值 */}
                <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-3xl border border-slate-200 dark:border-white/5">
                    <div className="flex justify-between items-end mb-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">{t.sliderMin}</label>
                        <span className="text-xl font-mono font-black text-cyan-600 dark:text-cyan-400">{localThresholdMin}</span>
                    </div>
                    <input
                        type="range"
                        min={5} max={30} value={localThresholdMin}
                        onChange={(e) => setLocalThresholdMin(Number(e.target.value))}
                        className="w-full h-2.5 bg-slate-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 transition-all"
                    />
                </div>
                {/* 滑动条最大值 */}
                <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-3xl border border-slate-200 dark:border-white/5">
                    <div className="flex justify-between items-end mb-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">{t.sliderMax}</label>
                        <span className="text-xl font-mono font-black text-cyan-600 dark:text-cyan-400">{localThresholdMax}</span>
                    </div>
                    <input
                        type="range"
                        min={300} max={500} value={localThresholdMax}
                        onChange={(e) => setLocalThresholdMax(Number(e.target.value))}
                        className="w-full h-2.5 bg-slate-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 transition-all"
                    />
                </div>
                {/* 短路阈值 */}
                <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-3xl border border-slate-200 dark:border-white/5">
                    <div className="flex justify-between items-end mb-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">{t.initThreshold}</label>
                        <span className="text-xl font-mono font-black text-cyan-600 dark:text-cyan-400">{localThreshold}</span>
                    </div>
                    <input
                        type="range"
                        min={localThresholdMin} max={localThresholdMax} step={localThresholdStep}
                        value={localThreshold}
                        onChange={(e) => setLocalThreshold(Number(e.target.value))}
                        className="w-full h-2.5 bg-slate-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 transition-all"
                    />
                </div>
                {/* 步进精度 */}
                <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-3xl border border-slate-200 dark:border-white/5">
                    <div className="flex justify-between items-end mb-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">{t.step}</label>
                        <span className="text-xl font-mono font-black text-cyan-600 dark:text-cyan-400">{localThresholdStep}</span>
                    </div>
                    <input
                        type="range"
                        min={5} max={20} value={localThresholdStep}
                        onChange={(e) => setLocalThresholdStep(Number(e.target.value))}
                        className="w-full h-2.5 bg-slate-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 transition-all"
                    />
                </div>
            </div>

            {/* 表笔断开判定 */}
            <div className="mb-6">
                <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-3xl border border-slate-200 dark:border-white/5">
                    <div className="flex justify-between items-end mb-3">
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">{t.probeTitle}</label>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">{t.probeDesc}</p>
                        </div>
                        <span className="text-xl font-mono font-black text-red-500 dark:text-red-400">{localProbeThreshold}</span>
                    </div>
                    <input
                        type="number"
                        value={localProbeThreshold}
                        onChange={(e) => setLocalProbeThreshold(Number(e.target.value))}
                        className="w-32 px-4 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/10 font-mono text-sm font-bold text-red-500 dark:text-red-400 text-center focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                    />
                </div>
            </div>

            <div className="flex items-center justify-center gap-4 p-6 bg-amber-500/5 rounded-[2rem] border border-amber-500/10 max-w-xl mx-auto">
                <AlertCircle size={20} className="text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700/70 dark:text-amber-500/60 font-medium leading-relaxed uppercase tracking-wider">
                    {language === 'zh' ? '基础显示设置仅影响 UI 交互，不改变仪器测量精度。' : 'Basic settings only affect UI interaction, not measurement accuracy.'}
                </p>
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
