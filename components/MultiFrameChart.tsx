
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DebugPoint } from '../types';
import { RefreshCcw, Pause, Play, GripHorizontal, Layers } from 'lucide-react';

interface MultiFrameChartProps {
  frames: DebugPoint[][]; // Array of up to 5 frames
  isPaused?: boolean;
  onTogglePause?: () => void;
}

export const MultiFrameChart: React.FC<MultiFrameChartProps> = ({ frames, isPaused = false, onTogglePause }) => {
  const [isAutoCheck, setIsAutoCheck] = useState(true);
  const [manualMin, setManualMin] = useState(10000);
  const [manualMax, setManualMax] = useState(14000);

  const allPoints = useMemo(() => {
    return frames.flat();
  }, [frames]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
            setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
        }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { min, max } = useMemo(() => {
    if (allPoints.length === 0) return { min: 0, max: 100 };
    if (isAutoCheck) {
      let dataMin = Infinity, dataMax = -Infinity;
      for (const p of allPoints) {
          if (p.value < dataMin) dataMin = p.value;
          if (p.value > dataMax) dataMax = p.value;
      }
      const range = dataMax - dataMin || 100;
      return { min: Math.floor(dataMin - range * 0.2), max: Math.ceil(dataMax + range * 0.2) };
    } else {
      return { min: manualMin, max: manualMax };
    }
  }, [allPoints, isAutoCheck, manualMin, manualMax]);

  // UPDATED: 5 frames * 103 points = 515 points
  const POINTS_PER_FRAME = 103;
  const MAX_POINTS = 5 * POINTS_PER_FRAME; 
  
  const padding = { top: 60, right: 30, bottom: 30, left: 50 }; 
  const contentWidth = Math.max(dimensions.width, 300);
  const height = Math.max(dimensions.height, 400);

  const getX = (index: number) => {
    const availableWidth = Math.max(1, contentWidth - padding.left - padding.right);
    return padding.left + (index / (MAX_POINTS - 1)) * availableWidth;
  };

  const getY = (value: number) => {
    const availableHeight = height - padding.top - padding.bottom;
    const range = max - min || 1;
    return height - padding.bottom - (((value - min) / range) * availableHeight);
  };

  const pointsString = allPoints.map((p, i) => `${getX(i)},${getY(p.value)}`).join(' ');

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 p-4 rounded-2xl backdrop-blur-sm shrink-0 gap-y-4 transition-colors">
         <div className="flex items-center gap-6">
            <h2 className="text-cyan-600 dark:text-cyan-400 font-bold flex items-center gap-2 transition-colors"><Layers size={18} />Multi-Frame (103 pts/f)</h2>
            {onTogglePause && (
              <button onClick={onTogglePause} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border transition-all ${isPaused ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-500' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}>
                {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                <span className="text-sm font-bold tracking-wide">{isPaused ? "RESUME" : "PAUSE"}</span>
              </button>
            )}
            <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isAutoCheck ? 'bg-cyan-500 border-cyan-500' : 'border-slate-400 dark:border-slate-500 bg-transparent'}`}>{isAutoCheck && <RefreshCcw size={10} className="text-white" />}</div>
                <input type="checkbox" className="hidden" checked={isAutoCheck} onChange={e => setIsAutoCheck(e.target.checked)} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors">Auto Scale</span>
            </label>
         </div>
         <div className={`flex items-center gap-3 transition-opacity ${isAutoCheck ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
            <input type="number" value={manualMin} onChange={(e) => setManualMin(Number(e.target.value))} className="w-20 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 text-right font-mono text-sm text-cyan-600 dark:text-cyan-100 transition-colors outline-none focus:border-cyan-500" />
            <span className="text-slate-400 dark:text-slate-700">-</span>
            <input type="number" value={manualMax} onChange={(e) => setManualMax(Number(e.target.value))} className="w-20 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 text-right font-mono text-sm text-cyan-600 dark:text-cyan-100 transition-colors outline-none focus:border-cyan-500" />
         </div>
      </div>

      <div ref={containerRef} className={`relative flex-grow w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner transition-colors duration-500 ${isPaused ? 'border-amber-500/50' : ''}`}>
         {isPaused && <div className="absolute left-4 top-4 z-20 px-3 py-1 bg-amber-500 text-amber-950 font-bold rounded animate-pulse flex items-center gap-2 pointer-events-none"><GripHorizontal size={14} />PAUSED</div>}
         {allPoints.length === 0 ? (
             <div className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-600 font-mono animate-pulse">WAITING FOR DATA (515 PTS TOTAL)...</div>
         ) : (
            <div style={{ width: contentWidth, height: '100%' }}>
                <svg viewBox={`0 0 ${contentWidth} ${height}`} className="w-full h-full select-none">
                    <rect x="0" y="0" width={contentWidth} height={padding.top} fill="currentColor" className="text-slate-200 dark:text-slate-900 transition-colors" fillOpacity="0.5" />
                    <line x1="0" y1={padding.top} x2={contentWidth} y2={padding.top} stroke="currentColor" className="text-slate-300 dark:text-slate-800 transition-colors" strokeWidth="2" />
                    {[1, 2, 3, 4].map((frameIdx) => {
                        const x = getX(frameIdx * POINTS_PER_FRAME);
                        return (
                            <g key={frameIdx}>
                                <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="currentColor" className="text-slate-300 dark:text-slate-700 transition-colors" strokeDasharray="4 4" strokeWidth="1" />
                                <text x={x + 5} y={padding.top - 10} className="fill-slate-500 dark:fill-slate-600 text-[10px] font-mono transition-colors">FRAME {frameIdx + 1}</text>
                            </g>
                        );
                    })}
                    <text x={getX(0)} y={padding.top - 10} className="fill-slate-500 dark:fill-slate-600 text-[10px] font-mono transition-colors">FRAME 1</text>
                    {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                        const y = getY(min + tick * (max - min));
                        return (
                            <g key={tick}>
                                <line x1={padding.left} y1={y} x2={contentWidth - padding.right} y2={y} stroke="currentColor" className="text-slate-200 dark:text-slate-800 transition-colors" strokeDasharray="4 4" />
                                <text x={padding.left - 10} y={y + 4} textAnchor="end" className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono transition-colors">{Math.round(min + tick * (max - min))}</text>
                            </g>
                        );
                    })}
                    <polyline points={pointsString} fill="none" stroke={isPaused ? "#f59e0b" : "#0ea5e9"} strokeWidth="1.5" strokeLinejoin="round" className="drop-shadow-[0_0_4px_rgba(14,165,233,0.3)] dark:drop-shadow-[0_0_4px_rgba(34,211,238,0.3)] stroke-[#0ea5e9] dark:stroke-[#22d3ee] transition-colors" />
                </svg>
            </div>
         )}
      </div>
      <div className="text-center text-xs text-slate-400 dark:text-slate-500 font-mono transition-colors">Points: {allPoints.length} / {MAX_POINTS} | Frames: {frames.length}/5</div>
    </div>
  );
};
