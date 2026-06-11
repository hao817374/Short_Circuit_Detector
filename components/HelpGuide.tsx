import React, { useState } from 'react';
import { Language } from '../types';
import { HelpCircle, BookOpen, Wrench, Info, X, ArrowRight, AlertTriangle, AlertCircle, CheckCircle2, Zap, Usb } from 'lucide-react';

interface HelpGuideProps {
  language: Language;
  onClose: () => void;
}

/**
 * 软件帮助引导页面组件
 * 以全屏模态弹窗形式展示操作指导、软件说明及故障排查等帮助内容，
 * 左侧纵向 Tab 切换栏 + 右侧内容区，支持中/英双语。
 */
export const HelpGuide: React.FC<HelpGuideProps> = ({ language, onClose }) => {
  type TabKey = 'quickstart' | 'guide' | 'troubleshoot' | 'about';
  const [activeTab, setActiveTab] = useState<TabKey>('quickstart');

  const tabs: { key: TabKey; zh: string; en: string; Icon: React.ElementType }[] = [
    { key: 'quickstart', zh: '快速入门', en: 'Quick Start', Icon: ArrowRight },
    { key: 'guide', zh: '操作指南', en: 'User Guide', Icon: BookOpen },
    { key: 'troubleshoot', zh: '故障排查', en: 'Troubleshoot', Icon: Wrench },
    { key: 'about', zh: '关于', en: 'About', Icon: Info },
  ];

  const t = {
    title: language === 'zh' ? '帮助与说明' : 'Help & Guide',

    // 快速入门
    qsTitle: language === 'zh' ? '快速入门' : 'Quick Start',
    qsStep1Title: language === 'zh' ? '1. 夹好测试夹' : '1. Attach Test Clips',
    qsStep1Desc: language === 'zh' ? '将四个测试夹分别夹在待测 PCB 板的四个角，确保金属接触良好。' : 'Clip the four test leads to the four corners of the target PCB. Ensure good metal contact.',
    qsStep2Title: language === 'zh' ? '2. 连接 USB 线' : '2. Connect USB Cable',
    qsStep2Desc: language === 'zh' ? '将仪器 USB 接口连接到电脑。首次使用需在浏览器弹窗中授权串口访问。系统会自动识别并记住设备 VID/PID，后续连接无需重复选择。' : 'Connect the device USB to your computer. Authorize serial port access on first use. The system remembers your device VID/PID for future auto-connection.',
    qsStep3Title: language === 'zh' ? '3. 打开仪器电源' : '3. Power On Device',
    qsStep3Desc: language === 'zh' ? '确认设备电源指示灯亮起，点击软件主界面的"连接设备"按钮。连接成功后罗盘会自动开始指示方向。' : 'Ensure the device power LED is on, then click "CONNECT DEVICE" on the main screen. The compass will start indicating direction automatically after connection.',

    // 操作指南
    gdTitle: language === 'zh' ? '操作指南' : 'User Guide',
    gdCompass: language === 'zh' ? '罗盘导航' : 'Compass Navigation',
    gdCompassDesc: language === 'zh' ? '罗盘指针指向短路点的方位。箭头指向正上方（北）= 向正上方移动，箭头指向右方（东）= 向右移动。矢量模长（距离）数值越小，表示离短路点越近。' : 'The compass needle points toward the short circuit. North = move up, East = move right. Smaller distance values mean you are closer to the short circuit.',
    gdThreshold: language === 'zh' ? '阈值调节' : 'Threshold Adjustment',
    gdThresholdDesc: language === 'zh' ? '拖动右侧 THOLD 滑块可调节"短路附近"检测灵敏度。当矢量模长低于阈值时，罗盘进入绿色"短路点在此附近"模式。数值越大，触发越灵敏。' : 'Drag the THOLD slider on the right to adjust detection sensitivity. When the vector magnitude drops below the threshold, the compass enters green "SHORT CIRCUIT NEARBY" mode.',
    gdCalibration: language === 'zh' ? '空间校准' : 'Spatial Calibration',
    gdCalibrationDesc: language === 'zh' ? '首次使用或更换测试环境时，建议进行空间校准。进入"空间校准"页面，依次完成零点校准和方向校准，系统会自动求解 2×2 仿射变换矩阵，补偿通道差异和串扰。' : 'Perform spatial calibration on first use or when changing test environments. Complete zero calibration and direction calibration in the CALIBRATION tab. The system solves a 2×2 affine matrix to compensate for channel differences.',
    gdModes: language === 'zh' ? '四种罗盘模式' : 'Four Compass Modes',
    gdModesDesc: language === 'zh' ? '离线：设备未连接。表笔未连接：表笔悬空或接触不良（红色）。短路附近：已接近短路点（绿色）。导航中：正常指向（青色）。' : 'Offline: Device not connected. Probe Disconnected: Probes floating or poor contact (red). Nearby: Close to short circuit (green). Navigating: Normal navigation (cyan).',

    // 故障排查
    tsTitle: language === 'zh' ? '故障排查' : 'Troubleshooting',
    tsNoData: language === 'zh' ? '未检测到有效数据流' : 'No Valid Data Detected',
    tsNoDataDesc: language === 'zh' ? '请确认：① 仪器电源已打开 ② 选择了正确的 COM 端口 ③ USB 线缆无损坏 ④ 设备固件已正确烧录。尝试重新插拔 USB 线并点击连接。' : 'Check: ① Device power is on ② Correct COM port selected ③ USB cable is intact ④ Firmware is properly flashed. Try reconnecting the USB cable.',
    tsHandshake: language === 'zh' ? '握手失败' : 'Handshake Failed',
    tsHandshakeDesc: language === 'zh' ? '握手失败通常表示上位机与 MCU 通信协议不匹配。请确认设备已烧录最新固件，且固件支持二进制加密帧协议（0xAA 帧头 + ChaCha20 加密 + Session ID 握手）。' : 'Handshake failure usually indicates a protocol mismatch. Ensure the device runs the latest firmware supporting binary encrypted frame protocol (0xAA frame header + ChaCha20 + Session ID handshake).',
    tsProbe: language === 'zh' ? '表笔未连接 / 接触不良' : 'Probe Disconnected / Poor Contact',
    tsProbeDesc: language === 'zh' ? '红色"表笔未连接"提示通常表示测试夹未正确接触 PCB。如果同时还显示"请检查表笔测试夹是否接触良好"，说明全帧信号极差异常，可能原因：① 测试夹松动 ② PCB 表面氧化层过厚 ③ 夹子金属触点脏污。请清洁触点后重新夹紧。' : 'Red "PROBE DISCONNECTED" usually means test clips are not properly contacting the PCB. If accompanied by "Check probe clip contact", the full-frame range is abnormal. Possible causes: ① Loose clips ② Thick PCB oxidation layer ③ Dirty metal contacts. Clean contacts and re-clip firmly.',
    tsCalib: language === 'zh' ? '校准失败' : 'Calibration Failed',
    tsCalibDesc: language === 'zh' ? '校准失败常见原因：① 表笔在采样过程中晃动 ② 环境电磁干扰过大 ③ 设备预热不足。请确保表笔稳定接触，远离大功率电器，等待设备预热 30 秒后重试。零校准采样 1 秒，方向校准采样 1 秒，期间请勿移动表笔。' : 'Common causes: ① Probe movement during sampling ② Excessive EMI ③ Insufficient warm-up. Keep probes steady, avoid high-power appliances nearby, wait 30s for warm-up, then retry. Do not move probes during the 1-second sampling period.',

    // 关于
    abTitle: language === 'zh' ? '关于本软件' : 'About',
    abVersion: 'v1.1.7',
    abRuntime: 'Windows 10+ / Linux (AppImage, deb)',
    abCopyright: language === 'zh' ? '© 2026 CodePhoenix. 保留所有权利。' : '© 2026 CodePhoenix. All rights reserved.',
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'quickstart':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-black text-slate-800 dark:text-white">{t.qsTitle}</h3>
            {[
              { icon: Zap, title: t.qsStep1Title, desc: t.qsStep1Desc },
              { icon: Usb, title: t.qsStep2Title, desc: t.qsStep2Desc },
              { icon: ArrowRight, title: t.qsStep3Title, desc: t.qsStep3Desc },
            ].map((step, i) => (
              <div key={i} className="flex gap-4 p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-white/5">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/10 dark:bg-cyan-600/20 flex items-center justify-center flex-shrink-0 border border-cyan-500/30">
                  <step.icon className="text-cyan-600 dark:text-cyan-400" size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-1">{step.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        );
      case 'guide':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-black text-slate-800 dark:text-white">{t.gdTitle}</h3>
            {[
              { title: t.gdCompass, desc: t.gdCompassDesc },
              { title: t.gdThreshold, desc: t.gdThresholdDesc },
              { title: t.gdCalibration, desc: t.gdCalibrationDesc },
              { title: t.gdModes, desc: t.gdModesDesc },
            ].map((item, i) => (
              <div key={i} className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-white/5">
                <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-2">{item.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        );
      case 'troubleshoot':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-black text-slate-800 dark:text-white">{t.tsTitle}</h3>
            {[
              { icon: AlertCircle, title: t.tsNoData, desc: t.tsNoDataDesc },
              { icon: AlertTriangle, title: t.tsHandshake, desc: t.tsHandshakeDesc },
              { icon: Zap, title: t.tsProbe, desc: t.tsProbeDesc },
              { icon: CheckCircle2, title: t.tsCalib, desc: t.tsCalibDesc },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-white/5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 border border-amber-500/20">
                  <item.icon className="text-amber-500" size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-1">{item.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        );
      case 'about':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-black text-slate-800 dark:text-white">{t.abTitle}</h3>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-slate-400">{language === 'zh' ? '版本号' : 'Version'}</span>
                <span className="text-sm font-mono font-bold text-cyan-600 dark:text-cyan-400">{t.abVersion}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-white/5" />
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">{language === 'zh' ? '运行环境' : 'Runtime'}</span>
                <p className="text-xs font-mono text-slate-600 dark:text-slate-300 mt-1">{t.abRuntime}</p>
              </div>
              <div className="border-t border-slate-200 dark:border-white/5" />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">{t.abCopyright}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-3xl h-[80vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-300 relative">
        {/* 右上角关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-10 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          <X size={20} />
        </button>
        {/* 左侧 Tab 栏 */}
        <div className="w-48 flex-shrink-0 bg-slate-50 dark:bg-slate-950/50 border-r border-slate-200 dark:border-white/5 flex flex-col p-4 gap-2">
          <div className="flex items-center gap-2 px-3 py-2 mb-4">
            <HelpCircle className="text-cyan-500" size={20} />
            <span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{t.title}</span>
          </div>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black tracking-widest transition-all text-left
                ${activeTab === tab.key
                  ? 'bg-cyan-600 text-white shadow-lg'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'
                }`}
            >
              <tab.Icon size={16} />
              <span>{language === 'zh' ? tab.zh : tab.en}</span>
            </button>
          ))}
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 overflow-y-auto p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
