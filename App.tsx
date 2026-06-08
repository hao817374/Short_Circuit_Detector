
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Compass } from './components/Compass';
import { DebugChart } from './components/DebugChart';

import { Settings } from './components/Settings';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CalibrationView } from './components/CalibrationView';
import { CompassData, SerialPort, DebugPoint, Language, ThemeMode, POINTS_PER_FRAME } from './types';
import { scanFrame } from './utils/binaryProtocol';
import { Usb, PlugZap, Timer, AlertCircle } from 'lucide-react';

type ViewMode = 'COMPASS' | 'CALIBRATION' | 'DEBUG' | 'SETTINGS';

import { getWindowAvg, WINDOW_SIZE, WINDOW_CENTER_OFFSET } from './utils/dsp';

/**
 * 方向映射查找表：atan2(ref) → 罗盘 heading
 * 公式：heading = (360 - ref) % 360
 *   其中 ref 为 atan2(corrQ1, corrQ0) 的数学角度（0°=右/东，90°=上/北，逆时针递增）
 *   其中 heading 为罗盘指向角度（0°=上/北，90°=右/东，顺时针递增）
 */
const DEFAULT_MAP = [
  { ref: 0, heading: 0 },       // ref 数学右(E) → heading 正上(N)
  { ref: 45, heading: 315 },    // ref 数学右上(NE) → heading 左上(NW)
  { ref: 90, heading: 270 },    // ref 数学上(N) → heading 正左(W)
  { ref: 135, heading: 225 },   // ref 数学左上(NW) → heading 左下(SW)
  { ref: 180, heading: 180 },   // ref 数学左(W) → heading 正下(S)
  { ref: 225, heading: 135 },   // ref 数学左下(SW) → heading 右下(SE)
  { ref: 270, heading: 90 },    // ref 数学下(S) → heading 正右(E)
  { ref: 315, heading: 45 },    // ref 数学右下(SE) → heading 右上(NE)
];

/**
 * 自定义 Hook 函数，用于将状态（State）自动同步且持久化存储到浏览器的 localStorage 中。
 * 
 * @template T - 泛型参数，代表该状态的实际数据类型（如：boolean, number, 数组，矩阵对象等），实现类型安全。
 * @param {string} key - 存储在 localStorage 键值对数据库中的唯一键（Key）名称。
 * @param {T} initialValue - 默认初始值。如果本地没有找到历史存储，就使用此值。
 * 
 * @returns {[T, React.Dispatch<React.SetStateAction<T>>]} 
 *   返回一个长度为 2 的元组（数组），格式和 React 原生 useState 相同：
 *   - 索引 0 (T)：当前的最新状态值。
 *   - 索引 1 (函数)：用于修改该状态的 Setter 回调函数。
 */
function usePersistentState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  // 1. 初始化 React 内部状态。
  // 传入匿名函数 () => { ... } 进行“惰性初始化”：只在组件初次加载时运行一次，避免每次重绘都去执行缓慢的磁盘 I/O。
  const [state, setState] = useState<T>(() => {
    try {
      // 从浏览器的本地存储（类似单片机 Flash/EEPROM）中读取对应键的字符串
      const item = localStorage.getItem(key);
      // 如果读取到了数据，就用 JSON.parse 将 JSON 字符串还原为原本的数据类型；如果没有，则使用传入的默认初始值
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // 如果读取或解析过程发生异常（如数据损坏），打印错误日志，并使用默认初始值作为兜底安全返回
      console.error(`Error reading ${key} from localStorage`, error);
      return initialValue;
    }
  });

  // 2. 注册数据“看门狗”副作用（副作用监听器）。
  // 当 [key, state] 中的任何一个发生改变时（特别是调用 setState 更新数值时），都会自动触发此函数。
  useEffect(() => {
    try {
      // 使用 JSON.stringify 将 state 中的各种类型数据（如矩阵数组、数值）序列化为标准的 JSON 字符串，
      // 然后同步写入 localStorage 数据库中，实现自动存盘。
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      // 如果写入磁盘失败（如浏览器存储空间满），打印日志提示，保证主程序不崩溃
      console.error(`Error saving ${key} to localStorage`, error);
    }
  }, [key, state]); // 依赖项：只有当 key 改变或者 state 状态改变时才重新执行此持久化写入操作

  // 3. 返回元组。返回的对象和原生的 useState 用法完全吻合，使得它可以像普通的 useState 一样在外部被解构使用。
  return [state, setState];
}


function App() {
  // ==================== 第一段：状态声明（类似 C 的变量定义） ====================
  const [viewMode, setViewMode] = useState<ViewMode>('COMPASS'); // 视图模式状态：决定主容器渲染哪个 Tab 页面（COMPASS:罗盘, CALIBRATION:校准, DEBUG:调试示波器, SETTINGS:配置项）
  const [port, setPort] = useState<SerialPort | null>(null); // 物理串口句柄：连接成功时为 SerialPort 对象，断开时为 null，供数据读写流操作使用
  const [connected, setConnected] = useState(false);  // 连接状态标志：为 true 表示串口已打开且握手校验（Session ACK）成功，驱动罗盘开始工作
  const [isConnecting, setIsConnecting] = useState(false); // 连接中标志：为 true 时在界面弹出全屏毛玻璃加载遮罩，提示用户正在等待设备应答
  const [connectionError, setConnectionError] = useState<string | null>(null); // 连接错误信息：保存串口被占用或握手失败的文字提示，触发底部红色浮动报错框（6秒后自动清空）
  const [skipWelcome, setSkipWelcome] = usePersistentState('cfg_skipWelcome', false); // 引导页跳过标志：持久化存储，若为 true 则开机时不显示 Welcome 引导屏直接进罗盘
  const [isDeveloperMode, setIsDeveloperMode] = usePersistentState('cfg_isDevMode', false); // 开发者模式标志：持久化存储，为 true 时顶部导航条才会解锁显示“调试分析 (DEBUG)”入口

  /**
   * 连接错误气泡自动清除看门狗：如果产生连接错误，在 6 秒后自动将错误清空，使气泡消失
   */
  useEffect(() => {
    if (connectionError) {
      const timer = setTimeout(() => setConnectionError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [connectionError]);

  /**
   * 示波器暂停控制状态：用于控制调试界面(DEBUG)下的示波器波形图是否暂停刷新
   */
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  /**
   * 罗盘主数据状态：保存解算后的角度、幅值、X/Y 轴分量及表笔连接状态，直接传递给罗盘 HUD 界面渲染
   */
  const [compassData, setCompassData] = useState<CompassData>({
    q0: 0, q1: 0, rawQ0: 0, rawQ1: 0, q0Bit: 0, q1Bit: 0, heading: 0, magnitude: 0, rawCode: "00", status: "Waiting",
    balanceFactor: 1.0, axisToCompensate: 'NONE'
  });

  /**
   * 调试波形数据与缓存：debugData 用于示波器图表渲染，tempDebugBuffer 作为串口高频数据接收的单帧临时缓冲区
   */
  const [debugData, setDebugData] = useState<DebugPoint[]>([]);
  const tempDebugBuffer = useRef<DebugPoint[]>([]);

  /**
   * 串口底层连接控制器：在常驻异步循环中保存物理串口指针、流读取器、读取开关及随机会话 ID，对 UI 透明以避免性能卡顿
   */
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<any>(null);
  const keepReadingRef = useRef(false);
  const isDisconnectingRef = useRef(false);
  const sessionIdRef = useRef<Uint8Array>(new Uint8Array(8)); // 每次连接时随机生成，用于 Nonce 派生解密

  /**
   * 基础应用配置：中/英文切换与暗色/亮色主题模式，状态自动持久化本地存储
   */
  const [language, setLanguage] = usePersistentState<Language>('app_language', 'zh');
  const [themeMode, setThemeMode] = usePersistentState<ThemeMode>('app_theme', 'dark');

  /**
   * 主题应用监听：当 themeMode 改变时，在 HTML 根元素切换 'dark' 类以触发 Tailwind 样式
   */
  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  /**
   * 核心算法与检测参数：持久化保存滑动窗口起点索引、全局零偏补偿值以及短路报警阈值
   */
  const [win1Index, setWin1Index] = usePersistentState('cfg_win1Index', 25);
  const [win2Index, setWin2Index] = usePersistentState('cfg_win2Index', 75);
  const [globalOffset, setGlobalOffset] = usePersistentState('cfg_globalOffset', 160);
  const [threshold, setThreshold] = usePersistentState('cfg_threshold', 50); //短路阈值默认值

  /**
   * 阈值调节限制：持久化保存短路报警阈值滑块的最小值、最大值及调节步长
   */
  const [thresholdMin, setThresholdMin] = usePersistentState('cfg_thresholdMin', 5);
  const [thresholdMax, setThresholdMax] = usePersistentState('cfg_thresholdMax', 500);
  const [thresholdStep, setThresholdStep] = usePersistentState('cfg_thresholdStep', 5);

  /**
   * 窗口微调与探针检测：保存滑动窗口的相位偏置（Offset）和探针有效接触的判定阈值
   */
  const [win1Offset, setWin1Offset] = usePersistentState('cfg_win1Offset', 0);
  const [win2Offset, setWin2Offset] = usePersistentState('cfg_win2Offset', 0);
  const [probeThreshold, setProbeThreshold] = usePersistentState('cfg_probeThreshold', -3000);

  /**
   * 设备自动重连识别：记录首次成功连接设备的 VID/PID，通过 Ref 缓存以防自动连接的 useEffect 闭包过期
   */
  const [deviceVid, setDeviceVid] = usePersistentState<number | null>('cfg_deviceVid', null);
  const [devicePid, setDevicePid] = usePersistentState<number | null>('cfg_devicePid', null);
  const deviceVidRef = useRef(deviceVid);
  const devicePidRef = useRef(devicePid);
  useEffect(() => { deviceVidRef.current = deviceVid; }, [deviceVid]);
  useEffect(() => { devicePidRef.current = devicePid; }, [devicePid]);

  /**
   * 空间与通道校准：持久化保存 2x2 罗盘校准逆矩阵、增益平衡系数以及当前手动微调的补偿轴向
   */
  const [calibMatrix, setCalibMatrix] = usePersistentState<[number, number, number, number]>('cfg_calibMatrix', [1, 0, 0, 1]);
  const [balanceFactor, setBalanceFactor] = usePersistentState('cfg_balanceFactor', 1.0);
  const [compAxis, setCompAxis] = useState<'Q0' | 'Q1' | 'NONE'>('NONE');

  /**
   * 零偏校准状态管理：控制探针悬空时的零点底噪自动采集，使用 useRef 缓存高频点以避免频繁重绘
   */
  const [isZeroSampling, setIsZeroSampling] = useState(false);
  const [zeroCalibStatus, setZeroCalibStatus] = useState<'IDLE' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [zeroCalibResult, setZeroCalibResult] = useState<{ q0: number; q1: number; bias: number } | null>(null);
  const [zeroCalibEverRun, setZeroCalibEverRun] = useState(false);
  const zeroSamplingBuffer = useRef<{ q0: number, q1: number }[]>([]);

  /**
   * 引导式校准步骤：记录当前空间校准/多点校准的具体执行阶段，用于 UI 状态引导
   */
  const [samplingStep, setSamplingStep] = useState<string | null>(null);

  /**
   * 高频计算参数同步：将 React 状态实时同步到 Ref 容器，确保高频数据管线以零开销获取最新配置，规避闭包过期
   */
  const stateRef = useRef({
    w1Idx: 25, w2Idx: 75, gOff: 160,
    w1Off: 0, w2Off: 0,
    matrix: [1, 0, 0, 1] as [number, number, number, number],
    probeT: -3000,
    isZeroSampling: false,
    samplingStep: null as string | null
  });

  useEffect(() => {
    stateRef.current = {
      w1Idx: win1Index, w2Idx: win2Index, gOff: globalOffset,
      w1Off: win1Offset, w2Off: win2Offset,
      matrix: calibMatrix,
      probeT: probeThreshold,
      isZeroSampling: isZeroSampling,
      samplingStep: samplingStep
    };
  }, [win1Index, win2Index, globalOffset, win1Offset, win2Offset, calibMatrix, probeThreshold, isZeroSampling, samplingStep]);

  /**
   * 双向量空间校准状态：管理“右上角激励源(代码中命名为NW)”与“右下角激励源(代码中命名为SW)”的采样向量、计算状态、采集进度和临时缓冲区
   */
  const [calibRefVectors, setCalibRefVectors] = useState<Record<string, { q0: number, q1: number } | null>>({ "NW": null, "SW": null });
  const [spatialCalibStatus, setSpatialCalibStatus] = useState<Record<string, 'IDLE' | 'SUCCESS' | 'FAILED'>>({ "NW": 'IDLE', "SW": 'IDLE' });
  const [sampleProgress, setSampleProgress] = useState(0);
  const samplingBuffer = useRef<{ q0: number, q1: number }[]>([]);
  const currentRawValuesRef = useRef<{ q0: number, q1: number }>({ q0: 0, q1: 0 });

  /**
   * 校准标志派生：计算是否已完成所有方向的校准，或当前校准数据是否均已被清空
   */
  const allCalibrated = useMemo(() =>
    calibRefVectors["NW"] !== null && calibRefVectors["SW"] !== null
    , [calibRefVectors]);

  const isCleared = useMemo(() =>
    calibRefVectors["NW"] === null && calibRefVectors["SW"] === null
    , [calibRefVectors]);

  /**
   * 示波器暂停控制同步：同步 React 的 isPaused 状态至 Ref，供高频数据解析循环读取，防闭包过期
   */
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // ==================== 第二段：业务逻辑与函数（类似 C 的子函数） ====================
  /**
   * 帧数据解析消费管线：串口解密数据的核心消费管道，执行高频 DSP 滤波与空间解算，并将结果投递给 UI 罗盘
   */
  const commitFrame = () => {
    if (tempDebugBuffer.current.length >= POINTS_PER_FRAME) {
      const newFrame = tempDebugBuffer.current.slice(0, POINTS_PER_FRAME);
      // 从 ref 读取实时参数（避免闭包捕获过期的 state）
      const { w1Idx, w2Idx, gOff, w1Off, w2Off, matrix, probeT, isZeroSampling: zeroSampling } = stateRef.current;

      // 阶段1：DSP 降噪 — 对 Q0/Q1 各自滑动窗口执行修剪均值滤波并去除底噪偏移
      const baseQ0 = getWindowAvg(newFrame, w1Idx, gOff);
      const baseQ1 = getWindowAvg(newFrame, w2Idx, gOff);

      // 阶段2：零点校准采样 — 采集 DSP 裸值（不含各通道独立偏移）
      if (zeroSampling) {
        zeroSamplingBuffer.current.push({ q0: baseQ0, q1: baseQ1 });
      }

      // 阶段3：探头断开检测 — 两通道均低于阈值判定为表笔悬空
      const isProbeDisconnected = baseQ0 < probeT && baseQ1 < probeT;

      // 阶段4：施加各通道独立偏移补偿，得到 raw 值
      const rawQ0 = baseQ0 + w1Off;
      const rawQ1 = baseQ1 + w2Off;

      currentRawValuesRef.current = { q0: rawQ0, q1: rawQ1 };

      // 阶段5：仿射变换校正 — 乘 2x2 逆矩阵纠正 Q0/Q1 通道非正交与增益不平衡，将畸变矢量还原到标准正交坐标系
      const corrQ0 = rawQ0 * matrix[0] + rawQ1 * matrix[1];
      const corrQ1 = rawQ0 * matrix[2] + rawQ1 * matrix[3];

      const rawAngle = Math.atan2(corrQ1, corrQ0) * 180 / Math.PI;

      // 方向校准采样 — 采集带偏移补偿的 raw 值
      if (stateRef.current.samplingStep !== null) {
        samplingBuffer.current.push({ q0: rawQ0, q1: rawQ1 });
      }

      // 阶段6：方位解码 — 取滤波窗口中点的数字 flag 状态，辅助合成为 discrete 调试方位码
      const c1 = (w1Idx + WINDOW_CENTER_OFFSET) % newFrame.length;
      const c2 = (w2Idx + WINDOW_CENTER_OFFSET) % newFrame.length;
      const p1 = newFrame[c1];
      const p2 = newFrame[c2];

      if (p1 && p2) {
        const code = `${p1.flag1}${p1.flag2}${p2.flag1}${p2.flag2}`;
        const mag = Math.floor(Math.sqrt(corrQ0 * corrQ0 + corrQ1 * corrQ1));

        setCompassData({
          q0: Math.round(corrQ0), q1: Math.round(corrQ1),
          rawQ0: Math.round(rawQ0), rawQ1: Math.round(rawQ1),
          q0Bit: p1.flag1, q1Bit: p2.flag1,
          // 基于校正后的正切角在映射表中进行最近邻匹配，以输出平滑的罗盘方位
          heading: getNearestHeading(rawAngle, DEFAULT_MAP), magnitude: mag, rawCode: code,
          status: isProbeDisconnected ? "Disconnected" : "Active",
          balanceFactor: balanceFactor, axisToCompensate: 'NONE'
        });
      }

      if (!isPausedRef.current) {
        setDebugData(newFrame);
      }
      (window as any).__frame = newFrame; // 调试用：控制台输入 __frame 查看当前帧数据
    }
    tempDebugBuffer.current = [];
  };

  /**
   * 零点校准：消除 PCB 静态偏置，使短路信号从零基线计算
   * 流程：采集 1 秒底噪（baseQ0/baseQ1）→ 自适应稳定性检验 → 归零 globalOffset → 计算方差 BIAS
   */
  const handleZeroCalibrate = () => {
    if (isZeroSampling) return;
    setIsZeroSampling(true);
    setZeroCalibStatus('IDLE');
    zeroSamplingBuffer.current = [];

    setTimeout(() => {
      setIsZeroSampling(false);
      setZeroCalibEverRun(true);
      const samples = zeroSamplingBuffer.current;
      if (samples.length < 5) {
        setZeroCalibStatus('FAILED');
        setZeroCalibResult(null);
        return;
      }

      let sumQ0 = 0, sumQ1 = 0;
      let minQ0 = Infinity, maxQ0 = -Infinity;
      let minQ1 = Infinity, maxQ1 = -Infinity;

      for (const s of samples) {
        sumQ0 += s.q0;
        sumQ1 += s.q1;
        if (s.q0 < minQ0) minQ0 = s.q0;
        if (s.q0 > maxQ0) maxQ0 = s.q0;
        if (s.q1 < minQ1) minQ1 = s.q1;
        if (s.q1 > maxQ1) maxQ1 = s.q1;
      }

      const avgQ0 = sumQ0 / samples.length;
      const avgQ1 = sumQ1 / samples.length;

      const rangeQ0 = maxQ0 - minQ0;
      const rangeQ1 = maxQ1 - minQ1;

      // 稳定性校验：
      // 如果数据波动范围超过设定阈值（代表手抖或表笔接触不良），则判定校准失败。
      // 正常表笔短接静置时，典型的 ADC 随机底噪通常远小于 1000（一般 < 50）。
      const STABILITY_THRESHOLD = Math.max(1000, Math.max(Math.abs(avgQ0), Math.abs(avgQ1)) * 0.15);

      const isStableQ0 = rangeQ0 < STABILITY_THRESHOLD;
      const isStableQ1 = rangeQ1 < STABILITY_THRESHOLD;

      if (isStableQ0 && isStableQ1) {
        // 校准解算：扣除两通道直流偏置的平均值，使波形信号重新在零刻度线水平对齐中心
        const totalAvg = (avgQ0 + avgQ1) / 2;
        const newGlobalOffset = Math.round(globalOffset - totalAvg);
        setGlobalOffset(newGlobalOffset);

        // 计算方差：用以评估零偏校准后残余波形的底噪标准差（BIAS）
        let varQ0 = 0, varQ1 = 0;
        for (const s of samples) {
          varQ0 += (s.q0 - avgQ0) ** 2;
          varQ1 += (s.q1 - avgQ1) ** 2;
        }
        varQ0 /= samples.length;
        varQ1 /= samples.length;
        const bias = Math.round(Math.sqrt((varQ0 + varQ1) / 2));

        setZeroCalibResult({ q0: Math.round(avgQ0), q1: Math.round(avgQ1), bias });
        setZeroCalibStatus('SUCCESS');
      } else {
        setZeroCalibResult(null);
        setZeroCalibStatus('FAILED');
      }
      setTimeout(() => setZeroCalibStatus('IDLE'), 3000);
    }, 1000);
  };

  /**
   * 最近邻角度匹配：将计算的原始极角归一化到 0-360°，并在映射表中寻找环状最小夹角对应的罗盘目标指向角
   */
  const getNearestHeading = (rawAngle: number, map: any[]) => {
    let normalized = rawAngle;
    // 归一化至 [0, 360) 角度区间
    while (normalized < 0) normalized += 360;
    while (normalized >= 360) normalized -= 360;

    let minDiff = Infinity;
    let bestHeading = 0;
    // 遍历映射表，计算环状夹角差值（处理跨 360° 越界的情况）
    for (const item of map) {
      let diff = Math.abs(normalized - item.ref);
      if (diff > 180) diff = 360 - diff; // 越界补角计算，得到真实环状夹角
      if (diff < minDiff) { minDiff = diff; bestHeading = item.heading; }
    }
    return bestHeading;
  };

  /**
   * 启动方向校准采样：在用户短接特定角激励源（右上角 NW / 右下角 SW）时，采集 1 秒数据并进行稳定性校验，通过后记录其参考向量
   */
  const startSampling = (step: string) => {
    // 拦截重复采集操作，且必须在串口已连接时才允许校准
    if (samplingStep !== null || !connected) return;
    setSamplingStep(step);
    setSampleProgress(0);
    samplingBuffer.current = [];
    const startTime = Date.now();

    // 定时轮询，每 30 毫秒刷新进度并在 1 秒后结算采样
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setSampleProgress(Math.min(100, (elapsed / 1000) * 100));

      if (elapsed >= 1000) {
        clearInterval(timer);
        const samples = samplingBuffer.current;

        // 异常处理：如果没有捕获到任何高频数据包，为保障体验，采用当前的瞬时裸值作为后备采样
        if (samples.length === 0) {
          setCalibRefVectors(prev => ({ ...prev, [step]: { q0: currentRawValuesRef.current.q0, q1: currentRawValuesRef.current.q1 } }));
          setSpatialCalibStatus(prev => ({ ...prev, [step]: 'SUCCESS' }));
          setTimeout(() => setSpatialCalibStatus(prev => ({ ...prev, [step]: 'IDLE' })), 3000);
          setSamplingStep(null);
          return;
        }

        // 样本数量过少，表明传输极不稳定，判定校准失败
        if (samples.length < 5) {
          setSpatialCalibStatus(prev => ({ ...prev, [step]: 'FAILED' }));
          setTimeout(() => setSpatialCalibStatus(prev => ({ ...prev, [step]: 'IDLE' })), 3000);
          setSamplingStep(null);
          return;
        }

        let sumQ0 = 0, sumQ1 = 0;
        let minQ0 = Infinity, maxQ0 = -Infinity;
        let minQ1 = Infinity, maxQ1 = -Infinity;

        // 统计 1 秒内全部样本的累加值和波动极值
        for (const s of samples) {
          sumQ0 += s.q0;
          sumQ1 += s.q1;
          if (s.q0 < minQ0) minQ0 = s.q0;
          if (s.q0 > maxQ0) maxQ0 = s.q0;
          if (s.q1 < minQ1) minQ1 = s.q1;
          if (s.q1 > maxQ1) maxQ1 = s.q1;
        }

        const avgQ0 = sumQ0 / samples.length;
        const avgQ1 = sumQ1 / samples.length;
        const rangeQ0 = maxQ0 - minQ0;
        const rangeQ1 = maxQ1 - minQ1;

        // 稳定性阈值计算（同零点校准）：保证波动在合理范围
        const STABILITY_THRESHOLD = Math.max(1000, Math.max(Math.abs(avgQ0), Math.abs(avgQ1)) * 0.15);

        // 如果波动小于阈值，说明表笔接触稳定且无剧烈抖动，保存平均采样值，否则宣告失败
        if (rangeQ0 < STABILITY_THRESHOLD && rangeQ1 < STABILITY_THRESHOLD) {
          setCalibRefVectors(prev => ({ ...prev, [step]: { q0: avgQ0, q1: avgQ1 } }));
          setSpatialCalibStatus(prev => ({ ...prev, [step]: 'SUCCESS' }));
        } else {
          setSpatialCalibStatus(prev => ({ ...prev, [step]: 'FAILED' }));
        }

        // 3 秒后状态重置为 IDLE，重置步骤状态以允许下一次操作
        setTimeout(() => setSpatialCalibStatus(prev => ({ ...prev, [step]: 'IDLE' })), 3000);
        setSamplingStep(null);
      }
    }, 30);
  };

  /**
   * 2点方向校准：仿射变换矩阵求解
   *
   * 将两个校准点的原始采样值映射到正交目标矢量，补偿 Q0/Q1 通道灵敏度差异和串扰。
   * 输出 2×2 矩阵 [m00 m01; m10 m11]，在 commitFrame 中施加：corr = matrix × raw
   *
   * 目标映射（与 DEFAULT_MAP 公式 heading=(360-ref)%360 对齐）：
   *   NW(右上角激励源) → [-a, +a]ᵀ  atan2→135°→ref=135→heading=225°=左下方
   *   SW(右下角激励源) → [+a, +a]ᵀ  atan2→ 45°→ref= 45→heading=315°=左上方
   *
   * 为什么右上角映射到左下方？
   *   表笔点在右上角激励源时，电场梯度从右上角指向 PCB 中心（左下方向）。
   *   罗盘指示"请向左下方移动"——这才是从探针位置指向短路点的正确导航方向。
   *   若映射为(+a,+a)，atan2=45°→heading=315°→罗盘指示"左上"——那是探针位置而非短路方向。
   *
   * 数学推导（Cramer 法则求解 M·vNW=[-a,+a]ᵀ, M·vSW=[+a,+a]ᵀ）：
   *   m00 = -a*(y1+y2)/det    m01 = +a*(x1+x2)/det
   *   m10 = +a*(y2-y1)/det    m11 = +a*(x1-x2)/det
   */
  const finishCalibration = () => {
    const vNW = calibRefVectors["NW"];
    const vSW = calibRefVectors["SW"];
    if (!vNW || !vSW) return;
    const x1 = vNW.q0, y1 = vNW.q1, x2 = vSW.q0, y2 = vSW.q1;
    // 行列式为零意味着两矢量共线，无法构建二维坐标系
    const det = x1 * y2 - x2 * y1;
    if (Math.abs(det) < 0.001) return;
    // 两采样矢量的幅度平均
    const mag1 = Math.sqrt(x1 * x1 + y1 * y1), mag2 = Math.sqrt(x2 * x2 + y2 * y2);
    const s = (mag1 + mag2) / 2;
    const a = s * Math.SQRT1_2;
    // 矩阵元素（推导见顶部注释）
    const m00 = -(a / det) * (y1 + y2);
    const m01 = (a / det) * (x1 + x2);
    const m10 = (a / det) * (y2 - y1);
    const m11 = (a / det) * (x1 - x2);
    setCalibMatrix([m00, m01, m10, m11]);
    // 灵敏度比值 K
    setBalanceFactor(Number((Math.max(mag1, mag2) / Math.min(mag1, mag2)).toFixed(4)));
    setCompAxis(mag1 < mag2 ? 'Q0' : 'Q1');
  };

  /**
   * 重置校准参数：清除空间校准和零偏校准的全部结果，并将纠偏矩阵还原为标准单位阵
   */
  const resetCalibration = () => {
    setCalibMatrix([1, 0, 0, 1]);
    setBalanceFactor(1.0);
    setCompAxis('NONE');
    setCalibRefVectors({ "NW": null, "SW": null });
    setSpatialCalibStatus({ "NW": 'IDLE', "SW": 'IDLE' });
    setZeroCalibResult(null);
    setZeroCalibEverRun(false);
    setZeroCalibStatus('IDLE');
  };

  /**
   * 确认并应用校准：若双方向均采样完毕则求解仿射逆矩阵，最后切换回罗盘主视图
   */
  const handleCalibConfirm = () => {
    if (allCalibrated) finishCalibration();
    setViewMode('COMPASS');
  };

  // --- 串口底层连接生命周期与心跳看门狗 ---
  /**
   * 串口底层线程与心跳 Ref：缓存读取循环的 Promise 引用以防断连死锁，并保存数据超时定时器以做假死失联判定
   */
  const readLoopPromiseRef = useRef<Promise<void> | null>(null);

  const hasValidDataRef = useRef(false);
  const dataTimeoutRef = useRef<any>(null);

  /**
   * 串口高频读取主循环：在独立异步逻辑中维持串口流读取，负责高频字节流拼接、帧同步对齐、解密解析并提交数据消费
   */
  const readLoop = async (currentPort: SerialPort) => {
    let reader;
    try {
      if (!currentPort.readable) throw new Error("Port not readable");
      reader = currentPort.readable.getReader();
      readerRef.current = reader;
    } catch (e) {
      console.error("Failed to get reader:", e);
      disconnectSerial();
      return;
    }

    let byteBuffer = new Uint8Array(0);

    try {
      while (keepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.length > 0) {
          // 将新读取的字节追加到 byteBuffer 缓冲区末尾
          const merged = new Uint8Array(byteBuffer.length + value.length);
          merged.set(byteBuffer);
          merged.set(value, byteBuffer.length);
          byteBuffer = merged;

          // 循环扫描并解析数据包：单个加密帧的固定长度为 206 字节
          while (byteBuffer.length >= 206) {
            const result = scanFrame(byteBuffer, sessionIdRef.current);
            if (result) {
              // 首包解析成功，代表实质性握手打通，重置 UI 上的连接中加载状态
              if (!hasValidDataRef.current) {
                hasValidDataRef.current = true;
                setIsConnecting(false);
              }
              // 提交波形点集合，触发 commitFrame 处理管线，并截断丢弃已消费的字节
              tempDebugBuffer.current = result.points;
              commitFrame();
              byteBuffer = byteBuffer.slice(result.consumed);
            } else {
              // 校验失败或当前非 0xAA 帧头，滑动到下一个 0xAA 字节处以重新寻找帧同步起点，防乱码/粘包
              const nextAA = byteBuffer.indexOf(0xAA, 1);
              if (nextAA === -1) {
                byteBuffer = new Uint8Array(0);
              } else {
                byteBuffer = byteBuffer.slice(nextAA);
              }
              break;
            }
          }
        }
      }
    } catch (e) {
      console.error("Read Loop Error:", e);
    } finally {
      console.log("Releasing reader lock");
      try { await reader.cancel(); } catch (e) { }
      try { reader.releaseLock(); } catch (e) { }
      if (keepReadingRef.current) disconnectSerial();
    }
  };

  // 从已知端口列表中找到 VID/PID 匹配的端口
  const findMatchingPort = async (): Promise<SerialPort | null> => {
    // @ts-ignore
    const ports = await navigator.serial.getPorts().catch(() => []);
    for (const p of ports) {
      try {
        // @ts-ignore - getInfo() is part of Web Serial API spec
        const info = p.getInfo();
        if (info?.usbVendorId && info?.usbProductId
          && deviceVidRef.current !== null && devicePidRef.current !== null
          && info.usbVendorId === deviceVidRef.current
          && info.usbProductId === devicePidRef.current) {
          return p;
        }
      } catch (e) { /* getInfo not supported on this platform */ }
    }
    return null;
  };

  // 连接成功后自动学习设备 VID/PID
  const learnDeviceIdentity = async (p: SerialPort) => {
    try {
      // @ts-ignore - getInfo() is part of Web Serial API spec
      const info = p.getInfo();
      if (info?.usbVendorId && info?.usbProductId) {
        setDeviceVid(info.usbVendorId);
        setDevicePid(info.usbProductId);
        console.log(`Device VID/PID learned: ${info.usbVendorId.toString(16)}:${info.usbProductId.toString(16)}`);
      }
    } catch (e) { /* getInfo not supported */ }
  };

  /**
   * 建立串口连接：优先尝试基于已保存的 VID/PID 自动静默连接，若匹配失败，则弹出原生选择框供用户授权，连接成功后学习并记录设备身份
   */
  const connectToPort = async () => {
    if (connected) return;
    setConnectionError(null);
    try {
      // 安全清理：在开始新连接前，确保旧的连接已彻底断开并释放
      await disconnectSerial();

      // 先检查已知端口列表中，是否存在与保存的 VID/PID 匹配的设备
      const matchedPort = await findMatchingPort();
      if (matchedPort) {
        console.log("Connecting to matched device silently...");
        await setupPort(matchedPort);
        await learnDeviceIdentity(matchedPort);
        return;
      }

      // 如果没有找到匹配的历史设备，弹出浏览器原生串口选择对话框
      // @ts-ignore
      const p = await navigator.serial.requestPort().catch((err: any) => {
        console.log("Port selection skipped/cancelled:", err.message);
        if (!err.message?.includes('cancelled')) {
          setConnectionError(language === 'zh'
            ? "串口选择错误：" + err.message
            : "Port selection error: " + err.message);
        }
        return null;
      });

      if (p) {
        await setupPort(p);
        await learnDeviceIdentity(p);
      }
    } catch (err) {
      console.error("Connection Error:", err);
      setConnected(false);
    }
  };

  /**
   * 安全断开串口连接：按序释放读取器→等待读取循环退出→关闭物理端口，全程防重入保护
   */
  const disconnectSerial = async () => {
    // 防重入锁：避免多次并发触发断连导致资源竞争
    if (isDisconnectingRef.current) return;
    isDisconnectingRef.current = true;
    setIsConnecting(false);

    // 清除数据有效性看门狗计时器，防止断连后仍触发超时回调
    if (dataTimeoutRef.current) {
      clearTimeout(dataTimeoutRef.current);
      dataTimeoutRef.current = null;
    }

    try {
      // 步骤1：通知 readLoop 退出 while 循环
      keepReadingRef.current = false;
      // 步骤2：取消流读取器，使 reader.read() 的 pending Promise 立即 resolve({done:true})
      if (readerRef.current) {
        try {
          await readerRef.current.cancel();
        } catch (e) { }
        readerRef.current = null;
      }

      // 步骤3：等待 readLoop 的 finally 块执行完毕后再关闭端口，避免锁未释放导致 close() 死锁
      if (readLoopPromiseRef.current) {
        await readLoopPromiseRef.current;
        readLoopPromiseRef.current = null;
      }

      // 步骤4：关闭物理串口端口
      if (portRef.current) {
        try {
          await portRef.current.close();
        } catch (e) { console.error("Close failed:", e); }
        portRef.current = null;
      }
    } catch (err) {
      console.error("Disconnect Error:", err);
    } finally {
      // 步骤5：无论成功与否，均重置 UI 状态与防重入标志
      setPort(null); setConnected(false); isDisconnectingRef.current = false;
    }
  };

  /**
   * 串口配置与启动：打开端口（115200bps）→ 启动 readLoop → 设置数据有效性超时看门狗
   * 3 秒内未收到合法数据帧 → 判定连接失败 → 内联错误横幅 → 自动断开
   */
  const setupPort = async (p: SerialPort) => {
    setConnectionError(null);
    setIsConnecting(true);
    // 打开物理串口（波特率 115200），如果端口已被打开则尝试复用
    try {
      await p.open({ baudRate: 115200 });
    } catch (err: any) {
      const msg = String(err.message || err);
      if (msg.includes("already open") || msg.includes("The port is already open")) {
        console.log("Port was already open, attempting to reuse...");
      } else {
        console.error("Failed to open port:", err);
        setConnectionError(language === 'zh'
          ? "串口打开失败：" + msg + "。请检查该端口是否被其他程序（如串口助手）占用。"
          : "Failed to open port: " + msg + ". Check if another program is using this port.");
        setConnected(false);
        setPort(null);
        setIsConnecting(false);
        return;
      }
    }

    // 初始化连接状态，标记端口就绪并清空数据有效标志（等待首个合法帧确认）
    setPort(p);
    portRef.current = p;
    setConnected(true);
    keepReadingRef.current = true;
    hasValidDataRef.current = false;

    // 生成 8 字节随机会话 ID，组装 11 字节握手包发送给 MCU
    // 格式: [0x55 帧头] [0x01 命令] [8 字节 Session ID LE] [1 字节校验和]
    const sessionId = new Uint8Array(8);
    crypto.getRandomValues(sessionId);
    sessionIdRef.current = sessionId;
    const handshake = new Uint8Array(11);
    handshake[0] = 0x55;         // 帧头
    handshake[1] = 0x01;         // 命令码：会话建立
    handshake.set(sessionId, 2); // 会话 ID（小端序，字节 2~9）
    let checksum = 0;
    for (let i = 0; i < 10; i++) checksum += handshake[i];
    handshake[10] = checksum & 0xFF; // 校验和
    try {
      if (!p.writable) {
        console.error("Port writable is null — handshake NOT sent. Check port open permissions.");
      } else {
        const writer = p.writable.getWriter();
        await writer.write(handshake);
        writer.releaseLock();
        console.log("Handshake sent, session ID:", Array.from(sessionId).map(b => b.toString(16).padStart(2, '0')).join(' '));
      }
    } catch (e) {
      console.error("Failed to send handshake:", e);
    }

    // 等待 MCU 应答帧（最多重试 3 次，每次超时 500ms）
    if (p.readable) {
      let ackReceived = false;
      for (let attempt = 0; attempt < 3 && !ackReceived; attempt++) {
        if (attempt > 0) {
          // 前一次未收到应答，重发握手包
          console.log(`Handshake retry ${attempt + 1}/3...`);
          try {
            const writer = p.writable?.getWriter();
            if (writer) { await writer.write(handshake); writer.releaseLock(); }
          } catch (e) { /* ignore */ }
        }
        try {
          const ackReader = p.readable.getReader();
          let ackBuffer = new Uint8Array(0);
          const deadline = Date.now() + 500;
          // 在 500ms 窗口内持续读取串口数据，拼装并搜索 ACK 帧
          while (Date.now() < deadline) {
            // 超时控制：用 Promise.race 限制单次 read 等待时间，避免无限阻塞
            const readPromise = ackReader.read();
            const timeoutPromise = new Promise<{ value?: Uint8Array; done?: boolean }>((resolve) =>
              setTimeout(() => resolve({ value: undefined, done: false }), Math.max(1, deadline - Date.now()))
            );
            const { value, done } = await Promise.race([readPromise, timeoutPromise]);
            if (done || !value) {
              if (Date.now() >= deadline) break;
              continue;
            }
            const merged = new Uint8Array(ackBuffer.length + value.length);
            merged.set(ackBuffer);
            merged.set(value, ackBuffer.length);
            ackBuffer = merged;
            // 扫描 ACK 应答帧格式: [0x55 帧头] [0x02 应答码] [8B sessionId] [1B 校验和]
            while (ackBuffer.length >= 11) {
              // 帧头不匹配，滑动到下一个 0x55
              if (ackBuffer[0] !== 0x55 || ackBuffer[1] !== 0x02) {
                const next55 = ackBuffer.indexOf(0x55, 1);
                ackBuffer = next55 === -1 ? new Uint8Array(0) : ackBuffer.slice(next55);
                if (ackBuffer.length < 11) break;
                continue;
              }
              // 校验和验证
              let ackChecksum = 0;
              for (let i = 0; i < 10; i++) ackChecksum += ackBuffer[i];
              if ((ackChecksum & 0xFF) !== ackBuffer[10]) {
                ackBuffer = ackBuffer.slice(1); // 校验失败，跳过当前字节
                continue;
              }
              // 比对会话 ID 是否与本次发送的一致
              const ackSid = ackBuffer.slice(2, 10);
              let sidMatch = true;
              for (let i = 0; i < 8; i++) {
                if (ackSid[i] !== sessionId[i]) { sidMatch = false; break; }
              }
              if (sidMatch) {
                ackReceived = true;
                console.log("Handshake ACK received, session confirmed");
                break;
              }
              ackBuffer = ackBuffer.slice(1); // 会话 ID 不匹配，跳过继续扫描
            }
          }
          try { ackReader.releaseLock(); } catch (e) { }
        } catch (e) {
          console.warn("ACK read attempt failed:", e);
        }
      }

      if (!ackReceived) {
        console.error("Handshake failed: no valid ACK after 3 attempts");
        setConnectionError(language === 'zh'
          ? "握手失败：未收到设备应答，请检查设备是否已正确烧录固件"
          : "Handshake failed: no ACK from device. Check firmware.");
        disconnectSerial();
        return;
      }
    }

    // 握手成功：启动高频数据读取循环
    readLoopPromiseRef.current = readLoop(p);
    console.log("Port connected successfully");

    // 数据有效性超时看门狗：3 秒内 readLoop 未解出合法数据帧，则判定为通信异常并自动断连
    if (dataTimeoutRef.current) clearTimeout(dataTimeoutRef.current);
    dataTimeoutRef.current = setTimeout(() => {
      if (portRef.current === p && !hasValidDataRef.current) {
        setIsConnecting(false);
        setConnectionError(language === 'zh'
          ? "未检测到有效数据流，请确认仪器电源已打开且选择了正确的COM口"
          : "No valid data detected. Ensure device is powered on and correct COM port is selected.");
        disconnectSerial();
      }
    }, 3000);
  };

  /**
   * 串口热插拔监听与自动重连：组件挂载时注册 USB 插拔事件，尝试自动匹配历史设备；卸载时清理端口防止 HMR 重载后端口死锁
   */
  useEffect(() => {
    let mounted = true;

    // USB 设备插入事件：触发自动匹配已知 VID/PID 的设备
    const handleConnect = () => {
      if (!mounted) return;
      console.log("Device connected event detected");
      tryAutoConnect();
    };

    // USB 设备拔出事件：如果拔出的正是当前连接的端口，立即执行断连清理
    const handleDisconnect = (event: any) => {
      console.log("Device disconnected event detected");
      if (portRef.current === event.port) {
        disconnectSerial();
      }
    };

    // 自动连接尝试：延迟 500ms 等待操作系统枚举完毕后，检索匹配端口并静默连接
    const tryAutoConnect = async () => {
      if (portRef.current) return; // 已连接则跳过
      try {
        // Electron 桌面环境中串口枚举可能延迟，等待 500ms 后再尝试
        await new Promise(r => setTimeout(r, 500));
        const matchedPort = await findMatchingPort();
        if (matchedPort) {
          console.log("Auto-connecting to known device...");
          await setupPort(matchedPort);
        }
      } catch (e) {
        console.log("Auto-connect failed:", e);
      }
    };

    // @ts-ignore
    navigator.serial.addEventListener('connect', handleConnect);
    // @ts-ignore
    navigator.serial.addEventListener('disconnect', handleDisconnect);

    // 组件首次挂载时立即尝试一次自动连接
    tryAutoConnect();

    return () => {
      mounted = false;
      // @ts-ignore
      navigator.serial.removeEventListener('connect', handleConnect);
      // @ts-ignore
      navigator.serial.removeEventListener('disconnect', handleDisconnect);

      // 组件卸载清理：关闭端口以防止 Vite HMR 热重载时出现 "Already Open" 端口死锁
      if (portRef.current) {
        console.log("Component unmounting, closing port...");
        disconnectSerial();
      }
    };
  }, []);

  /**
   * 校准预览自适应缩放：根据当前帧的电压极值动态计算 Y 轴显示范围，使波形始终居中且留有 1.5 倍余量
   */
  const previewBounds = useMemo(() => {
    if (debugData.length === 0) return { min: 0, max: 100, range: 100 };
    let minVal = Infinity, maxVal = -Infinity;
    for (const p of debugData) {
      const v = p.value + globalOffset;
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
    const range = Math.max(50, (maxVal - minVal) * 1.5);
    const mid = (maxVal + minVal) / 2;
    return { min: mid - range / 2, max: mid + range / 2, range };
  }, [debugData, globalOffset]);

  /**
   * 界面国际化文本映射：根据当前语言设置返回对应的中/英文 UI 文案
   */
  const texts = {
    title: language === 'zh' ? "短路测试仪" : "Short Circuit Tester",
    disconnect: language === 'zh' ? "断开连接" : "DISCONNECT",
    connect: language === 'zh' ? "连接设备" : "CONNECT",
    nav_compass: language === 'zh' ? "方位检测" : "DETECTION",
    nav_calib: language === 'zh' ? "空间校准" : "CALIBRATION",
    nav_debug: language === 'zh' ? "调试分析" : "DEBUG",
    nav_settings: language === 'zh' ? "系统配置" : "SETTINGS",
  };

  // ==================== 第三段：渲染输出（类似 C 的 GUI Draw 绘图） ====================
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-800 dark:text-slate-200 font-sans flex flex-col overflow-hidden transition-colors duration-300">
      {isConnecting && (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-white/95 dark:bg-slate-950/95 animate-in fade-in duration-300">
          <Timer className="animate-spin text-cyan-600 dark:text-cyan-400 mb-6" size={56} />
          <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-widest uppercase animate-pulse">
            {language === 'zh' ? "正在等待设备数据流..." : "WAITING FOR DATA STREAM..."}
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm font-mono">
            {language === 'zh' ? "请确保设备已开机并输出正确波特率" : "Ensure device is powered on and check connection"}
          </p>
          <button onClick={disconnectSerial} className="mt-6 px-8 py-2.5 bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-400 text-[10px] font-black tracking-widest rounded-xl border border-slate-300 dark:border-white/10 hover:bg-slate-300 dark:hover:bg-white/10 transition-all">
            {language === 'zh' ? '取消' : 'CANCEL'}
          </button>
        </div>
      )}

      <header className="flex-none border-b border-slate-200 bg-white/80 dark:border-white/5 dark:bg-[#020617]/80 backdrop-blur-2xl px-6 py-4 flex items-center justify-between transition-colors duration-300">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl border border-white/10"><Usb className="text-white" size={22} /></div>
          <div>
            <h1 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight transition-colors duration-300">{texts.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <nav className="bg-slate-200/50 dark:bg-slate-900/50 p-1 rounded-2xl border border-slate-300/50 dark:border-white/5 flex items-center transition-all duration-300 shadow-inner">
            <button
              onClick={() => setViewMode('COMPASS')}
              className={`px-6 py-2 rounded-xl text-[11px] font-black tracking-widest transition-all flex flex-col items-center gap-0.5 ${viewMode === 'COMPASS' ? 'bg-cyan-600 text-white shadow-lg scale-[1.02]' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
            >
              <span>{texts.nav_compass}</span>
              <span className="opacity-40 text-[10px] font-medium tracking-tight">DETECTION</span>
            </button>
            <button
              onClick={() => setViewMode('CALIBRATION')}
              className={`px-6 py-2 rounded-xl text-[11px] font-black tracking-widest transition-all flex flex-col items-center gap-0.5 ${viewMode === 'CALIBRATION' ? 'bg-cyan-600 text-white shadow-lg scale-[1.02]' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
            >
              <span>{texts.nav_calib}</span>
              <span className="opacity-40 text-[10px] font-medium tracking-tight">CALIBRATION</span>
            </button>

            {isDeveloperMode && (
              <button
                onClick={() => setViewMode('DEBUG')}
                className={`px-6 py-2 rounded-xl text-[11px] font-black tracking-widest transition-all flex flex-col items-center gap-0.5 ${viewMode === 'DEBUG' ? 'bg-cyan-600 text-white shadow-lg scale-[1.02]' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                <span>{texts.nav_debug}</span>
                <span className="opacity-40 text-[10px] font-medium tracking-tight">DEBUG</span>
              </button>
            )}

            <button
              onClick={() => setViewMode('SETTINGS')}
              className={`px-6 py-2 rounded-xl text-[11px] font-black tracking-widest transition-all flex flex-col items-center gap-0.5 ${viewMode === 'SETTINGS' ? 'bg-cyan-600 text-white shadow-lg scale-[1.02]' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
            >
              <span>{texts.nav_settings}</span>
              <span className="opacity-40 text-[10px] font-medium tracking-tight">SETTINGS</span>
            </button>
          </nav>

          <div className="w-px h-8 bg-slate-300 dark:bg-white/10 mx-2" />

          {connected ? (
            <button onClick={disconnectSerial} className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-black tracking-widest rounded-xl border border-red-500/20 transition-all">{texts.disconnect}</button>
          ) : (
            <button onClick={connectToPort} className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-black tracking-widest rounded-xl shadow-xl flex items-center gap-2 transition-all active:scale-95"><PlugZap size={15} /> {texts.connect}</button>
          )}
        </div>
      </header>

      <main className="flex-grow flex flex-col min-h-0 h-full p-4 lg:p-6 relative overflow-hidden">
        {viewMode === 'CALIBRATION' && (
          <CalibrationView
            connected={connected}
            language={language}
            isZeroSampling={isZeroSampling}
            zeroCalibEverRun={zeroCalibEverRun}
            zeroCalibResult={zeroCalibResult}
            zeroCalibStatus={zeroCalibStatus}
            onZeroCalibrate={handleZeroCalibrate}
            calibRefVectors={calibRefVectors}
            samplingStep={samplingStep}
            spatialCalibStatus={spatialCalibStatus}
            sampleProgress={sampleProgress}
            allCalibrated={allCalibrated}
            onSpatialCalibrate={startSampling}
            onResetCalibration={resetCalibration}
            onConfirm={handleCalibConfirm}
            debugData={debugData}
            globalOffset={globalOffset}
            previewBounds={previewBounds}
          />
        )}
        {viewMode === 'COMPASS' && (
          !connected && !skipWelcome ? (
            <WelcomeScreen
              language={language}
              onConnect={connectToPort}
              onSkipChange={setSkipWelcome}
              connectionError={connectionError}
            />
          ) : (
            <div className="flex-grow flex items-center justify-center">
              <Compass
                data={compassData}
                connected={connected}
                threshold={threshold}
                onThresholdChange={setThreshold}
                thresholdMin={thresholdMin}
                thresholdMax={thresholdMax}
                thresholdStep={thresholdStep}
                probeThreshold={probeThreshold}
                language={language}
              />
            </div>
          )
        )}
        {viewMode === 'DEBUG' && (
          <div className="flex-grow flex flex-col min-h-0 h-full">
            <DebugChart
              data={debugData} isPaused={isPaused} onTogglePause={() => setIsPaused(!isPaused)}
              win1Index={win1Index} win2Index={win2Index} onWin1IndexChange={setWin1Index} onWin2IndexChange={setWin2Index}
              win1Offset={win1Offset} onWin1OffsetChange={setWin1Offset}
              win2Offset={win2Offset} onWin2OffsetChange={setWin2Offset}
              globalOffset={globalOffset} onGlobalOffsetChange={setGlobalOffset}
              directionMap={DEFAULT_MAP}
              calibMatrix={calibMatrix}
              // Passed down props for Zero Calibration
              onZeroCalibrate={handleZeroCalibrate}
              isZeroSampling={isZeroSampling}
              zeroCalibStatus={zeroCalibStatus}
              zeroCalibResult={zeroCalibResult}
              zeroCalibEverRun={zeroCalibEverRun}
              // New Spatial Calibration & Navigation props
              onSpatialCalibrate={startSampling}
              calibRefVectors={calibRefVectors}
              samplingStep={samplingStep}
              onBack={() => setViewMode('SETTINGS')}
              language={language}
            />
          </div>
        )}
        {viewMode === 'SETTINGS' && (
          <div className="flex-grow flex flex-col min-h-0 h-full overflow-y-auto">
            <Settings
              language={language} setLanguage={setLanguage}
              themeMode={themeMode} setThemeMode={setThemeMode}
              threshold={threshold} setThreshold={setThreshold}
              thresholdMin={thresholdMin} setThresholdMin={setThresholdMin}
              thresholdMax={thresholdMax} setThresholdMax={setThresholdMax}
              thresholdStep={thresholdStep} setThresholdStep={setThresholdStep}
              globalOffset={globalOffset} setGlobalOffset={setGlobalOffset}
              win1Offset={win1Offset} setWin1Offset={setWin1Offset}
              win2Offset={win2Offset} setWin2Offset={setWin2Offset}
              probeThreshold={probeThreshold} setProbeThreshold={setProbeThreshold}
              onClose={() => setViewMode('COMPASS')}
              onEnterDevMode={() => setViewMode('DEBUG')}
              isDeveloperMode={isDeveloperMode}
              setIsDeveloperMode={setIsDeveloperMode}
            />
          </div>
        )}
      </main>

      {/* Floating error banner (shown when WelcomeScreen is not visible) */}
      {connectionError && !isConnecting && (skipWelcome || viewMode !== 'COMPASS') && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 bg-red-50 dark:bg-red-950/90 border border-red-200 dark:border-red-500/20 rounded-xl shadow-xl backdrop-blur-xl max-w-lg">
          <AlertCircle className="text-red-500 flex-shrink-0" size={18} />
          <span className="text-sm text-red-600 dark:text-red-400 flex-grow">{connectionError}</span>
          <button onClick={() => setConnectionError(null)} className="text-red-400 hover:text-red-300 ml-2 text-lg leading-none">&times;</button>
        </div>
      )}
    </div>
  );
}
export default App;
