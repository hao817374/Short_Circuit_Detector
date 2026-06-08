
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DebugPoint, Language, POINTS_PER_FRAME } from '../types';
import { getWindowAvg, WINDOW_SIZE, TRIM_COUNT, WINDOW_CENTER_OFFSET } from '../utils/dsp';
import {
   Pause, Play, GripHorizontal,
   ArrowDownLeft, ArrowDownRight, ArrowUpLeft, ArrowUpRight, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
   Zap, Navigation, Target, AlertCircle, CheckCircle2, Loader2, ArrowLeft as BackIcon
} from 'lucide-react';

/**
 * 波形调试视图组件属性定义
 * 该组件作为独立的调试页面存在，在 DEBUG Tab 下展示。
 * 它负责渲染波形图、管理采样窗口（Windows 1 & 2）、以及处理校准数据状态。
 */
interface DebugChartProps {
   // --- 核心波形数据 ---
   data: DebugPoint[];                                               // 包含 100 个原始点和解析值的高频波形帧数据
   isPaused?: boolean;                                               // 是否暂停渲染（冻结波形以便观察）
   onTogglePause?: () => void;                                       // 切换暂停/恢复状态的回调

   // --- 采样窗口配置 (DSP) ---
   win1Index: number;                                                // 采样窗口 1 (Q0) 的起始数据索引
   win2Index: number;                                                // 采样窗口 2 (Q1) 的起始数据索引
   onWin1IndexChange: (n: number) => void;                           // 拖动波形图上 WIN1 游标时的回调
   onWin2IndexChange: (n: number) => void;                           // 拖动波形图上 WIN2 游标时的回调

   // --- 手动微调偏移 ---
   win1Offset: number;                                               // 用户手动补偿给 Q0 的数值
   onWin1OffsetChange: (n: number) => void;
   win2Offset: number;                                               // 用户手动补偿给 Q1 的数值
   onWin2OffsetChange: (n: number) => void;
   globalOffset: number;                                             // 波形在 Y 轴上的全局视觉偏移量
   onGlobalOffsetChange: (n: number) => void;

   // --- 校准矩阵与算法结果 ---
   directionMap: { ref: number, heading: number }[];                 // 空间方位映射表，用于将解算后的角度匹配到最近的地理方向
   calibMatrix: [number, number, number, number];                    // 由前置校准生成的 2x2 解耦矩阵

   // --- 零点校准状态透传 (Zero Calibration) ---
   onZeroCalibrate: () => void;                                      // 触发零点校准
   isZeroSampling: boolean;                                          // 是否正在进行零点采样（用于 UI loading 态）
   zeroCalibStatus: 'IDLE' | 'SUCCESS' | 'FAILED';                   // 零点校准的结果状态机
   zeroCalibResult: { q0: number; q1: number; bias: number } | null; // 零点校准得到的底噪补偿值
   zeroCalibEverRun?: boolean;                                       // 软件生命周期内是否执行过一次

   // --- 空间方向校准透传 (Spatial Calibration) ---
   onSpatialCalibrate: (step: 'NW' | 'SW') => void;                  // 触发具体方位的空间校准
   calibRefVectors: Record<string, { q0: number, q1: number } | null>;// 保存采集到的基准空间向量
   samplingStep: string | null;                                      // 当前正在采样的方位名

   // --- 全局控制 ---
   onBack: () => void;                                               // 返回上一页/关闭当前视图的回调
   language: Language;                                               // 当前界面语言
}

/**
 * 八向方位静态 UI 字典
 * 将解析出的物理角度（heading）直接映射为对应的中/英文本标识和对应的方向箭头图标。
 * 遵循地理惯例：0°=正北（上方），顺时针递增。
 */
const DIRECTION_UI_INFO = [
   { heading: 0, label: "NORTH", zhLabel: "北", Icon: ArrowUp },
   { heading: 45, label: "NE", zhLabel: "东北", Icon: ArrowUpRight },
   { heading: 90, label: "EAST", zhLabel: "东", Icon: ArrowRight },
   { heading: 135, label: "SE", zhLabel: "东南", Icon: ArrowDownRight },
   { heading: 180, label: "SOUTH", zhLabel: "南", Icon: ArrowDown },
   { heading: 225, label: "SW", zhLabel: "西南", Icon: ArrowDownLeft },
   { heading: 270, label: "WEST", zhLabel: "西", Icon: ArrowLeft },
   { heading: 315, label: "NW", zhLabel: "西北", Icon: ArrowUpLeft },
];

export const DebugChart: React.FC<DebugChartProps> = ({
   data, isPaused = false, onTogglePause,
   win1Index, win2Index, onWin1IndexChange, onWin2IndexChange,
   win1Offset, onWin1OffsetChange,
   win2Offset, onWin2OffsetChange,
   globalOffset, onGlobalOffsetChange,
   directionMap, calibMatrix,
   onZeroCalibrate, isZeroSampling, zeroCalibStatus, zeroCalibResult, zeroCalibEverRun,
   onSpatialCalibrate, calibRefVectors, samplingStep,
   onBack, language
}) => {
   // 记录当前用户正在拖拽哪一个采样窗口游标（1 或 2，null 表示未拖拽）
   const [draggingWindow, setDraggingWindow] = useState<1 | 2 | null>(null);
   // 波形图容器的 DOM 引用，用于挂载 ResizeObserver
   const containerRef = useRef<HTMLDivElement>(null);
   // 保存当前 SVG 容器的物理像素宽高
   const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

   /**
    * 自适应容器尺寸监听
    * 利用浏览器原生的 ResizeObserver 监听容器大小变化。
    * 这样不管用户怎样调整窗口大小，或者切换横竖屏，波形 SVG 都能实时重绘以撑满容器。
    */
   useEffect(() => {
      if (!containerRef.current) return;
      const observer = new ResizeObserver((entries) => {
         for (const entry of entries) setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
   }, []);

   /**
    * 动态 Y 轴渲染边界计算
    * 为了让波形始终显示在 SVG 的合理区域内，并且上下留有呼吸空间：
    * 1. 遍历找出当前帧波形的物理最大值和最小值。
    * 2. 计算极差（range），并至少保证极差不小于 40（避免信号纯平线时画面过度放大导致底噪撕裂）。
    * 3. 在极值的上下各增加 12% 的 padding 留白，防止波形顶撞容器边缘。
    */
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

   /**
    * 严格波形极值统计（用于文本 UI 展示）
    * 与渲染边界不同，这里计算的是绝对准确的最小值、最大值和极差，直接用于 UI 面板的数字显示。
    */
   const { waveMin, waveMax, waveRange } = useMemo(() => {
      if (data.length === 0) return { waveMin: 0, waveMax: 0, waveRange: 0 };
      let wMin = Infinity, wMax = -Infinity;
      for (const p of data) {
         const v = p.value + globalOffset;
         if (v < wMin) wMin = v;
         if (v > wMax) wMax = v;
      }
      return { waveMin: Math.round(wMin), waveMax: Math.round(wMax), waveRange: Math.round(wMax - wMin) };
   }, [data, globalOffset]);


   // --- SVG 坐标系映射模块 ---

   /**
    * 画布内边距配置
    * 为了给 X 轴和 Y 轴的文本标签留出空间，定义了 SVG 内部四周的空白区域。
    */
   const padding = { top: 30, right: 30, bottom: 50, left: 80 };

   // 计算实际可用画布尺寸，设置了最小宽高以防在极端缩放时容器崩溃
   const contentWidth = Math.max(dimensions.width, 300);
   const contentHeight = Math.max(dimensions.height, 240);

   /**
    * X 轴坐标映射：从数据数组索引 (index) -> SVG 物理像素坐标 (X)
    * 算法：当前点占总点数（POINTS_PER_FRAME - 1）的百分比 * 实际可用渲染宽度 + 左侧内边距
    * 
    * @param index - 数据点在数组中的索引 (0 到 POINTS_PER_FRAME-1)
    */
   const getX = (index: number) => {
      const availableWidth = Math.max(1, contentWidth - padding.left - padding.right);
      return padding.left + (index / (POINTS_PER_FRAME - 1)) * availableWidth;
   };

   /**
    * Y 轴坐标映射：从数据原始物理值 (value) -> SVG 物理像素坐标 (Y)
    * 算法：
    * 1. 算出数据值在动态边界 [min, max] 内的百分比。
    * 2. 因为 SVG 的 Y 轴原点 (0) 在屏幕顶部，而图表原点在底部，所以需要用“总高度 - 底部留白 - 映射高度”来反转坐标系。
    * 
    * @param value - ADC 采样或经过偏移计算后的物理值
    */
   const getY = (value: number) => {
      const availableHeight = contentHeight - padding.top - padding.bottom;
      const range = max - min || 1; // 兜底防止除以 0
      const normalized = (value - min) / range;
      // 屏幕坐标系反转：底部向上生长
      return contentHeight - padding.bottom - (normalized * availableHeight);
   };

   // --- 核心数学解算模块 ---

   /**
    * 1. 窗口数据均值提取 (DSP)
    * 根据用户拖拽的游标索引 (winIndex)，从原始高频波形帧 (POINTS_PER_FRAME，默认 100 个点) 中截取一段滑动窗口，并计算出平均值。
    */
   const win1BaseVal = useMemo(() => getWindowAvg(data, win1Index, globalOffset), [win1Index, data, globalOffset]);
   const win2BaseVal = useMemo(() => getWindowAvg(data, win2Index, globalOffset), [win2Index, data, globalOffset]);

   /**
    * 2. 向量补偿与空间矩阵解耦
    * rawQ0/Q1: 加上了用户手动微调的数值。
    * corrQ0/Q1: 利用 2x2 校准矩阵 (calibMatrix) 进行矩阵乘法运算。
    * 这一步是为了消除物理传感器的安装误差，将斜交坐标系拉伸还原为完美的正交坐标系。
    */
   const rawQ0 = win1BaseVal + win1Offset;
   const rawQ1 = win2BaseVal + win2Offset;
   const corrQ0 = rawQ0 * calibMatrix[0] + rawQ1 * calibMatrix[1];
   const corrQ1 = rawQ0 * calibMatrix[2] + rawQ1 * calibMatrix[3];

   /**
    * 3. 连续角度计算
    * 利用 atan2 将二维直角坐标 (x, y) 转换为极坐标角度，并从弧度转为度数 (-180° 到 180°)。
    */
   const rawAngle = useMemo(() => Math.atan2(corrQ1, corrQ0) * 180 / Math.PI, [corrQ0, corrQ1]);

   /**
    * 4. 八向方位贴近算法（边界吸附）
    * 遍历之前校准记录的空间方位映射表（directionMap），算出当前连续角度与哪个基准方向最接近。
    */
   const calibratedHeading = useMemo(() => {
      if (data.length === 0) return 0;
      let minDiff = Infinity, bestHeading = 0;
      for (const item of directionMap) {
         let diff = Math.abs(rawAngle - item.ref);
         // 处理跨越 0°/360° 的圆周夹角情况
         // 例如当前角度 350°，基准目标 10°，物理夹角应该是 20° 而不是 340°
         if (diff > 180) diff = 360 - diff;

         if (diff < minDiff) {
            minDiff = diff;
            bestHeading = item.heading;
         }
      }
      return bestHeading;
   }, [rawAngle, data.length, directionMap]);

   /**
    * 5. UI 映射提取
    * 将计算出的最终物理方位度数，映射为包含图标和多语言文本的 UI 字典对象。
    */
   const directionInfo = useMemo(() => {
      const uiInfo = DIRECTION_UI_INFO.find(u => u.heading === calibratedHeading) || DIRECTION_UI_INFO[0];
      const iconProps = { size: 48, strokeWidth: 2.5, className: "text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.7)]" };
      return {
         icon: data.length > 0 ? <uiInfo.Icon {...iconProps} /> : null,
         text: data.length > 0 ? (language === 'zh' ? uiInfo.zhLabel : uiInfo.label) : "--"
      };
   }, [calibratedHeading, data.length, language]);

   // --- 交互与拖拽模块 ---

   // 获取整个 SVG 画布的 DOM 引用，用于计算相对坐标
   const svgRef = useRef<SVGSVGElement>(null);

   /**
    * 全局拖拽事件监听器
    * 当用户按住 WIN1 或 WIN2 游标时触发。
    * 为了防止鼠标移动过快脱离 SVG 区域导致拖拽中断，这里将 mousemove 和 mouseup 绑定在全局 window 上。
    */
   useEffect(() => {
      if (draggingWindow === null) return;

      const handleMove = (e: any) => {
         if (!svgRef.current) return;
         // 兼容鼠标和触屏操作
         const clientX = e.touches ? e.touches[0].clientX : e.clientX;
         const rect = svgRef.current.getBoundingClientRect();
         const availableWidth = contentWidth - padding.left - padding.right;

         // 逆向映射：物理坐标 X -> 数据数组索引 index
         const index = Math.round(((clientX - rect.left - padding.left) / availableWidth) * (POINTS_PER_FRAME - 1));
         // 钳制索引，防止拖出数组边界
         const clampedIndex = Math.max(0, Math.min(POINTS_PER_FRAME - 1, index));
         // 算出窗口的起始点（游标本身代表的是窗口中心，所以要减去中心偏移量）
         const winStartIndex = Math.max(0, clampedIndex - WINDOW_CENTER_OFFSET);

         // 根据当前拖拽的是哪个窗口，触发对应的回调更新状态
         if (draggingWindow === 1) onWin1IndexChange(winStartIndex);
         else onWin2IndexChange(winStartIndex);
      };

      const handleUp = () => setDraggingWindow(null);

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      // passive: false 允许在 touchmove 时调用 preventDefault 阻止页面滚动（如有需要）
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleUp);

      return () => {
         window.removeEventListener('mousemove', handleMove);
         window.removeEventListener('mouseup', handleUp);
         window.removeEventListener('touchmove', handleMove);
         window.removeEventListener('touchend', handleUp);
      };
   }, [draggingWindow, contentWidth]);

   /**
    * 渲染交互式游标组件
    * @param startIndex - 窗口在数据中的起始索引
    * @param colorClass - 该窗口的主题颜色（如 text-cyan-400）
    * @param id - 窗口标识 (1 或 2)
    */
   const renderWindowOverlay = (startIndex: number, colorClass: string, id: 1 | 2) => {
      if (data.length === 0) return null;
      // UI 上游标所在的位置实际上是窗口的中心点
      const centerIndex = startIndex + WINDOW_CENTER_OFFSET;
      const handleX = getX(centerIndex);
      const isDragging = draggingWindow === id;

      return (
         <g key={`win-${id}`}>
            {/* 游标拖拽组，未暂停时 (实时波形刷新中) 降低透明度并禁用鼠标事件，防止误触 */}
            <g
               className={`cursor-grab active:cursor-grabbing group/handle ${!isPaused ? 'opacity-20 pointer-events-none' : ''}`}
               onMouseDown={() => setDraggingWindow(id)}
               onTouchStart={() => setDraggingWindow(id)}
            >
               {/* 隐形扩大点击热区 (hitbox) */}
               <rect x={handleX - 15} y={padding.top - 20} width={30} height={contentHeight - padding.top - padding.bottom + 20} fill="transparent" />
               {/* 顶部标识圆角矩形 */}
               <rect x={handleX - 12} y={padding.top - 20} width={24} height={18} rx={4} className={`${colorClass} ${isDragging ? 'fill-current' : 'fill-slate-950 stroke-current'} transition-all duration-200`} />
               {/* 抓手小图标 */}
               <GripHorizontal size={12} x={handleX - 6} y={padding.top - 17} className={`${isDragging ? 'text-slate-950' : colorClass}`} />
               {/* 贯穿波形图的垂直定位线 */}
               <line x1={handleX} y1={padding.top} x2={handleX} y2={contentHeight - padding.bottom} className={`stroke-current ${colorClass} ${isDragging ? 'opacity-100' : 'opacity-40'}`} strokeWidth={isDragging ? 2 : 1} />
               {/* WIN1/WIN2 文字标签 */}
               <text x={handleX} y={padding.top - 28} textAnchor="middle" className={`${colorClass} text-[10px] font-black font-mono select-none drop-shadow-[0_0_4px_black]`}>WIN{id}</text>
            </g>
         </g>
      );
   };

   // --- 图形渲染数据构造模块 ---

   /**
    * 波形折线数据串
    * 将 100 个点的二维数组转换成 SVG <polyline> 所需的 points 字符串格式 (x1,y1 x2,y2 ...)
    */
   const pointsString = useMemo(() =>
      data.map((p, i) => `${getX(i).toFixed(1)},${getY(p.value + globalOffset).toFixed(1)}`).join(' '),
      [data, min, max, contentWidth, contentHeight, globalOffset]);

   /**
    * 波形底部填充区域数据串
    * 在折线的基础上，添加闭合到 X 轴底部边缘的点，用于给波形下方画半透明渐变（SVG <polygon>）。
    */
   const areaPointsString = useMemo(() =>
      data.length === 0 ? "" : `${getX(0)},${contentHeight - padding.bottom} ${pointsString} ${getX(data.length - 1)},${contentHeight - padding.bottom}`,
      [pointsString, contentHeight, padding.bottom]);

   /**
    * 渲染 DSP 采样窗口的半透明遮罩框
    * 为了让用户直观看到“游标所在的一段波形到底抖不抖”，在波形图背景上画一个矩形框，
    * 该矩形的宽度恰好是 `WINDOW_SIZE`，高度则是这段区间内波形的极差（剔除极端离群点之后）。
    */
   const renderDSPWindowShadow = (startIndex: number, colorClass: string) => {
      if (data.length === 0) return null;

      // 1. 提取窗口内全部点的数据
      const windowPoints: number[] = [];
      for (let i = 0; i < WINDOW_SIZE; i++) {
         // % POINTS_PER_FRAME 是为了处理游标拖到数组末尾时，窗口向头部发生环形折叠的问题
         const idx = (startIndex + i) % POINTS_PER_FRAME;
         if (data[idx]) windowPoints.push(data[idx].value + globalOffset);
      }
      if (windowPoints.length < WINDOW_SIZE) return null;

      // 2. 切尾平均预处理 (Trimmed Min/Max)
      // 排序后砍掉最高和最低的几个 `TRIM_COUNT` 离群点，防止单个高频尖脉冲把遮罩框拉得特别高
      const sorted = [...windowPoints].sort((a, b) => a - b);
      const validMin = sorted[TRIM_COUNT];
      const validMax = sorted[WINDOW_SIZE - 1 - TRIM_COUNT];

      // 3. 计算 SVG 物理坐标
      const xStart = getX(startIndex);
      const xEnd = getX(startIndex + WINDOW_SIZE - 1);
      const yTop = getY(validMax);
      const yBottom = getY(validMin);

      // 渲染最终的半透明矩形阴影框
      return (
         <rect
            key={`shadow-${startIndex}`}
            x={Math.min(xStart, xEnd)}
            y={yTop}
            width={Math.abs(xEnd - xStart)}
            // 保证矩形高度至少有 1px
            height={Math.max(1, yBottom - yTop)}
            className={`${colorClass} opacity-20 transition-all duration-300`}
         />
      );
   };

   return (
      <div className="w-full h-full flex flex-col gap-6 relative min-h-0">
         <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-6 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-300 dark:border-white/5 p-6 rounded-[2.5rem] backdrop-blur-2xl shrink-0 items-center shadow-2xl transition-colors duration-300 min-h-[280px]">
            {/* Col 1: Back button only */}
            <div className="flex flex-col justify-start self-start">
               <button
                  onClick={onBack}
                  className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-lg group"
               >
                  <BackIcon size={24} className="group-hover:-translate-x-1 transition-transform" />
               </button>
            </div>

            {/* Col 2: Three circles + pause button centered below */}
            <div className="flex flex-col items-center gap-4">
               <div className="flex justify-center items-center gap-4">
                  <div className="relative w-40 h-40 rounded-full bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-800 shadow-[0_0_20px_rgba(0,0,0,0.1),inset_0_0_20px_rgba(0,0,0,0.03)] dark:shadow-[0_0_40px_rgba(0,0,0,0.6),inset_0_0_20px_rgba(255,255,255,0.03)] flex items-center justify-center transition-colors duration-300">
                     <div className="absolute top-4 text-[10px] font-black text-slate-400 dark:text-slate-600 tracking-widest uppercase font-mono">STATUS</div>
                     <div className="z-10 animate-in zoom-in duration-300">{directionInfo.icon || <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />}</div>
                     <div className="absolute bottom-4"><span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tighter drop-shadow-md">{directionInfo.text}</span></div>
                  </div>
                  <div className="relative w-40 h-40 rounded-full bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-800 shadow-[0_0_20px_rgba(0,0,0,0.1),inset_0_0_20px_rgba(0,0,0,0.03)] dark:shadow-[0_0_40px_rgba(0,0,0,0.6),inset_0_0_20px_rgba(255,255,255,0.03)] flex items-center justify-center overflow-hidden transition-colors duration-300">
                     <div className="absolute top-4 text-[10px] font-black text-slate-400 dark:text-slate-600 tracking-widest uppercase font-mono">ANGLE</div>
                     <div className="absolute inset-0 flex items-center justify-center transition-transform duration-300 ease-out" style={{ transform: `rotate(${90 - rawAngle}deg)` }}>
                        <div className="w-1 h-1/2 bg-amber-500 shadow-[0_0_15px_#f59e0b] origin-bottom -translate-y-1/2 opacity-80"></div>
                     </div>
                     <div className="z-10 bg-white/95 dark:bg-slate-950/95 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 shadow-2xl backdrop-blur-md">
                        <span className="text-base font-mono font-black text-amber-500 tabular-nums">{data.length > 0 ? Math.round(rawAngle) : "--"}°</span>
                     </div>
                  </div>
                  <div className="relative w-40 h-40 rounded-full bg-white dark:bg-slate-950 border-2 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.1)] flex items-center justify-center overflow-hidden transition-colors duration-300">
                     <div className="absolute top-4 text-[10px] font-black text-cyan-600/50 dark:text-cyan-500/50 tracking-widest uppercase font-mono">MAP</div>
                     <div className="absolute inset-0 flex items-center justify-center transition-transform duration-700 cubic-bezier(0.19, 1, 0.22, 1)" style={{ transform: `rotate(${calibratedHeading}deg)` }}><div className="w-2 h-1/2 bg-cyan-500 dark:bg-cyan-400 shadow-[0_0_25px_#22d3ee] origin-bottom -translate-y-1/2 rounded-full"></div></div>
                     <div className="z-10 bg-white/95 dark:bg-slate-950/95 p-3 rounded-full border border-cyan-500/40 shadow-2xl">
                        <Navigation size={22} className="text-cyan-500 dark:text-cyan-400" />
                     </div>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 font-mono text-xs">
                     <span className="text-slate-400 dark:text-slate-500">Q0:</span>
                     <span className="text-cyan-600 dark:text-cyan-400 font-bold tabular-nums ml-1">{Math.round(rawQ0)}</span>
                  </div>
                  <button onClick={onTogglePause} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl border text-xs font-black tracking-widest transition-all ${isPaused ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-500 shadow-xl' : 'bg-white dark:bg-slate-800/50 border-slate-300 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                     {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />} {isPaused ? "RESUME" : "PAUSE"}
                  </button>
                  <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 font-mono text-xs">
                     <span className="text-slate-400 dark:text-slate-500">Q1:</span>
                     <span className="text-cyan-600 dark:text-cyan-400 font-bold tabular-nums ml-1">{Math.round(rawQ1)}</span>
                  </div>
               </div>
            </div>

            {/* Col 3: 3-row calibration grid */}
            <div className="flex flex-col gap-3">
               {/* Row 1: Zero Calib */}
               <div className="flex items-center gap-3">
                  <button onClick={onZeroCalibrate} disabled={isZeroSampling} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-xs font-black tracking-widest shadow-inner flex-1 ${isZeroSampling ? 'bg-cyan-100 dark:bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-cyan-300 dark:border-cyan-500/40 bg-white dark:bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-600/20'}`}>
                     {isZeroSampling ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
                     {isZeroSampling ? (language === 'zh' ? '采样中...' : 'SAMPLING...') : (language === 'zh' ? '零点校准' : 'ZERO CALIB')}
                  </button>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 font-mono text-xs min-w-[240px] justify-center">
                     {zeroCalibResult !== null ? (
                        <><span className="text-slate-400 dark:text-slate-500">Q0:</span><span className="text-cyan-600 dark:text-cyan-400 font-bold tabular-nums">{zeroCalibResult.q0}</span><span className="text-slate-400 dark:text-slate-500 ml-2">Q1:</span><span className="text-cyan-600 dark:text-cyan-400 font-bold tabular-nums">{zeroCalibResult.q1}</span><span className="text-slate-400 dark:text-slate-500 ml-2">BIAS:</span><span className="text-amber-600 dark:text-amber-400 font-bold tabular-nums">{zeroCalibResult.bias}</span></>
                     ) : (zeroCalibEverRun ? (
                        <><span className="text-slate-400 dark:text-slate-500">Q0:</span><span className="text-red-400 dark:text-red-500 font-bold tabular-nums w-10 text-center">NULL</span><span className="text-slate-400 dark:text-slate-500 ml-2">Q1:</span><span className="text-red-400 dark:text-red-500 font-bold tabular-nums w-10 text-center">NULL</span><span className="text-slate-400 dark:text-slate-500 ml-2">BIAS:</span><span className="text-red-400 dark:text-red-500 font-bold tabular-nums w-10 text-center">NULL</span></>
                     ) : (
                        <span className="text-slate-400 dark:text-slate-600">{language === 'zh' ? '等待校准' : 'AWAIT CALIB'}</span>
                     ))}
                  </div>
               </div>
               {/* Row 2: NW Calib (右上采集) */}
               <div className="flex items-center gap-3">
                  <button
                     onClick={() => onSpatialCalibrate('NW')}
                     disabled={!!samplingStep}
                     className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-black tracking-widest transition-all flex-1 ${samplingStep === 'NW' ? 'bg-violet-500 text-white animate-pulse' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-white/10 text-slate-500 dark:text-violet-500 hover:border-violet-500/50'}`}
                  >
                     <ArrowUpRight size={14} /> {language === 'zh' ? '右上采集' : 'NW CALIB'}
                  </button>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 font-mono text-xs min-w-[180px] justify-center">
                     {calibRefVectors['NW'] ? (
                        <><span className="text-cyan-500 dark:text-cyan-400">Q0:</span><span className="text-cyan-600 dark:text-cyan-300 font-bold w-16 text-right tabular-nums">{Math.round(calibRefVectors['NW']!.q0)}</span><span className="text-cyan-500 dark:text-cyan-400 ml-2">Q1:</span><span className="text-cyan-600 dark:text-cyan-300 font-bold w-16 text-right tabular-nums">{Math.round(calibRefVectors['NW']!.q1)}</span></>
                     ) : (
                        <span className="text-slate-400 dark:text-slate-600">{language === 'zh' ? '等待采集' : 'AWAIT SAMPLE'}</span>
                     )}
                  </div>
               </div>
               {/* Row 3: SW Calib (右下采集) */}
               <div className="flex items-center gap-3">
                  <button
                     onClick={() => onSpatialCalibrate('SW')}
                     disabled={!!samplingStep}
                     className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-black tracking-widest transition-all flex-1 ${samplingStep === 'SW' ? 'bg-emerald-500 text-white animate-pulse' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-white/10 text-slate-500 dark:text-emerald-500 hover:border-emerald-500/50'}`}
                  >
                     <ArrowDownRight size={14} /> {language === 'zh' ? '右下采集' : 'SW CALIB'}
                  </button>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 font-mono text-xs min-w-[180px] justify-center">
                     {calibRefVectors['SW'] ? (
                        <><span className="text-cyan-500 dark:text-cyan-400">Q0:</span><span className="text-cyan-600 dark:text-cyan-300 font-bold w-16 text-right tabular-nums">{Math.round(calibRefVectors['SW']!.q0)}</span><span className="text-cyan-500 dark:text-cyan-400 ml-2">Q1:</span><span className="text-cyan-600 dark:text-cyan-300 font-bold w-16 text-right tabular-nums">{Math.round(calibRefVectors['SW']!.q1)}</span></>
                     ) : (
                        <span className="text-slate-400 dark:text-slate-600">{language === 'zh' ? '等待采集' : 'AWAIT SAMPLE'}</span>
                     )}
                  </div>
               </div>
               {/* Row 4: Waveform Min/Max */}
               <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-800 text-xs font-black tracking-widest flex-1 justify-center text-slate-500 dark:text-slate-400">
                     <Zap size={14} /> {language === 'zh' ? '波形范围' : 'WAVE RANGE'}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/5 font-mono text-xs min-w-[180px] justify-center">
                     <span className="text-slate-400 dark:text-slate-500">min:</span><span className="text-cyan-600 dark:text-cyan-400 font-bold tabular-nums w-14 text-right">{waveMin}</span>
                     <span className="text-slate-400 dark:text-slate-500 ml-1">max:</span><span className="text-cyan-600 dark:text-cyan-400 font-bold tabular-nums w-14 text-right">{waveMax}</span>
                     <span className="text-slate-400 dark:text-slate-500 ml-1">Δ:</span><span className="text-amber-500 dark:text-amber-400 font-bold tabular-nums w-14 text-right">{waveRange}</span>
                  </div>
               </div>
            </div>
         </div>
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

                  {renderDSPWindowShadow(win1Index, "fill-emerald-500")}
                  {renderDSPWindowShadow(win2Index, "fill-violet-500")}

                  {renderWindowOverlay(win1Index, "text-emerald-600 dark:text-emerald-500 fill-emerald-600 dark:fill-emerald-500", 1)}
                  {renderWindowOverlay(win2Index, "text-violet-600 dark:text-violet-500 fill-violet-600 dark:fill-violet-500", 2)}
               </svg>
            )}
         </div>
      </div>
   );
};
