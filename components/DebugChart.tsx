
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DebugPoint } from '../types';
import { getWindowAvg } from '../utils/dsp';
import { 
  Settings2, Pause, Play, GripHorizontal, 
  ArrowDownLeft, ArrowDownRight, ArrowUpLeft, ArrowUpRight, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Zap, Navigation, Target, AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';

interface DebugChartProps {
  data: DebugPoint[];
  isPaused?: boolean;
  onTogglePause?: () => void;
  win1Index: number;
  win2Index: number;
  onWin1IndexChange: (n: number) => void;
  onWin2IndexChange: (n: number) => void;
  win1Offset: number;
  onWin1OffsetChange: (n: number) => void;
  win2Offset: number;
  onWin2OffsetChange: (n: number) => void;
  globalOffset: number;
  onGlobalOffsetChange: (n: number) => void;
  directionMap: { ref: number, heading: number }[];
  calibMatrix: [number, number, number, number];
  
  // New props for Zero Calibration (lifted state)
  onZeroCalibrate: () => void;
  isZeroSampling: boolean;
  zeroCalibStatus: 'IDLE' | 'SUCCESS' | 'FAILED';
}

const POINTS_PER_FRAME = 103;

const DIRECTION_UI_INFO = [
    { heading: 0, label: "NORTH", Icon: ArrowUp },
    { heading: 45, label: "NE", Icon: ArrowUpRight },
    { heading: 90, label: "EAST", Icon: ArrowRight },
    { heading: 135, label: "SE", Icon: ArrowDownRight },
    { heading: 180, label: "SOUTH", Icon: ArrowDown },
    { heading: 225, label: "SW", Icon: ArrowDownLeft },
    { heading: 270, label: "WEST", Icon: ArrowLeft },
    { heading: 315, label: "NW", Icon: ArrowUpLeft },
];

export const DebugChart: React.FC<DebugChartProps> = ({ 
    data, isPaused = false, onTogglePause,
    win1Index, win2Index, onWin1IndexChange, onWin2IndexChange,
    win1Offset, onWin1OffsetChange,
    win2Offset, onWin2OffsetChange,
    globalOffset, onGlobalOffsetChange,
    directionMap, calibMatrix,
    onZeroCalibrate, isZeroSampling, zeroCalibStatus
}) => {
  const [draggingWindow, setDraggingWindow] = useState<1 | 2 | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { min, max } = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 100 };
    let dataMin = Infinity; let dataMax = -Infinity;
    for (const p of data) {
        const val = p.value + globalOffset;
        if (val < dataMin) dataMin = val;
        if (val > dataMax) dataMax = val;
    }
    const range = Math.max(40, dataMax - dataMin);
    return { min: Math.floor(dataMin - range * 0.12), max: Math.ceil(dataMax + range * 0.12) };
  }, [data, globalOffset]);

  const padding = { top: 30, right: 30, bottom: 50, left: 80 }; 
  const contentWidth = Math.max(dimensions.width, 300);
  const contentHeight = Math.max(dimensions.height, 240); // Optimized for 16:9 ratio

  const getX = (index: number) => {
    const availableWidth = Math.max(1, contentWidth - padding.left - padding.right);
    return padding.left + (index / (POINTS_PER_FRAME - 1)) * availableWidth;
  };

  const getY = (value: number) => {
    const availableHeight = contentHeight - padding.top - padding.bottom;
    const range = max - min || 1;
    const normalized = (value - min) / range;
    return contentHeight - padding.bottom - (normalized * availableHeight);
  };

  const win1BaseVal = useMemo(() => getWindowAvg(data, win1Index, globalOffset), [win1Index, data, globalOffset]);
  const win2BaseVal = useMemo(() => getWindowAvg(data, win2Index, globalOffset), [win2Index, data, globalOffset]);

  const rawQ0 = win1BaseVal + win1Offset;
  const rawQ1 = win2BaseVal + win2Offset;
  const corrQ0 = rawQ0 * calibMatrix[0] + rawQ1 * calibMatrix[1];
  const corrQ1 = rawQ0 * calibMatrix[2] + rawQ1 * calibMatrix[3];

  const rawAngle = useMemo(() => Math.atan2(corrQ1, corrQ0) * 180 / Math.PI, [corrQ0, corrQ1]);
  const calibratedHeading = useMemo(() => {
    if (data.length === 0) return 0;
    let minDiff = Infinity, bestHeading = 0;
    for (const item of directionMap) {
        let diff = Math.abs(rawAngle - item.ref);
        if (diff > 180) diff = 360 - diff;
        if (diff < minDiff) { minDiff = diff; bestHeading = item.heading; }
    }
    return bestHeading;
  }, [rawAngle, data.length, directionMap]);

  const directionInfo = useMemo(() => {
    const uiInfo = DIRECTION_UI_INFO.find(u => u.heading === calibratedHeading) || DIRECTION_UI_INFO[0];
    const iconProps = { size: 48, strokeWidth: 2.5, className: "text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.7)]" };
    return { icon: data.length > 0 ? <uiInfo.Icon {...iconProps} /> : null, text: data.length > 0 ? uiInfo.label : "--" };
  }, [calibratedHeading, data.length]);

  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (draggingWindow === null) return;
    const handleMove = (e: any) => {
        if (!svgRef.current) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const rect = svgRef.current.getBoundingClientRect();
        const availableWidth = contentWidth - padding.left - padding.right;
        const index = Math.round(((clientX - rect.left - padding.left) / availableWidth) * (POINTS_PER_FRAME - 1));
        const clampedIndex = Math.max(0, Math.min(POINTS_PER_FRAME - 1, index));
        if (draggingWindow === 1) onWin1IndexChange(clampedIndex);
        else onWin2IndexChange(clampedIndex);
    };
    const handleUp = () => setDraggingWindow(null);
    window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false }); window.addEventListener('touchend', handleUp);
    return () => {
        window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleUp);
    };
  }, [draggingWindow, contentWidth]);

  const renderWindowOverlay = (startIndex: number, colorClass: string, id: 1 | 2) => {
      if (data.length === 0) return null;
      const handleX = getX(startIndex);
      const isDragging = draggingWindow === id;
      return (
          <g>
              <g className={`cursor-grab active:cursor-grabbing group/handle ${!isPaused ? 'opacity-20 pointer-events-none' : ''}`} onMouseDown={() => setDraggingWindow(id)} onTouchStart={() => setDraggingWindow(id)}>
                  <rect x={handleX - 15} y={padding.top - 20} width={30} height={contentHeight - padding.top - padding.bottom + 20} fill="transparent" />
                  <rect x={handleX - 12} y={padding.top - 20} width={24} height={18} rx={4} className={`${colorClass} ${isDragging ? 'fill-current' : 'fill-slate-950 stroke-current'} transition-all duration-200`} />
                  <GripHorizontal size={12} x={handleX - 6} y={padding.top - 17} className={`${isDragging ? 'text-slate-950' : colorClass}`} />
                  <line x1={handleX} y1={padding.top} x2={handleX} y2={contentHeight - padding.bottom} className={`stroke-current ${colorClass} ${isDragging ? 'opacity-100' : 'opacity-40'}`} strokeWidth={isDragging ? 2 : 1} />
                  <text x={handleX} y={padding.top - 28} textAnchor="middle" className={`${colorClass} text-[10px] font-black font-mono select-none drop-shadow-[0_0_4px_black]`}>WIN{id}</text>
              </g>
          </g>
      );
  };

  const pointsString = useMemo(() => data.map((p, i) => `${getX(i).toFixed(1)},${getY(p.value + globalOffset).toFixed(1)}`).join(' '), [data, min, max, contentWidth, contentHeight, globalOffset]);
  const areaPointsString = useMemo(() => data.length === 0 ? "" : `${getX(0)},${contentHeight-padding.bottom} ${pointsString} ${getX(data.length-1)},${contentHeight-padding.bottom}`, [pointsString, contentHeight, padding.bottom]);

  return (
    <div className="w-full h-full flex flex-col gap-6 relative min-h-0">
      {/* Control Panel with Instrument Gauges (RESTORED SIZE) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-300 dark:border-white/5 p-6 rounded-[2.5rem] backdrop-blur-2xl shrink-0 items-center shadow-2xl transition-colors duration-300">
         <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl text-cyan-600 dark:text-cyan-400 border border-slate-300 dark:border-white/5"><Settings2 size={24} /></div>
                <div className="flex gap-3">
                  <button onClick={onTogglePause} className={`flex items-center gap-2 px-6 py-3 rounded-2xl border text-[11px] font-black tracking-widest transition-all ${isPaused ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-500 shadow-xl' : 'bg-white dark:bg-slate-800/50 border-slate-300 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />} {isPaused ? "RESUME" : "PAUSE"}
                  </button>
                  <button onClick={onZeroCalibrate} disabled={isZeroSampling} className={`flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all text-[11px] font-black tracking-widest shadow-inner ${isZeroSampling ? 'bg-cyan-100 dark:bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-cyan-300 dark:border-cyan-500/40 bg-white dark:bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-600/20'}`}>
                      {isZeroSampling ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />} 
                      {isZeroSampling ? "SAMPLING..." : "ZERO CALIB"}
                  </button>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-white dark:bg-slate-950/80 p-3 rounded-2xl border border-slate-300 dark:border-white/5 shadow-inner transition-colors duration-300">
                    <div className="flex items-center gap-2 pr-4 border-r border-slate-300 dark:border-white/5"><Zap size={16} className="text-amber-500" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bias</span></div>
                    <input type="number" value={globalOffset} onChange={(e) => onGlobalOffsetChange(Number(e.target.value))} className="w-24 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/5 rounded-xl px-3 py-1 text-center font-mono text-[13px] outline-none text-cyan-600 dark:text-cyan-400 focus:border-cyan-500/50 transition-colors" />
                </div>
                {zeroCalibStatus !== 'IDLE' && (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black animate-in fade-in slide-in-from-left-2 ${zeroCalibStatus === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                        {zeroCalibStatus === 'SUCCESS' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        {zeroCalibStatus === 'SUCCESS' ? "BIAS CALIB" : "FAILED"}
                    </div>
                )}
            </div>
         </div>

         {/* Restored 3 HUD Gauges - Larger Visual Presence */}
         <div className="flex justify-center items-center gap-10 lg:px-10">
            <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-800 shadow-[0_0_20px_rgba(0,0,0,0.1),inset_0_0_20px_rgba(0,0,0,0.03)] dark:shadow-[0_0_40px_rgba(0,0,0,0.6),inset_0_0_20px_rgba(255,255,255,0.03)] flex items-center justify-center transition-colors duration-300">
                 <div className="absolute top-3 text-[8px] font-black text-slate-400 dark:text-slate-600 tracking-widest uppercase font-mono">STATUS</div>
                 <div className="z-10 animate-in zoom-in duration-300">{directionInfo.icon || <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />}</div>
                 <div className="absolute bottom-3"><span className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tighter drop-shadow-md">{directionInfo.text}</span></div>
            </div>
            <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-800 shadow-[0_0_20px_rgba(0,0,0,0.1),inset_0_0_20px_rgba(0,0,0,0.03)] dark:shadow-[0_0_40px_rgba(0,0,0,0.6),inset_0_0_20px_rgba(255,255,255,0.03)] flex items-center justify-center overflow-hidden transition-colors duration-300">
                 <div className="absolute top-3 text-[8px] font-black text-slate-400 dark:text-slate-600 tracking-widest uppercase font-mono">ANGLE</div>
                 <div className="absolute inset-0 flex items-center justify-center transition-transform duration-300 ease-out" style={{ transform: `rotate(${-rawAngle}deg)` }}>
                    <div className="w-1 h-1/2 bg-amber-500 shadow-[0_0_15px_#f59e0b] origin-bottom -translate-y-1/2 opacity-80"></div>
                 </div>
                 <div className="z-10 bg-white/95 dark:bg-slate-950/95 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 shadow-2xl backdrop-blur-md">
                    <span className="text-base font-mono font-black text-amber-500 tabular-nums">{data.length > 0 ? Math.round(rawAngle) : "--"}°</span>
                 </div>
            </div>
            <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-white dark:bg-slate-950 border-2 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.1)] flex items-center justify-center overflow-hidden transition-colors duration-300">
                 <div className="absolute top-3 text-[8px] font-black text-cyan-600/50 dark:text-cyan-500/50 tracking-widest uppercase font-mono">MAP</div>
                 <div className="absolute inset-0 flex items-center justify-center transition-transform duration-700 cubic-bezier(0.19, 1, 0.22, 1)" style={{ transform: `rotate(${calibratedHeading}deg)` }}><div className="w-2 h-1/2 bg-cyan-500 dark:bg-cyan-400 shadow-[0_0_25px_#22d3ee] origin-bottom -translate-y-1/2 rounded-full"></div></div>
                 <div className="z-10 bg-white/95 dark:bg-slate-950/95 p-3 rounded-full border border-cyan-500/40 shadow-2xl">
                    <Navigation size={22} className="text-cyan-500 dark:text-cyan-400" />
                 </div>
            </div>
         </div>

         <div className="flex flex-col gap-3">
            <div className="flex items-center justify-end gap-4">
                <div className="bg-white dark:bg-slate-950/95 px-6 py-3 rounded-2xl border border-slate-300 dark:border-emerald-500/20 min-w-[150px] flex flex-col items-center shadow-inner group transition-all dark:hover:border-emerald-500/40">
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-500 font-black uppercase tracking-[0.2em] mb-1 opacity-70">Q0 CHANNEL</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-mono font-black text-slate-800 dark:text-white leading-none tracking-tight">{corrQ0.toFixed(1)}</span>
                        <span className="text-xs font-mono text-emerald-600/50 dark:text-emerald-500/50" title="校正前">({rawQ0.toFixed(0)})</span>
                    </div>
                </div>
                <input type="number" value={win1Offset} onChange={(e) => onWin1OffsetChange(Number(e.target.value))} className="w-20 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-white/5 rounded-xl py-2.5 text-[13px] font-mono text-emerald-600 dark:text-emerald-400 text-center outline-none focus:border-emerald-500/50 dark:focus:bg-slate-800 transition-all shadow-inner" />
            </div>
            <div className="flex items-center justify-end gap-4">
                <div className="bg-white dark:bg-slate-950/95 px-6 py-3 rounded-2xl border border-slate-300 dark:border-violet-500/20 min-w-[150px] flex flex-col items-center shadow-inner group transition-all dark:hover:border-violet-500/40">
                    <span className="text-[9px] text-violet-600 dark:text-violet-500 font-black uppercase tracking-[0.2em] mb-1 opacity-70">Q1 CHANNEL</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-mono font-black text-slate-800 dark:text-white leading-none tracking-tight">{corrQ1.toFixed(1)}</span>
                        <span className="text-xs font-mono text-violet-600/50 dark:text-violet-500/50" title="校正前">({rawQ1.toFixed(0)})</span>
                     </div>
                </div>
                <input type="number" value={win2Offset} onChange={(e) => onWin2OffsetChange(Number(e.target.value))} className="w-20 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-white/5 rounded-xl py-2.5 text-[13px] font-mono text-violet-600 dark:text-violet-400 text-center outline-none focus:border-violet-500/50 dark:focus:bg-slate-800 transition-all shadow-inner" />
            </div>
         </div>
      </div>

      {/* Waveform View Adjusted to optimize overall layout ratio to ~16:9 */}
      <div ref={containerRef} className="relative flex-grow min-h-[240px] max-h-[320px] w-full bg-slate-100 dark:bg-[#030712] border border-slate-300 dark:border-slate-800/60 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col transition-colors duration-500">
         {data.length === 0 ? (
             <div className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-800 font-mono uppercase text-sm tracking-[0.4em] animate-pulse">Signal Monitoring Offline</div>
         ) : (
            <svg ref={svgRef} viewBox={`0 0 ${contentWidth} ${contentHeight}`} className="w-full h-full select-none" preserveAspectRatio="none">
                <defs><linearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2" /><stop offset="100%" stopColor="#22d3ee" stopOpacity="0" /></linearGradient></defs>
                <g className="text-slate-400 dark:text-slate-500 font-mono text-[11px] font-bold transition-colors">
                    <line x1={padding.left} y1={padding.top} x2={padding.left} y2={contentHeight - padding.bottom} stroke="currentColor" opacity="0.3" strokeWidth="2" />
                    {[min, (min + max) / 2, max].map((val, i) => {
                        const y = getY(val);
                        return (
                            <g key={i}>
                                <line x1={padding.left - 8} y1={y} x2={contentWidth - padding.right} y2={y} stroke="currentColor" opacity="0.1" strokeDasharray="6 6" />
                                <text x={padding.left - 15} y={y + 5} textAnchor="end" fill="currentColor">{Math.round(val)}</text>
                            </g>
                        );
                    })}
                    <line x1={padding.left} y1={contentHeight - padding.bottom} x2={contentWidth - padding.right} y2={contentHeight - padding.bottom} stroke="currentColor" opacity="0.3" strokeWidth="2" />
                    {[0, 25, 50, 75, 102].map((idx) => {
                        const x = getX(idx);
                        return (
                            <g key={idx}>
                                <line x1={x} y1={contentHeight - padding.bottom} x2={x} y2={contentHeight - padding.bottom + 8} stroke="currentColor" opacity="0.3" strokeWidth="2" />
                                <text x={x} y={contentHeight - padding.bottom + 24} textAnchor="middle" fill="currentColor">{idx}</text>
                            </g>
                        );
                    })}
                </g>
                <polygon points={areaPointsString} fill="url(#waveGradient)" />
                <polyline points={pointsString} fill="none" stroke={isPaused ? "#f59e0b" : "#0ea5e9"} strokeWidth="3" strokeLinejoin="round" className="drop-shadow-[0_0_10px_rgba(14,165,233,0.3)] dark:drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                {renderWindowOverlay(win1Index, "text-emerald-600 dark:text-emerald-500 fill-emerald-600 dark:fill-emerald-500", 1)}
                {renderWindowOverlay(win2Index, "text-violet-600 dark:text-violet-500 fill-violet-600 dark:fill-violet-500", 2)}
            </svg>
         )}
      </div>
    </div>
  );
};
