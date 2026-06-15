import React, { useState } from 'react';
import { Language } from '../types';
import { Lock, PlugZap, Send, CheckCircle2, ShieldAlert } from 'lucide-react';

interface LockScreenProps {
  language: Language;
  lockReason: number | null;
  connected: boolean;
  activationSent: boolean;
  onConnect: () => void;
  onSubmitActivation: (hexCode: string) => void;
}

// 原因码 → 错误码与提示文字映射
const getErrorInfo = (reason: number | null, language: Language) => {
  if (reason === null) return { code: '--', text: '' };
  const hex = reason.toString(16).toUpperCase().padStart(2, '0');
  const isTrialExpired = reason === 0x01 || reason === 0x02;
  return {
    code: hex,
    text: isTrialExpired
      ? (language === 'zh' ? '试用期到期，请使用注册码激活' : 'Trial expired. Please enter activation code.')
      : (language === 'zh' ? '已锁定，请使用注册码激活' : 'Locked. Please enter activation code.'),
  };
};

/**
 * 软件死锁锁定界面组件
 * 当 MCU 发送死锁通知帧后，以全屏不可关闭弹窗锁定软件，
 * 内置串口连接按钮与激活码输入框，支持离线激活场景。
 */
export const LockScreen: React.FC<LockScreenProps> = ({
  language, lockReason, connected, activationSent, onConnect, onSubmitActivation,
}) => {
  const [activationInput, setActivationInput] = useState(''); // 128 位十六进制字符串
  const errorInfo = getErrorInfo(lockReason, language);
  const isInputValid = activationInput.replace(/\s/g, '').length === 128;

  const handleSubmit = () => {
    const hex = activationInput.replace(/\s/g, '');
    if (hex.length !== 128) return;
    onSubmitActivation(hex);
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-500">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-500 flex flex-col items-center gap-6">

        {/* 第一层：状态信息 */}
        {activationSent ? (
          <>
            <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="text-emerald-500" size={40} />
            </div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white text-center">
              {language === 'zh' ? '激活码已发送' : 'Activation Code Sent'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center font-medium">
              {language === 'zh' ? '请重启软件以使激活生效' : 'Please restart the software for activation to take effect.'}
            </p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center border border-red-500/20">
              <ShieldAlert className="text-red-500" size={40} />
            </div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white text-center">
              {language === 'zh' ? '软件已锁定' : 'Software Locked'}
            </h2>
            <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
              <span className="text-sm font-mono font-bold text-red-500">
                {language === 'zh' ? '错误码' : 'ERROR'} {errorInfo.code}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center font-medium">
              {errorInfo.text}
            </p>

            {/* 第二层：激活码输入 */}
            <div className="w-full">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 text-center font-medium">
                {language === 'zh' ? '请输入激活码（128位十六进制）' : 'Enter activation code (128 hex characters)'}
              </p>
              <input
                type="text"
                value={activationInput}
                onChange={(e) => setActivationInput(e.target.value.toUpperCase())}
                placeholder={language === 'zh' ? '请输入激活码' : 'Enter activation code'}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 font-mono text-xs text-slate-700 dark:text-slate-200 text-center focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
              />
            </div>

            {/* 第三层：双按钮 */}
            <div className="flex gap-4 w-full">
              <button
                onClick={onConnect}
                disabled={connected}
                className={`flex-1 py-4 rounded-2xl font-black tracking-widest uppercase text-xs transition-all flex items-center justify-center gap-2
                  ${connected
                    ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-500 cursor-default'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-xl active:scale-95'
                  }`}
              >
                {connected ? <CheckCircle2 size={16} /> : <PlugZap size={16} />}
                {connected
                  ? (language === 'zh' ? '已连接' : 'CONNECTED')
                  : (language === 'zh' ? '连接设备' : 'CONNECT')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!connected || !isInputValid}
                className={`flex-1 py-4 rounded-2xl font-black tracking-widest uppercase text-xs transition-all flex items-center justify-center gap-2
                  ${connected && isInputValid
                    ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-xl active:scale-95'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  }`}
              >
                <Send size={16} />
                {language === 'zh' ? '提交激活' : 'ACTIVATE'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
