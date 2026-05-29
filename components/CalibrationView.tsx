import React, { useEffect, useRef } from 'react';
import { Language, DebugPoint, POINTS_PER_FRAME } from '../types';
import { CheckCircle2, Crosshair, Zap, Navigation, Scale, Signal, Trash2 } from 'lucide-react';

interface CalibrationViewProps {
  connected: boolean;
  language: Language;
  // Zero calibration
  isZeroSampling: boolean;
  zeroCalibEverRun: boolean;
  zeroCalibResult: { q0: number; q1: number; bias: number } | null;
  zeroCalibStatus: 'IDLE' | 'SUCCESS' | 'FAILED';
  onZeroCalibrate: () => void;
  // Direction calibration
  calibRefVectors: Record<string, { q0: number; q1: number } | null>;
  samplingStep: string | null;
  spatialCalibStatus: Record<string, 'IDLE' | 'SUCCESS' | 'FAILED'>;
  sampleProgress: number;
  allCalibrated: boolean;
  onSpatialCalibrate: (step: string) => void;
  // Actions
  onResetCalibration: () => void;
  onConfirm: () => void;
  // Waveform preview
  debugData: DebugPoint[];
  globalOffset: number;
  previewBounds: { min: number; max: number; range: number };
}

export const CalibrationView: React.FC<CalibrationViewProps> = ({
  connected, language,
  isZeroSampling, zeroCalibEverRun, zeroCalibResult, zeroCalibStatus, onZeroCalibrate,
  calibRefVectors, samplingStep, spatialCalibStatus, sampleProgress, allCalibrated, onSpatialCalibrate,
  onResetCalibration, onConfirm,
  debugData, globalOffset, previewBounds,
}) => {
  const zeroBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isZeroSampling && zeroBarRef.current) {
      const el = zeroBarRef.current;
      el.style.width = '0%';
      el.style.transition = 'width 1s linear';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { el.style.width = '100%'; });
      });
    }
  }, [isZeroSampling]);

  const t = {
    title: language === 'zh' ? "校准" : "CALIBRATION",
    zeroTitle: language === 'zh' ? "零点校准" : "ZERO CALIBRATION",
    zeroInstruction: language === 'zh' ? "将表笔短接后，点击下方按钮" : "Short the probes, then click the button below",
    dirTitle: language === 'zh' ? "方向校准" : "DIRECTION CALIBRATION",
    btn1: language === 'zh' ? "右下角激励源" : "Bottom-Right",
    btn2: language === 'zh' ? "右上角激励源" : "Top-Right",
    sampling: language === 'zh' ? "采样中..." : "Sampling...",
    clear: language === 'zh' ? "清除校准" : "CLEAR",
    confirm: language === 'zh' ? "确认并应用" : "CONFIRM & APPLY",
    waveTip: language === 'zh' ? "等待波形稳定后 点击左侧对应按键" : "Wait for stable waveform, then click button",
  };

  return (
    <div className="flex-grow flex flex-col min-h-0 h-full p-2 lg:p-4">
      <div className="flex-grow flex gap-4 lg:gap-6 min-h-0 h-full">
        <div className="flex-1 bg-white dark:bg-slate-900/60 rounded-[2.5rem] border border-slate-300 dark:border-white/5 p-6 lg:p-8 flex flex-col transition-colors shadow-2xl relative overflow-hidden">
          <div className="mb-6">
            <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-4">
              <Scale className="text-cyan-500" size={32} />
              {t.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-500 font-mono tracking-widest uppercase mt-2">Surface Vector Mapping & Normalization</p>
          </div>

          <div className="flex-grow flex flex-col gap-6">
            {/* Zero Calib Card */}
            <div className="bg-slate-50 dark:bg-black/20 rounded-3xl p-6 border border-slate-200 dark:border-white/5 transition-all">
              <h3 className="text-base font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-3">
                <Zap size={18} className="text-amber-500" />
                {t.zeroTitle}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed font-medium">
                {t.zeroInstruction}
              </p>
              <div className="flex items-stretch gap-4">
                <button
                  onClick={onZeroCalibrate}
                  disabled={isZeroSampling}
                  className={`relative overflow-hidden flex-1 max-w-[360px] h-16 rounded-2xl border-2 font-black tracking-widest uppercase text-xs transition-all flex items-center px-6 gap-4 active:scale-95 ${isZeroSampling ? 'border-amber-500/50 bg-amber-500/20 text-amber-600 dark:text-amber-400' : zeroCalibResult !== null ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/20'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${zeroCalibResult !== null ? 'bg-amber-500 text-white' : 'bg-amber-500/20 text-amber-500'}`}>
                    {zeroCalibResult !== null ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest transition-colors">{isZeroSampling ? t.sampling : t.zeroTitle}</span>
                  {isZeroSampling && (
                    <div ref={zeroBarRef} className="absolute bottom-0 left-0 h-1 bg-amber-500" />
                  )}
                </button>
                {zeroCalibEverRun ? (
                  <div className="flex items-center gap-2 px-4 h-16 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 font-mono text-sm min-w-[260px] justify-center">
                    {zeroCalibResult !== null ? (
                      <><span className="text-slate-400 dark:text-slate-500">Q0:</span><span className="text-cyan-600 dark:text-cyan-400 font-bold tabular-nums">{zeroCalibResult.q0}</span><span className="text-slate-400 dark:text-slate-500 ml-2">Q1:</span><span className="text-cyan-600 dark:text-cyan-400 font-bold tabular-nums">{zeroCalibResult.q1}</span><span className="text-slate-400 dark:text-slate-500 ml-2">BIAS:</span><span className="text-amber-600 dark:text-amber-400 font-bold tabular-nums">{zeroCalibResult.bias}</span></>
                    ) : (
                      <><span className="text-slate-400 dark:text-slate-500">Q0:</span><span className="text-red-400 dark:text-red-500 font-bold tabular-nums w-12 text-center">NULL</span><span className="text-slate-400 dark:text-slate-500 ml-2">Q1:</span><span className="text-red-400 dark:text-red-500 font-bold tabular-nums w-12 text-center">NULL</span><span className="text-slate-400 dark:text-slate-500 ml-2">BIAS:</span><span className="text-red-400 dark:text-red-500 font-bold tabular-nums w-12 text-center">NULL</span></>
                    )}
                  </div>
                ) : (
                  <div className="flex-1" />
                )}
              </div>
              <div className="min-h-[24px] mt-2 flex items-center justify-center">
                {zeroCalibStatus !== 'IDLE' && zeroCalibStatus && <p className={`text-xs font-bold text-center uppercase tracking-widest ${zeroCalibStatus === 'SUCCESS' ? 'text-emerald-500' : 'text-red-500'}`}>{zeroCalibStatus === 'SUCCESS' ? (language === 'zh' ? '校准成功' : 'SUCCESS') : (language === 'zh' ? '校准失败' : 'FAILED')}</p>}
              </div>
            </div>

            {/* Direction Calib Card */}
            <div className="bg-slate-50 dark:bg-black/20 rounded-3xl p-6 border border-slate-200 dark:border-white/5 transition-all">
              <h3 className="text-base font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-3">
                <Navigation size={18} className="text-cyan-500" />
                {t.dirTitle}
              </h3>
              <div className="flex flex-col gap-3">
                {["NW", "SW"].map((key) => {
                  const isCaptured = calibRefVectors[key as "SW" | "NW"] !== null;
                  const label = key === "NW" ? t.btn2 : t.btn1;
                  const isSampling = samplingStep === key;
                  const capturedVal = calibRefVectors[key as "SW" | "NW"];
                  return (
                    <div key={key} className="flex items-stretch gap-4">
                      <button
                        disabled={!connected || isSampling}
                        onClick={() => onSpatialCalibrate(key)}
                        className={`relative overflow-hidden h-16 rounded-2xl border-2 transition-all active:scale-95 flex items-center px-6 gap-4 flex-1 max-w-[360px] ${isCaptured ? 'border-cyan-500/50 bg-cyan-600/10 text-cyan-600 dark:text-cyan-400' : 'border-cyan-500/30 bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-600/20'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isCaptured ? 'bg-cyan-500 text-white' : 'bg-cyan-500/20 text-cyan-500'}`}>
                          {isCaptured ? <CheckCircle2 size={16} /> : <Crosshair size={16} />}
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest transition-colors">{isSampling ? t.sampling : label}</span>
                        {isSampling && <div className="absolute bottom-0 left-0 h-1 bg-cyan-500 transition-all duration-200" style={{ width: `${sampleProgress}%` }} />}
                      </button>
                      {isCaptured && capturedVal && (
                        <div className="flex items-center gap-2 px-4 h-16 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 font-mono text-sm justify-center">
                          <span className="text-cyan-500 dark:text-cyan-400">Q0:</span>
                          <span className="text-cyan-600 dark:text-cyan-300 font-bold tabular-nums">{Math.round(capturedVal.q0)}</span>
                          <span className="text-cyan-500 dark:text-cyan-400 ml-2">Q1:</span>
                          <span className="text-cyan-600 dark:text-cyan-300 font-bold tabular-nums">{Math.round(capturedVal.q1)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="min-h-[24px] mt-2 flex items-center justify-center">
                {["NW", "SW"].some(k => spatialCalibStatus[k] !== 'IDLE') && (
                  <p className={`text-xs font-bold text-center uppercase tracking-widest ${["NW", "SW"].some(k => spatialCalibStatus[k] === 'FAILED') ? 'text-red-500' : 'text-emerald-500'}`}>
                    {["NW", "SW"].some(k => spatialCalibStatus[k] === 'FAILED') ? (language === 'zh' ? '校准失败' : 'FAILED') : (language === 'zh' ? '校准成功' : 'SUCCESS')}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-6 flex flex-col gap-2 border-t border-slate-200 dark:border-white/5">
            <div className="flex gap-4">
              <button onClick={onResetCalibration} className="flex-1 py-4 rounded-2xl bg-red-100 dark:bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 font-black hover:bg-red-200 text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"><Trash2 size={16} /> {t.clear}</button>
              <button onClick={onConfirm} disabled={!(zeroCalibResult !== null || allCalibrated)} className={`flex-[2] py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest shadow-xl active:scale-95 ${(zeroCalibResult !== null || allCalibrated) ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600'}`}>{t.confirm}</button>
            </div>
            {!(zeroCalibResult !== null || allCalibrated) && (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center font-medium">{language === 'zh' ? '请完成零点校准或方向校准' : 'Complete zero calibration or direction calibration'}</p>
            )}
          </div>
        </div>

        <div className="hidden lg:flex flex-1 bg-slate-200/50 dark:bg-black/40 p-1 rounded-[3rem] transition-all">
          <div className="flex-grow rounded-[2.8rem] border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-950 overflow-hidden relative shadow-inner flex flex-col">
            <div className="absolute top-8 left-8">
              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Real-time Waveform</h4>
            </div>
            {debugData.length === 0 ? (
              <div className="flex-grow flex items-center justify-center text-slate-300 dark:text-slate-800 font-mono"><Signal className="animate-pulse" size={64} /></div>
            ) : (
              <div className="flex-grow p-12 flex flex-col">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-black text-cyan-600 dark:text-cyan-400 animate-pulse tracking-wide uppercase">{t.waveTip}</h3>
                </div>
                <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${POINTS_PER_FRAME} 100`} preserveAspectRatio="none">
                  <line x1="0" y1="50" x2={POINTS_PER_FRAME} y2="50" stroke="currentColor" className="text-slate-300 dark:text-white/10 transition-colors" strokeWidth="0.5" />
                  <polyline fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={debugData.map((p, i) => `${i},${100 - ((p.value + globalOffset - previewBounds.min) / previewBounds.range) * 100}`).join(' ')} className="drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
