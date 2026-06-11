
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { CompassData, Language } from '../types';
import {
  Unplug, Zap, CheckCircle2, Settings2,
  ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight,
  ArrowUp, ArrowRight, ArrowDown, ArrowLeft, Scale, Navigation
} from 'lucide-react';

/**
 * 罗盘组件属性定义
 */
interface CompassProps {
  data: CompassData;                          // 当前帧的校准后数据（包含原始Q0/Q1、修正后的幅值、方向角等）
  connected: boolean;                         // 串口是否处于连接状态
  threshold: number;                          // 目标信号检测阈值（用于判断“在附近”）
  onThresholdChange: (val: number) => void;   // 灵敏度阈值拖拽修改后的回调函数
  thresholdMin: number;                       // 滑块允许的最小阈值
  thresholdMax: number;                       // 滑块允许的最大阈值
  thresholdStep: number;                      // 滑块拖动时的步长对齐值

  // 系统配置与国际化
  probeThreshold: number;                     // 探针断开判定阈值（基于未修正的原始数据评估底噪大小）
  language: Language;                         // 当前界面语言（'zh' | 'en'）
}

// --- 垂直仪表板滑块组件 (HUD 风格) ---
/**
 * 垂直滑块组件属性定义
 */
interface VerticalSliderProps {
  value: number;                              // 当前滑块的值
  onChange: (v: number) => void;              // 滑块数值变化的回调
  min: number;                                // 滑动范围最小值
  max: number;                                // 滑动范围最大值
  step?: number;                              // 步进值（如为 1 则只能调节整数）
  themeColor: string;                         // UI 主题颜色类名（如 Tailwind 的 "text-cyan-400"）
}

/**
 * 垂直仪表板滑块组件 (HUD 风格)
 * 提供鼠标拖拽 + 触摸滑动两种交互方式，数值以百分比映射到轨道高度，
 * 视觉上包含填充条、刻度线和可拖拽的滑块手柄。
 */
const VerticalSlider: React.FC<VerticalSliderProps> = ({ value, onChange, min, max, step = 1, themeColor }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  /**
   * 处理滑块移动事件
   * 通过鼠标或触摸的 Y 坐标，计算其在整个轨道高度中的百分比位置，
   * 进而将其线性映射到 [min, max] 的数值区间。
   * 
   * @param clientY - 当前触发点的屏幕绝对 Y 坐标
   */
  const handleMove = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();

    // DOM 坐标系下 Y 轴向下递增，而滑块数值是从下向上递增
    // 因此使用底边坐标减去当前 Y 坐标，得到距离底部的绝对像素高度
    const yFromBottom = rect.bottom - clientY;
    let percentage = yFromBottom / rect.height;

    // 钳制百分比范围，防止鼠标拖出轨道边界导致数值越界
    if (percentage < 0) percentage = 0;
    if (percentage > 1) percentage = 1;

    // 根据百分比线性插值计算实际数值
    let newValue = min + percentage * (max - min);

    // 根据传入的 step 对齐数值（例如 step 为 10 时，结果锁定在 10 的整数倍）
    if (step > 0) {
      newValue = Math.round(newValue / step) * step;
    } else {
      newValue = Math.round(newValue);
    }

    // 二次安全钳制，并触发更新
    newValue = Math.max(min, Math.min(max, newValue));
    onChange(newValue);
  };

  /**
   * 鼠标按下事件处理
   * 激活拖拽状态并立即计算首次按下的位置
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMove(e.clientY);
  };

  /**
   * 移动端触摸事件处理
   * 激活拖拽状态并获取第一个触点的 Y 坐标
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleMove(e.touches[0].clientY);
  };

  /**
   * 全局拖拽事件监听
   * 当滑块处于激活状态时，在 window 上挂载移动和松开事件。
   * 这样即使用户在拖拽过程中鼠标移出了滑块本身的 DOM 区域，依然能持续接收坐标更新。
   */
  useEffect(() => {
    if (isDragging) {
      // 封装对应的原生事件处理器
      const moveMouse = (e: MouseEvent) => handleMove(e.clientY);
      const upMouse = () => setIsDragging(false);
      const moveTouch = (e: TouchEvent) => handleMove(e.touches[0].clientY);
      const upTouch = () => setIsDragging(false);

      window.addEventListener('mousemove', moveMouse);
      window.addEventListener('mouseup', upMouse);
      // touchmove 必须设置 passive: false，以便在极端情况下能够调用 preventDefault 阻止页面滚动
      window.addEventListener('touchmove', moveTouch, { passive: false });
      window.addEventListener('touchend', upTouch);

      // 组件卸载或拖拽结束时清理全局监听器，防止内存泄漏和事件重复触发
      return () => {
        window.removeEventListener('mousemove', moveMouse);
        window.removeEventListener('mouseup', upMouse);
        window.removeEventListener('touchmove', moveTouch);
        window.removeEventListener('touchend', upTouch);
      };
    }
  }, [isDragging]);

  // 计算滑块填充层的视觉高度百分比
  const percent = Math.max(0, Math.min(1, (value - min) / (max - min))) * 100;

  return (
    <div className="h-full flex flex-col items-center justify-center select-none group w-full">
      <div className={`mb-4 text-[10px] font-mono tracking-widest transition-colors ${themeColor} opacity-70`}>THOLD</div>

      <div
        ref={trackRef}
        className="relative w-full flex-1 cursor-ns-resize flex justify-center py-2"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className={`absolute top-2 bottom-2 w-[2px] bg-slate-800 rounded-full overflow-hidden`}>
          <div
            className={`absolute bottom-0 left-0 right-0 transition-all duration-75 opacity-50 bg-current ${themeColor}`}
            style={{ height: `${percent}%` }}
          />
        </div>

        <div className="absolute top-2 bottom-2 left-1/2 ml-3 flex flex-col justify-between pointer-events-none opacity-30">
          {[...Array(11)].map((_, i) => (
            <div key={i} className={`w-2 h-[1px] ${themeColor}`}></div>
          ))}
        </div>

        <div
          className={`
                        absolute left-1/2 -translate-x-1/2 
                        w-10 h-6 
                        border bg-slate-950 
                        flex items-center justify-center 
                        transition-all duration-75
                        ${isDragging ? 'scale-110' : ''}
                        border-current ${themeColor}
                        shadow-[0_0_10px_currentColor]
                    `}
          style={{ bottom: `calc(${percent}% - 12px)`, color: 'inherit' }}
        >
          <div className={`w-6 h-[1px] bg-current ${themeColor}`}></div>
        </div>
      </div>

      <div className={`mt-4 font-mono text-sm font-bold transition-colors ${themeColor}`}>
        {value}
      </div>
    </div>
  );
};

/**
 * 罗盘 HUD 组件 — 4 种模式：离线 / 表笔断开 / 短路附近 / 导航中
 * data.heading 为罗盘角度（0°=北/正上，90°=东/正右，顺时针递增）
 * 由 App.tsx 中 DEFAULT_MAP 通过 heading=(360-ref)%360 公式从 atan2 角度转换而来
 * visualHeading 通过最短旋转路径插值实现平滑指针旋转
 */
export const Compass: React.FC<CompassProps> = ({
  data, connected,
  threshold, onThresholdChange,
  thresholdMin, thresholdMax, thresholdStep,
  probeThreshold, language
}) => {
  // 最短旋转路径插值：避免指针从 359° 直接跳到 1° 时逆时针大转
  const [visualHeading, setVisualHeading] = useState(0);

  useEffect(() => {
    setVisualHeading(prev => {
      const target = data.heading;
      let diff = target - (prev % 360);
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      return prev + diff;
    });
  }, [data.heading]);

  /**
   * 探针连接状态判定：
   * 1. 正常脱机（底噪）：双通道 DSP 均值低于 probeThreshold 阈值
   * 2. 信号异常波动：全帧原始 ADC 极差（frameRange）超过门限，表明存在有效信号波动而非纯底噪
   * 3. 硬件溢出保护：原始值突破硬件安全量程（绝对值 > 25000），强制断开以保护 UI
   */
  const FRAME_RANGE_DISCONNECT = 20000;
  const isProbeDisconnected = (data.rawQ0 < probeThreshold && data.rawQ1 < probeThreshold)
    || (data.frameRange !== undefined && data.frameRange > FRAME_RANGE_DISCONNECT)
    || Math.abs(data.rawQ0) > 25000 || Math.abs(data.rawQ1) > 25000;

  /**
   * 接近判定（连续帧防抖）：
   * magnitude 低于阈值时递增计数器，高于阈值时递减；
   * 计数器达到 +N 才进入 nearby，降至 -N 才退出，中间区间保持上一状态不变。
   */
  const nearbyCounterRef = useRef(0);
  const nearbyStateRef = useRef(false); // 记录当前 nearby 状态，仅在计数器达到阈值时翻转
  const nearbyFrames = 5;
  const isNearby = (() => {
    if (data.magnitude < threshold) {
      nearbyCounterRef.current = Math.min(nearbyCounterRef.current + 1, nearbyFrames);
    } else {
      nearbyCounterRef.current = Math.max(nearbyCounterRef.current - 1, -nearbyFrames);
    }
    if (nearbyCounterRef.current >= nearbyFrames) nearbyStateRef.current = true;
    else if (nearbyCounterRef.current <= -nearbyFrames) nearbyStateRef.current = false;
    return nearbyStateRef.current;
  })();

  // 是否因全帧极差异常波动触发表笔断开（区别于底噪过低导致的断开）
  const isFrameRangeDisconnect = data.frameRange !== undefined && data.frameRange > FRAME_RANGE_DISCONNECT;

  /**
   * 罗盘四态状态机（优先级自上而下）：
   * 1. offline: 串口物理断开
   * 2. disconnected: 串口连接但表笔悬空/读数溢出
   * 3. nearby: 探测到短路点就在附近（达到阈值）
   * 4. navigating: 正常导航，依据方向角指示短路点相对方位
   */
  let mode: 'offline' | 'disconnected' | 'nearby' | 'navigating' = 'navigating';
  if (!connected) mode = 'offline';
  else if (isProbeDisconnected) mode = 'disconnected';
  else if (isNearby) mode = 'nearby';
  else mode = 'navigating';

  /**
   * 八向方位导航指令国际化映射
   * 输入的 data.heading 符合标准罗盘地理惯例：0°=正上方，90°=正右方，顺时针递增。
   */
  const getMoveInstruction = () => {
    let dirText = "";
    const h = data.heading;

    const dirs: Record<number, string> = language === 'zh' ? {
      0: "正上方", 45: "右上方", 90: "正右方", 135: "右下方",
      180: "正下方", 225: "左下方", 270: "正左方", 315: "左上方"
    } : {
      0: "NORTH", 45: "NORTH EAST", 90: "EAST", 135: "SOUTH EAST",
      180: "SOUTH", 225: "SOUTH WEST", 270: "WEST", 315: "NORTH WEST"
    };

    dirText = dirs[h] || (language === 'zh' ? "正在解析..." : "CALCULATING...");
    return language === 'zh' ? `请向${dirText}移动` : `MOVE ${dirText}`;
  };

  /**
   * UI 主题与配置字典映射
   * 根据当前状态机推导出的 mode，动态返回配套的 Tailwind 样式类名、动画、图标和文本。
   * 这种统一配置的方式避免了在 JSX 中写大量的嵌套三元表达式。
   */
  const theme = useMemo(() => {
    switch (mode) {
      // 1. 设备未连接物理串口（灰色冷漠态）
      case 'offline':
        return {
          primary: 'text-slate-500',
          border: 'border-slate-700',
          ringStatic: 'border-slate-600',
          glow: 'shadow-none',
          bg: 'bg-slate-900/90',
          icon: <Unplug size={48} className="text-slate-600 mb-3" />,
          title: language === 'zh' ? '设备未连接' : 'DEVICE DISCONNECTED',
          sub: null,
          gridColor: 'bg-[radial-gradient(#334155_1px,transparent_1px)]',
        };
      // 2. 表笔悬空或读数溢出（红色警报态，带脉冲动画）
      case 'disconnected':
        return {
          primary: 'text-red-500',
          border: 'border-red-800/50',
          ringStatic: 'border-red-900/50',
          glow: 'shadow-[0_0_15px_rgba(239,68,68,0.2)]',
          bg: 'bg-red-950/90',
          icon: (
            <div className="relative mb-3">
              <Zap size={48} className="text-red-500 relative z-10" fill="currentColor" />
              <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping"></div>
            </div>
          ),
          title: language === 'zh' ? '表笔未连接' : 'PROBE DISCONNECTED',
          sub: isFrameRangeDisconnect
            ? (language === 'zh' ? '请检查表笔测试夹是否接触良好' : 'Check probe clip contact')
            : null,
          gridColor: 'bg-[radial-gradient(#7f1d1d_1px,transparent_1px)]',
        };
      // 3. 极度靠近短路点（绿色成功态）
      case 'nearby':
        return {
          primary: 'text-emerald-400',
          border: 'border-emerald-700/50',
          ringStatic: 'border-emerald-800/50',
          glow: 'shadow-[0_0_20px_rgba(16,185,129,0.2)]',
          bg: 'bg-emerald-950/90',
          icon: <CheckCircle2 size={48} className="text-emerald-500 mb-3 opacity-80" />,
          title: language === 'zh' ? '短路点在此附近' : 'SHORT CIRCUIT NEARBY',
          sub: null,
          gridColor: 'bg-[radial-gradient(#065f46_1px,transparent_1px)]',
        };
      // 4. 正常指向导航中（青色科技态）
      case 'navigating':
      default:
        return {
          primary: 'text-cyan-400',
          border: 'border-cyan-800/60',
          ringStatic: 'border-cyan-500',
          glow: 'shadow-[0_0_15px_rgba(6,182,212,0.2)]',
          bg: 'bg-cyan-950/90',
          icon: <Navigation size={48} className="text-cyan-400 mb-3" />,
          title: getMoveInstruction(),
          sub: null,
          gridColor: 'bg-[radial-gradient(#155e75_1px,transparent_1px)]',
        };
    }
  }, [mode, data.magnitude, data.heading, language, isFrameRangeDisconnect]);

  return (
    <div className="w-full max-w-[660px] h-full flex flex-row items-stretch justify-center gap-6 px-4">

      <div className="
        relative flex-grow rounded-[3rem] 
        border border-slate-300 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40 shadow-xl
        flex flex-col items-center
        transition-all duration-300 ease-in-out
        py-12 px-8
        min-h-0
        overflow-hidden
      ">

        <div className="absolute top-6 left-6 w-4 h-4 border-t-2 border-l-2 border-slate-400 dark:border-slate-700 opacity-50 dark:opacity-50"></div>
        <div className="absolute top-6 right-6 w-4 h-4 border-t-2 border-r-2 border-slate-400 dark:border-slate-700 opacity-50 dark:opacity-50"></div>
        <div className="absolute bottom-6 left-6 w-4 h-4 border-b-2 border-l-2 border-slate-400 dark:border-slate-700 opacity-50 dark:opacity-50"></div>
        <div className="absolute bottom-6 right-6 w-4 h-4 border-b-2 border-r-2 border-slate-400 dark:border-slate-700 opacity-50 dark:opacity-50"></div>

        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none rounded-[3rem]" />

        <div className="z-10 w-full h-32 flex flex-col items-center justify-center text-center mb-16 transition-all duration-300">
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
            {theme.icon}
            <h2 className="text-3xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight whitespace-nowrap transition-colors">
              {theme.title}
            </h2>
            {theme.sub && (
              <div className="mt-3 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full shadow-sm transition-colors">
                <p className="text-[11px] font-black tracking-widest text-red-500 dark:text-red-400 transition-colors">
                  {theme.sub}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="relative w-full max-w-[260px] aspect-square flex-shrink-0 flex items-center justify-center z-10 mb-16 transition-all duration-300">
          <svg className="absolute inset-[-10%] w-[120%] h-[120%] animate-[spin_120s_linear_infinite] opacity-30 dark:opacity-30" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 3" className="text-slate-600 dark:text-slate-400" />
          </svg>
          <div className={`absolute inset-0 rounded-full border-[4px] dark:border-2 ${theme.border} opacity-100 transition-all duration-300 ${theme.glow} shadow-[inset_0_0_30px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]`} />
          <div className={`absolute inset-[15%] rounded-full border-[4px] dark:border-2 ${theme.ringStatic} opacity-100 transition-colors`} />
          <div className={`absolute inset-3 rounded-full border-[4px] dark:border-[3px] ${theme.border} opacity-100 border-dashed transition-colors ${connected ? 'animate-[spin_60s_linear_infinite]' : ''}`} />

          {mode === 'navigating' && (
            <>
              <ArrowUp className={`absolute top-[12%] left-1/2 -translate-x-1/2 w-6 h-6 transition-all ${data.heading === 0 ? theme.primary + ' scale-125 drop-shadow-[0_0_8px_currentColor]' : 'text-slate-400 dark:text-slate-700'}`} />
              <ArrowRight className={`absolute top-1/2 right-[12%] -translate-y-1/2 w-6 h-6 transition-all ${data.heading === 90 ? theme.primary + ' scale-125 drop-shadow-[0_0_8px_currentColor]' : 'text-slate-400 dark:text-slate-700'}`} />
              <ArrowDown className={`absolute bottom-[12%] left-1/2 -translate-x-1/2 w-6 h-6 transition-all ${data.heading === 180 ? theme.primary + ' scale-125 drop-shadow-[0_0_8px_currentColor]' : 'text-slate-400 dark:text-slate-700'}`} />
              <ArrowLeft className={`absolute top-1/2 left-[12%] -translate-y-1/2 w-6 h-6 transition-all ${data.heading === 270 ? theme.primary + ' scale-125 drop-shadow-[0_0_8px_currentColor]' : 'text-slate-400 dark:text-slate-700'}`} />

              <ArrowUpLeft className={`absolute top-[20%] left-[20%] w-5 h-5 transition-all ${data.heading === 315 ? theme.primary + ' scale-125 drop-shadow-[0_0_8px_currentColor]' : 'text-slate-400 dark:text-slate-700'}`} />
              <ArrowUpRight className={`absolute top-[20%] right-[20%] w-5 h-5 transition-all ${data.heading === 45 ? theme.primary + ' scale-125 drop-shadow-[0_0_8px_currentColor]' : 'text-slate-400 dark:text-slate-700'}`} />
              <ArrowDownLeft className={`absolute bottom-[20%] left-[20%] w-5 h-5 transition-all ${data.heading === 225 ? theme.primary + ' scale-125 drop-shadow-[0_0_8px_currentColor]' : 'text-slate-400 dark:text-slate-700'}`} />
              <ArrowDownRight className={`absolute bottom-[20%] right-[20%] w-5 h-5 transition-all ${data.heading === 135 ? theme.primary + ' scale-125 drop-shadow-[0_0_8px_currentColor]' : 'text-slate-400 dark:text-slate-700'}`} />

              <div
                className="absolute inset-0 flex items-center justify-center transition-transform duration-300 ease-out will-change-transform"
                style={{ transform: `translateZ(0) rotate(${visualHeading}deg)` }}
              >
                <div className="absolute top-3 bottom-1/2 w-6 flex justify-center origin-bottom">
                  <svg width="24" height="100%" viewBox="0 0 24 200" preserveAspectRatio="none" className="overflow-visible filter drop-shadow-[0_0_4px_rgba(6,182,212,0.5)]">
                    <polygon points="12,0 16,200 8,200" className="fill-cyan-400" />
                    <circle cx="12" cy="0" r="1.5" className="fill-white" />
                  </svg>
                </div>
                <div className="absolute w-2 h-2 bg-cyan-950 rounded-full border border-cyan-500 shadow-[0_0_4px_rgba(6,182,212,0.8)] z-20"></div>
              </div>
            </>
          )}

          {mode === 'nearby' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-full h-full bg-emerald-500/10 rounded-full animate-[pulse_1s_ease-in-out_infinite]"></div>
              <div className="absolute w-[80%] h-[80%] border border-emerald-400/50 rounded-full animate-ping opacity-20"></div>
            </div>
          )}

        </div>

        <div className="z-10 w-full flex gap-4 mt-auto">
          <div className="flex-1 h-16 rounded-xl border border-slate-300 bg-white/80 dark:border-slate-800 dark:bg-slate-950/60 flex flex-col items-center justify-center px-4 relative overflow-hidden group transition-colors">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Q0</span>
            </div>
            <div className={`text-xl font-mono font-bold transition-colors duration-200 ${connected && !isProbeDisconnected ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
              {connected && !isProbeDisconnected ? data.q0 : "---"}
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-[2px] transition-colors ${connected && !isProbeDisconnected ? 'bg-slate-300 dark:bg-slate-600' : 'bg-slate-300 dark:bg-slate-800'} opacity-50 dark:opacity-30`} />
          </div>

          <div className="flex-1 h-16 rounded-xl border border-slate-300 bg-white/80 dark:border-slate-800 dark:bg-slate-950/60 flex flex-col items-center justify-center px-4 relative overflow-hidden group transition-colors">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Q1</span>
            </div>
            <div className={`text-xl font-mono font-bold transition-colors duration-200 ${connected && !isProbeDisconnected ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
              {connected && !isProbeDisconnected ? data.q1 : "---"}
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-[2px] transition-colors ${connected && !isProbeDisconnected ? 'bg-slate-300 dark:bg-slate-600' : 'bg-slate-300 dark:bg-slate-800'} opacity-50 dark:opacity-30`} />
          </div>
        </div>

        {/* 矢量模长（距离）：Q0/Q1 合成矢量模，数值越小表示越接近短路点 */}
        <div className="z-10 w-full flex justify-center mt-2">
          <div className="flex-1 max-w-[280px] h-16 rounded-xl border border-slate-300 bg-white/80 dark:border-slate-800 dark:bg-slate-950/60 flex flex-col items-center justify-center px-4 relative overflow-hidden transition-colors">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{language === 'zh' ? '距离' : 'DIST'}</span>
            <span className={`text-xl font-mono font-bold transition-colors duration-200 ${connected && !isProbeDisconnected ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-600'}`}>
              {connected && !isProbeDisconnected ? data.magnitude : "---"}
            </span>
            <div className={`absolute bottom-0 left-0 right-0 h-[2px] transition-colors ${connected && !isProbeDisconnected ? 'bg-cyan-300 dark:bg-cyan-600' : 'bg-slate-300 dark:bg-slate-800'} opacity-50 dark:opacity-30`} />
          </div>
        </div>

      </div>

      <div className="
        w-20 rounded-[3rem] 
        border border-slate-300 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40 shadow-xl
        flex flex-col items-center py-8
        transition-all duration-300 ease-in-out
      ">
        <VerticalSlider
          value={threshold}
          onChange={onThresholdChange}
          min={thresholdMin}
          max={thresholdMax}
          step={thresholdStep}
          themeColor={theme.primary}
        />
      </div>

    </div>
  );
};
