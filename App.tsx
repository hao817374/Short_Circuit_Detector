
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Compass } from './components/Compass';
import { DebugChart } from './components/DebugChart';
import { MultiFrameChart } from './components/MultiFrameChart';
import { Settings } from './components/Settings';
import { CompassData, SerialPort, DebugPoint, Language, ThemeMode } from './types';
import { Usb, PlugZap, Activity, BarChart2, Layers, Crosshair, CheckCircle2, ChevronRight, Timer, AlertCircle, Eye, Zap, Waves, Signal, Scale, Compass as CompassIcon, Navigation, Settings2, Trash2, Target, Move } from 'lucide-react';

type ViewMode = 'COMPASS' | 'DEBUG' | 'MULTI' | 'SETTINGS';

import { getWindowAvg, WINDOW_SIZE, WINDOW_CENTER_OFFSET } from './utils/dsp';

const POINTS_PER_FRAME = 103;

const DEFAULT_MAP = [
    { ref: 0, heading: 0 },      
    { ref: 45, heading: 315 },   
    { ref: 90, heading: 270 },   
    { ref: 135, heading: 225 },  
    { ref: 180, heading: 180 },  
    { ref: 225, heading: 135 },  
    { ref: 270, heading: 90 },   
    { ref: 315, heading: 45 },   
];

// Helper hook for localStorage persistence
function usePersistentState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading ${key} from localStorage`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage`, error);
    }
  }, [key, state]);

  return [state, setState];
}

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('COMPASS');
  const [port, setPort] = useState<SerialPort | null>(null);
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  const [compassData, setCompassData] = useState<CompassData>({ 
    q0: 0, q1: 0, rawQ0: 0, rawQ1: 0, q0Bit: 0, q1Bit: 0, heading: 0, magnitude: 0, rawCode: "00", status: "Waiting",
    balanceFactor: 1.0, axisToCompensate: 'NONE'
  });

  const [debugData, setDebugData] = useState<DebugPoint[]>([]);
  const tempDebugBuffer = useRef<DebugPoint[]>([]);
  
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<any>(null);
  const keepReadingRef = useRef(false);
  const isDisconnectingRef = useRef(false);

  // --- Persistent Settings ---
  const [language, setLanguage] = usePersistentState<Language>('app_language', 'zh');
  const [themeMode, setThemeMode] = usePersistentState<ThemeMode>('app_theme', 'dark');

  // Apply Theme Mode to HTML Element
  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  const [win1Index, setWin1Index] = usePersistentState('cfg_win1Index', 25);
  const [win2Index, setWin2Index] = usePersistentState('cfg_win2Index', 75); 
  const [globalOffset, setGlobalOffset] = usePersistentState('cfg_globalOffset', 160);
  const [threshold, setThreshold] = usePersistentState('cfg_threshold', 50);
  
  // Advanced Settings Persistence
  const [thresholdMin, setThresholdMin] = usePersistentState('cfg_thresholdMin', 5);
  const [thresholdMax, setThresholdMax] = usePersistentState('cfg_thresholdMax', 500);
  const [thresholdStep, setThresholdStep] = usePersistentState('cfg_thresholdStep', 5);

  const [win1Offset, setWin1Offset] = usePersistentState('cfg_win1Offset', 0);
  const [win2Offset, setWin2Offset] = usePersistentState('cfg_win2Offset', 0);
  const [probeThreshold, setProbeThreshold] = usePersistentState('cfg_probeThreshold', -4300);

  const [calibMatrix, setCalibMatrix] = usePersistentState<[number, number, number, number]>('cfg_calibMatrix', [1, 0, 0, 1]);
  const [balanceFactor, setBalanceFactor] = usePersistentState('cfg_balanceFactor', 1.0);
  // We don't necessarily need to persist compAxis separate from matrix logic, but keeping state consistent
  const [compAxis, setCompAxis] = useState<'Q0' | 'Q1' | 'NONE'>('NONE'); 

  // --- Zero Calibration State (Lifted from DebugChart) ---
  const [isZeroSampling, setIsZeroSampling] = useState(false);
  const [zeroCalibStatus, setZeroCalibStatus] = useState<'IDLE' | 'SUCCESS' | 'FAILED'>('IDLE');
  const zeroSamplingBuffer = useRef<{q0: number, q1: number}[]>([]);

  // Refs for high-speed loop access
  const stateRef = useRef({ 
    w1Idx: 25, w2Idx: 75, gOff: 160, 
    w1Off: 0, w2Off: 0,
    matrix: [1, 0, 0, 1] as [number, number, number, number],
    probeT: -4300,
    isZeroSampling: false
  });

  useEffect(() => { 
    stateRef.current = { 
        w1Idx: win1Index, w2Idx: win2Index, gOff: globalOffset, 
        w1Off: win1Offset, w2Off: win2Offset,
        matrix: calibMatrix,
        probeT: probeThreshold,
        isZeroSampling: isZeroSampling
    }; 
  }, [win1Index, win2Index, globalOffset, win1Offset, win2Offset, calibMatrix, probeThreshold, isZeroSampling]);

  const [isCalibrating2P, setIsCalibrating2P] = useState(false);
  const [calibRefVectors, setCalibRefVectors] = useState<Record<string, {q0: number, q1: number} | null>>({ "NW": null, "SW": null });
  const [samplingStep, setSamplingStep] = useState<string | null>(null);
  const [sampleProgress, setSampleProgress] = useState(0);
  const samplingBuffer = useRef<{q0: number, q1: number}[]>([]);
  const currentRawValuesRef = useRef<{q0: number, q1: number}>({ q0: 0, q1: 0 });

  const allCalibrated = useMemo(() => 
    calibRefVectors["NW"] !== null && calibRefVectors["SW"] !== null
  , [calibRefVectors]);

  const isCleared = useMemo(() => 
    calibRefVectors["NW"] === null && calibRefVectors["SW"] === null
  , [calibRefVectors]);

  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const commitFrame = () => {
     if (tempDebugBuffer.current.length >= POINTS_PER_FRAME) {
         const newFrame = tempDebugBuffer.current.slice(0, POINTS_PER_FRAME);
         const { w1Idx, w2Idx, gOff, w1Off, w2Off, matrix, probeT, isZeroSampling: zeroSampling } = stateRef.current;
         
         const baseQ0 = getWindowAvg(newFrame, w1Idx, gOff);
         const baseQ1 = getWindowAvg(newFrame, w2Idx, gOff);
         
         // Zero Calibration Buffer Collection
         if (zeroSampling) {
             zeroSamplingBuffer.current.push({ q0: baseQ0, q1: baseQ1 });
         }

         // Logic: Check if probe is disconnected based on dynamic threshold (Both must be below threshold)
         const isProbeDisconnected = baseQ0 < probeT && baseQ1 < probeT;

         const rawQ0 = baseQ0 + w1Off;
         const rawQ1 = baseQ1 + w2Off;
         
         currentRawValuesRef.current = { q0: rawQ0, q1: rawQ1 };

         const corrQ0 = rawQ0 * matrix[0] + rawQ1 * matrix[1];
         const corrQ1 = rawQ0 * matrix[2] + rawQ1 * matrix[3];

         const rawAngle = Math.atan2(corrQ1, corrQ0) * 180 / Math.PI;

         if (samplingStep !== null) {
             samplingBuffer.current.push({ q0: rawQ0, q1: rawQ1 });
         }

         const c1 = (w1Idx + WINDOW_CENTER_OFFSET) % newFrame.length;
         const c2 = (w2Idx + WINDOW_CENTER_OFFSET) % newFrame.length;
         const p1 = newFrame[c1];
         const p2 = newFrame[c2];

         if (p1 && p2) {
             const code = `${p1.flag1}${p1.flag2}${p2.flag1}${p2.flag2}`;
             const mag = Math.floor(Math.sqrt(corrQ0*corrQ0 + corrQ1*corrQ1));
             
             setCompassData({
                 q0: Math.round(corrQ0), q1: Math.round(corrQ1),
                 rawQ0: Math.round(rawQ0), rawQ1: Math.round(rawQ1),
                 q0Bit: p1.flag1, q1Bit: p2.flag1,
                 heading: getNearestHeading(rawAngle, DEFAULT_MAP), magnitude: mag, rawCode: code, 
                 status: isProbeDisconnected ? "Disconnected" : "Active",
                 balanceFactor: balanceFactor, axisToCompensate: 'NONE'
             });
         }

         if (!isPausedRef.current) {
             setDebugData(newFrame);
         }
     }
     tempDebugBuffer.current = [];
  };

  const handleZeroCalibrate = () => {
      if (isZeroSampling) return;
      setIsZeroSampling(true);
      setZeroCalibStatus('IDLE');
      zeroSamplingBuffer.current = [];

      setTimeout(() => {
          setIsZeroSampling(false);
          const samples = zeroSamplingBuffer.current;
          if (samples.length < 5) {
              setZeroCalibStatus('FAILED');
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

          // Stability Check: 
          // If fluctuation exceeds 1000 units (3 orders of magnitude), fail.
          // Typical ADC noise for shorted probes should be much lower (e.g. < 50)
          const STABILITY_THRESHOLD = 1000;

          const isStableQ0 = rangeQ0 < STABILITY_THRESHOLD;
          const isStableQ1 = rangeQ1 < STABILITY_THRESHOLD;

          if (isStableQ0 && isStableQ1) {
              // Calibration Logic: Center the signal
              const totalAvg = (avgQ0 + avgQ1) / 2;
              const newGlobalOffset = Math.round(globalOffset - totalAvg);
              setGlobalOffset(newGlobalOffset);

              setZeroCalibStatus('SUCCESS');
          } else {
              setZeroCalibStatus('FAILED');
          }
          setTimeout(() => setZeroCalibStatus('IDLE'), 3000);
      }, 1000);
  };

  const getNearestHeading = (rawAngle: number, map: any[]) => {
    let normalized = rawAngle;
    while (normalized < 0) normalized += 360;
    while (normalized >= 360) normalized -= 360;

    let minDiff = Infinity;
    let bestHeading = 0;
    for (const item of map) {
        let diff = Math.abs(normalized - item.ref);
        if (diff > 180) diff = 360 - diff; 
        if (diff < minDiff) { minDiff = diff; bestHeading = item.heading; }
    }
    return bestHeading;
  };

  const startSampling = (step: string) => {
      if (samplingStep !== null || !connected) return;
      setSamplingStep(step);
      setSampleProgress(0);
      samplingBuffer.current = [];
      const startTime = Date.now();
      const timer = setInterval(() => {
          const elapsed = Date.now() - startTime;
          setSampleProgress(Math.min(100, (elapsed / 1000) * 100));
          if (elapsed >= 1000) {
              clearInterval(timer);
              let avgQ0 = 0, avgQ1 = 0;
              if (samplingBuffer.current.length > 0) {
                  avgQ0 = samplingBuffer.current.reduce((acc, v) => acc + v.q0, 0) / samplingBuffer.current.length;
                  avgQ1 = samplingBuffer.current.reduce((acc, v) => acc + v.q1, 0) / samplingBuffer.current.length;
              } else {
                  avgQ0 = currentRawValuesRef.current.q0;
                  avgQ1 = currentRawValuesRef.current.q1;
              }
              setCalibRefVectors(prev => ({ ...prev, [step]: { q0: avgQ0, q1: avgQ1 } }));
              setSamplingStep(null);
          }
      }, 30);
  };

  const finishCalibration = () => {
      const vNW = calibRefVectors["NW"];
      const vSW = calibRefVectors["SW"];
      if (!vNW || !vSW) return;
      const x1 = vNW.q0, y1 = vNW.q1, x2 = vSW.q0, y2 = vSW.q1;
      const det = x1 * y2 - x2 * y1;
      if (Math.abs(det) < 0.001) return;
      const mag1 = Math.sqrt(x1*x1 + y1*y1), mag2 = Math.sqrt(x2*x2 + y2*y2);
      const s = (mag1 + mag2) / 2;
      const a = s * Math.SQRT1_2; 
      const m00 = (a / det) * (y1 + y2);
      const m01 = -(a / det) * (x1 + x2);
      const m10 = (a / det) * (y2 - y1);
      const m11 = (a / det) * (x1 - x2);
      setCalibMatrix([m00, m01, m10, m11]);
      setBalanceFactor(Number((Math.max(mag1, mag2) / Math.min(mag1, mag2)).toFixed(4)));
      setCompAxis(mag1 < mag2 ? 'Q0' : 'Q1');
      setIsCalibrating2P(false);
  };

  const resetCalibration = () => {
      setCalibMatrix([1, 0, 0, 1]);
      setBalanceFactor(1.0);
      setCompAxis('NONE');
      setCalibRefVectors({ "NW": null, "SW": null });
      // Modal stays open, allowing user to click "Confirm" to exit or Recalibrate
  };
  
  const handleConfirmAndExit = () => {
      if (allCalibrated) {
          finishCalibration();
      } else {
          setIsCalibrating2P(false);
      }
  };



  const readLoopPromiseRef = useRef<Promise<void> | null>(null);

  const hasValidDataRef = useRef(false);
  const dataTimeoutRef = useRef<any>(null);

  const readLoop = async (currentPort: SerialPort) => {
    let reader;
    let streamPromise;
    let textDecoder;
    
    try {
        if (!currentPort.readable) {
             throw new Error("Port not readable");
        }
        textDecoder = new TextDecoderStream();
        streamPromise = currentPort.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();
        readerRef.current = reader;
    } catch (e) {
        console.error("Failed to get reader:", e);
        disconnectSerial();
        return;
    }

    let buffer = "";
    
    try {
      while (keepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            if (trimmedLine.includes("next")) {
                commitFrame();
                continue;
            }

            const parts = trimmedLine.split(/\s+/);
            if (parts.length === 4) {
                const p1 = parseInt(parts[0], 10);
                const p2 = parseInt(parts[1], 10);
                const p3 = parseInt(parts[2], 10);
                const p4 = parseInt(parts[3], 10);
                
                if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3) && !isNaN(p4)) {
                    if (!hasValidDataRef.current) {
                        hasValidDataRef.current = true;
                        setIsConnecting(false);
                    }
                    tempDebugBuffer.current.push({ index: p1, value: p2, flag1: p3, flag2: p4 });
                    if (tempDebugBuffer.current.length >= POINTS_PER_FRAME) commitFrame();
                }
            }
          }
        }
      }
    } catch (e) {
      console.error("Read Loop Error:", e);
    } finally {
      console.log("Releasing reader lock");
      try {
        await reader.cancel();
      } catch (e) { }
      
      try {
          await streamPromise.catch(() => {});
      } catch (e) { }
      
      // If we exit loop unexpectedly (error), ensure cleanup
      if (keepReadingRef.current) {
         disconnectSerial();
      }
    }
  };

  const connectToPort = async () => {
    if (connected) return;
    try {
      // Clean up previous state first
      await disconnectSerial();
      
      // @ts-ignore
      const p = await navigator.serial.requestPort().catch((err: any) => {
        // Ignore AbortError (user cancelled) or NotFoundError
        console.log("Port selection skipped/cancelled:", err.message);
        if (!err.message?.includes('cancelled')) {
           alert("串口选择错误 / Selection error: " + err.message);
        }
        return null;
      });

      if (p) {
        await setupPort(p);
      }
    } catch (err) {
      console.error("Connection Error:", err);
      setConnected(false);
    }
  };

  const disconnectSerial = async () => {
    if (isDisconnectingRef.current) return;
    isDisconnectingRef.current = true;
    setIsConnecting(false);
    
    if (dataTimeoutRef.current) {
        clearTimeout(dataTimeoutRef.current);
        dataTimeoutRef.current = null;
    }

    try {
      keepReadingRef.current = false;
      if (readerRef.current) {
        try {
            await readerRef.current.cancel();
        } catch(e) { }
        readerRef.current = null;
      }
      
      if (readLoopPromiseRef.current) {
        await readLoopPromiseRef.current;
        readLoopPromiseRef.current = null;
      }

      if (portRef.current) {
        try {
            await portRef.current.close();
        } catch(e) { console.error("Close failed:", e); }
        portRef.current = null;
      }
    } catch (err) {
      console.error("Disconnect Error:", err);
    } finally {
      setPort(null); setConnected(false); isDisconnectingRef.current = false;
    }
  };

  // Helper: Open and configure a port
  const setupPort = async (p: SerialPort) => {
    setIsConnecting(true);
    try {
      await p.open({ baudRate: 115200 });
    } catch (err: any) {
      const msg = String(err.message || err);
      if (msg.includes("already open") || msg.includes("The port is already open")) {
        console.log("Port was already open, attempting to reuse...");
      } else {
        console.error("Failed to open port:", err);
        alert("串口打开失败 / Failed to open port:\n" + msg + "\n请检查该端口是否被其他程序（如串口助手）占用。");
        setConnected(false);
        setPort(null);
        setIsConnecting(false);
        return;
      }
    }
    
    setPort(p); 
    portRef.current = p;
    setConnected(true); 
    keepReadingRef.current = true;
    hasValidDataRef.current = false;
    
    readLoopPromiseRef.current = readLoop(p);
    console.log("Port connected successfully");

    // Timeout Check for Valid Data Formatting
    if (dataTimeoutRef.current) clearTimeout(dataTimeoutRef.current);
    dataTimeoutRef.current = setTimeout(() => {
        if (portRef.current === p && !hasValidDataRef.current) {
             setIsConnecting(false);
             alert("可能未开机或没选对COM口");
             disconnectSerial();
        }
    }, 3000);
  };

  // Robust Auto-Connect and Event Listeners
  useEffect(() => {
    let mounted = true;

    const handleConnect = () => {
        if (!mounted) return;
        console.log("Device connected event detected");
        tryAutoConnect();
    };

    const handleDisconnect = (event: any) => {
        console.log("Device disconnected event detected");
        if (portRef.current === event.port) {
            disconnectSerial();
        }
    };

    const tryAutoConnect = async () => {
        if (portRef.current) return; // Already connected
        try {
            // @ts-ignore
            const ports = await navigator.serial.getPorts();
            if (ports.length > 0) {
                console.log("Auto-connecting to known port...");
                setupPort(ports[0]);
            }
        } catch (e) {
            console.log("Auto-connect failed:", e);
        }
    };

    // @ts-ignore
    navigator.serial.addEventListener('connect', handleConnect);
    // @ts-ignore
    navigator.serial.addEventListener('disconnect', handleDisconnect);

    // Initial check
    tryAutoConnect();

    return () => {
        mounted = false;
        // @ts-ignore
        navigator.serial.removeEventListener('connect', handleConnect);
        // @ts-ignore
        navigator.serial.removeEventListener('disconnect', handleDisconnect);
        
        // Unmount Cleanup: Close port to prevent "Already Open" on HMR/remount
        if (portRef.current) {
             console.log("Component unmounting, closing port...");
             disconnectSerial();
        }
    };
  }, []);

  // Adaptive scaling for the calibration preview
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

  const texts = {
    title: language === 'zh' ? "短路测试仪" : "Short Circuit Tester",
    remap: language === 'zh' ? "校准" : "CALIBRATE",
    disconnect: language === 'zh' ? "断开连接" : "DISCONNECT",
    connect: language === 'zh' ? "连接设备" : "CONNECT",
  };
  
  // Calibration Modal Texts
  const t_calib = {
    title: language === 'zh' ? "校准" : "CALIBRATION",
    subtitle: "", // Removed per request
    zeroTitle: language === 'zh' ? "零点校准" : "ZERO CALIBRATION",
    zeroInstruction: language === 'zh' ? "将两表笔短接后，点击下方按钮" : "Short the probes, then click the button below",
    dirTitle: language === 'zh' ? "方向校准" : "DIRECTION CALIBRATION",
    btn1: language === 'zh' ? "请将表笔点在右下角激励源" : "Probe on Bottom-Right Source",
    btn2: language === 'zh' ? "请将表笔点在右上角激励源" : "Probe on Top-Right Source",
    sampling: language === 'zh' ? "采样中..." : "Sampling...",
    captured: language === 'zh' ? "已捕获" : "Vector Captured",
    resolved: language === 'zh' ? "校准矩阵" : "Resolved Matrix",
    clear: language === 'zh' ? "清除校准" : "CLEAR",
    cancel: language === 'zh' ? "取消" : "CANCEL",
    confirm: language === 'zh' ? "确认并应用" : "CONFIRM & APPLY",
    waveTip: language === 'zh' ? "等待波形稳定后 点击左侧对应按键" : "Wait for stable waveform, then click button",
    calibSuccess: language === 'zh' ? "校准成功" : "CALIBRATION SUCCESSFUL",
    calibFailed: language === 'zh' ? "校准失败" : "CALIBRATION FAILED"
  };

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
        </div>
      )}

      {isCalibrating2P && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-100/90 dark:bg-slate-950/95 p-6 animate-in fade-in duration-500 transition-colors">
           <div className="w-full max-w-6xl h-full max-h-[720px] bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-white/10 rounded-[3rem] shadow-2xl flex flex-col lg:flex-row overflow-hidden transition-colors">
              <div className="flex-1 p-10 flex flex-col justify-between border-r border-slate-300 dark:border-white/5 relative z-10 transition-colors">
                  <div className="flex-1 flex flex-col gap-8 overflow-y-auto">
                      <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl bg-cyan-600/10 dark:bg-cyan-600/20 flex items-center justify-center border border-cyan-500/30"><Scale className="text-cyan-600 dark:text-cyan-400" size={28} /></div>
                          <div>
                              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight transition-colors">{t_calib.title}</h2>
                          </div>
                      </div>

                      {/* Top Section: Zero Calibration */}
                      <div className="bg-white/80 dark:bg-slate-950/40 rounded-[2rem] p-6 border border-slate-300 dark:border-white/5 flex flex-col gap-4 shadow-sm transition-colors">
                          <h3 className="text-sm font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 transition-colors">
                              <Target size={14} className="text-cyan-600 dark:text-cyan-500" /> {t_calib.zeroTitle}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tracking-wide transition-colors">{t_calib.zeroInstruction}</p>
                          <div className="flex items-center gap-4">
                                <button 
                                    onClick={handleZeroCalibrate} 
                                    disabled={isZeroSampling} 
                                    className={`flex-1 py-4 rounded-2xl border flex items-center justify-center gap-2 transition-all font-black text-[10px] tracking-widest uppercase ${isZeroSampling ? 'bg-cyan-100 dark:bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
                                >
                                    {isZeroSampling ? <Timer size={16} className="animate-spin" /> : <Target size={16} />}
                                    {isZeroSampling ? t_calib.sampling : t_calib.zeroTitle}
                                </button>
                                
                                <div className="flex flex-col items-center bg-slate-100 dark:bg-black/20 px-4 py-2 rounded-xl border border-slate-300 dark:border-white/5 min-w-[80px] transition-colors">
                                    <span className="text-[9px] text-slate-500 font-bold">BIAS</span>
                                    <span className="text-lg font-mono font-bold text-cyan-600 dark:text-cyan-400">{globalOffset}</span>
                                </div>
                          </div>
                          {zeroCalibStatus !== 'IDLE' && (
                                <div className={`w-full py-2 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest ${zeroCalibStatus === 'SUCCESS' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-500'}`}>
                                    {zeroCalibStatus === 'SUCCESS' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                    {zeroCalibStatus === 'SUCCESS' ? t_calib.calibSuccess : t_calib.calibFailed}
                                </div>
                          )}
                      </div>

                      {/* Bottom Section: Direction Calibration */}
                      <div className="bg-white/80 dark:bg-slate-950/40 rounded-[2rem] p-6 border border-slate-300 dark:border-white/5 flex flex-col gap-4 flex-1 shadow-sm transition-colors">
                          <h3 className="text-sm font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 transition-colors">
                              <Move size={14} className="text-amber-500" /> {t_calib.dirTitle}
                          </h3>
                          <div className="flex flex-col gap-4 flex-1">
                            {["NW", "SW"].map((step) => {
                                const label = step === "NW" ? t_calib.btn1 : t_calib.btn2;
                                const val = calibRefVectors[step];
                                const isSampling = samplingStep === step;
                                return (
                                    <button key={step} disabled={samplingStep !== null} onClick={() => startSampling(step)} className={`flex-1 relative overflow-hidden rounded-2xl border flex flex-col items-center justify-center p-4 transition-all ${isSampling ? 'bg-cyan-100 dark:bg-cyan-500/20 border-cyan-500 scale-[1.02] shadow-xl' : 'bg-slate-50 dark:bg-slate-950/50 border-slate-300 dark:border-white/5 hover:border-slate-400 dark:hover:border-white/20 hover:bg-slate-100 dark:hover:bg-slate-900'} ${val !== null ? 'border-emerald-500/60 bg-emerald-50 dark:bg-emerald-500/10' : ''}`}>
                                        {val !== null ? (
                                            <div className="flex flex-col items-center relative z-10">
                                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono transition-colors">Q0:{val.q0.toFixed(0)} Q1:{val.q1.toFixed(0)}</span>
                                                <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-600 uppercase mt-1 tracking-widest transition-colors">{t_calib.captured}</span>
                                            </div>
                                        ) : isSampling ? (
                                            <div className="flex flex-col items-center relative z-10">
                                                <Timer size={24} className="text-cyan-600 dark:text-cyan-400 animate-spin mb-1 transition-colors" />
                                                <span className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-widest transition-colors">{t_calib.sampling}</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center relative z-10">
                                                <span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-center leading-relaxed transition-colors">{label}</span>
                                            </div>
                                        )}
                                        {isSampling && <div className="absolute bottom-0 left-0 h-1 bg-cyan-500 transition-all duration-200" style={{ width: `${sampleProgress}%` }}></div>}
                                    </button>
                                );
                            })}
                          </div>
                      </div>
                  </div>
                  
                  <div className="flex gap-4 mt-8 pt-6 border-t border-slate-300 dark:border-white/5 transition-colors">
                       <button onClick={resetCalibration} className="flex-1 py-4 rounded-2xl bg-red-100 dark:bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 font-black hover:bg-red-200 dark:hover:bg-red-500/20 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">
                           <Trash2 size={14} /> {t_calib.clear}
                       </button>
                      <button onClick={() => setIsCalibrating2P(false)} className="flex-1 py-4 rounded-2xl bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-500 font-black hover:bg-slate-300 dark:hover:bg-white/10 text-[10px] uppercase tracking-widest transition-colors">{t_calib.cancel}</button>
                      <button onClick={handleConfirmAndExit} disabled={!allCalibrated && !isCleared} className={`flex-[2] py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest ${allCalibrated || isCleared ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-xl' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600'}`}>{t_calib.confirm}</button>
                  </div>
              </div>
              <div className="hidden lg:flex flex-1 bg-slate-200/50 dark:bg-black/40 p-10 flex-col overflow-hidden transition-colors">
                  <div className="flex-grow rounded-[3rem] border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-950 overflow-hidden relative shadow-inner flex flex-col transition-colors">
                      {debugData.length === 0 ? (
                          <div className="flex-grow h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-800 font-mono gap-5 transition-colors"><Signal className="animate-pulse" size={80} /></div>
                      ) : (
                          <div className="flex-grow h-full relative p-12 flex flex-col">
                              <div className="text-center mb-4">
                                  <h3 className="text-2xl font-black text-cyan-600 dark:text-cyan-400 animate-pulse tracking-wide uppercase drop-shadow-[0_0_10px_rgba(34,211,238,0.3)] dark:drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-colors">
                                      {t_calib.waveTip}
                                  </h3>
                              </div>
                              <svg className="w-full h-full overflow-visible" viewBox="0 0 103 100" preserveAspectRatio="none">
                                  <line x1="0" y1="50" x2="103" y2="50" stroke="currentColor" className="text-slate-300 dark:text-white/10 transition-colors" strokeWidth="0.5" />
                                  <polyline fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={debugData.map((p, i) => `${i},${100 - ((p.value + globalOffset - previewBounds.min) / previewBounds.range) * 100}`).join(' ')} className="drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                              </svg>
                          </div>
                      )}
                  </div>
              </div>
           </div>
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
              <button onClick={() => { setCalibRefVectors({ "NW": null, "SW": null }); setIsCalibrating2P(true); }} disabled={!connected} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-600/10 text-cyan-500 dark:text-cyan-400 text-[10px] font-black tracking-widest hover:bg-cyan-600/20 transition-all"><Scale size={14} /> {texts.remap}</button>
              <nav className="bg-slate-200/50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-300/50 dark:border-white/5 flex items-center transition-colors duration-300">
                  <button onClick={() => setViewMode('COMPASS')} className={`px-5 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${viewMode === 'COMPASS' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}>COMPASS</button>
                  <button onClick={() => setViewMode('DEBUG')} className={`px-5 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${viewMode === 'DEBUG' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}>DEBUG</button>
                  <button onClick={() => setViewMode('SETTINGS')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${viewMode === 'SETTINGS' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}>
                      <Settings2 size={16} />
                  </button>
              </nav>
              {connected ? (
                  <button onClick={disconnectSerial} className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-black tracking-widest rounded-xl border border-red-500/20">{texts.disconnect}</button>
              ) : (
                  <button onClick={connectToPort} className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-black tracking-widest rounded-xl shadow-xl flex items-center gap-2"><PlugZap size={15} /> {texts.connect}</button>
              )}
          </div>
      </header>

      <main className="flex-grow flex flex-col min-h-0 h-full p-6 relative overflow-hidden">
        {viewMode === 'COMPASS' && (
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
                />
            </div>
        )}
      </main>
    </div>
  );
}
export default App;
