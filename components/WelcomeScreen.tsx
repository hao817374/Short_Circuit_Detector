
import React, { useState } from 'react';
import { Language } from '../types';
import { Crosshair, Usb, Zap, PlugZap, AlertCircle } from 'lucide-react';

interface WelcomeScreenProps {
    language: Language;
    onConnect: () => void;
    onSkipChange: (skip: boolean) => void;
    connectionError: string | null;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
    language, onConnect, onSkipChange, connectionError
}) => {
    const [dontShow, setDontShow] = useState(false);

    const handleDontShowChange = (checked: boolean) => {
        setDontShow(checked);
        onSkipChange(checked);
    };

    const steps = language === 'zh' ? [
        { icon: Crosshair, title: '夹好测试夹', desc: '将四个测试夹分别夹在待测板的四个角' },
        { icon: Usb, title: '连接USB线', desc: '将仪器的USB接口连接到电脑' },
        { icon: Zap, title: '打开仪器电源', desc: '确认设备电源指示灯亮起' },
    ] : [
        { icon: Crosshair, title: 'ATTACH CLIPS', desc: 'Clip 4 test leads to the board corners' },
        { icon: Usb, title: 'CONNECT USB', desc: 'Plug the USB cable into your computer' },
        { icon: Zap, title: 'POWER ON', desc: 'Ensure the device power LED is on' },
    ];

    return (
        <div className="flex-grow flex flex-col items-center justify-center gap-8 px-8">
            {/* Title */}
            <div className="text-center">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight transition-colors">
                    {language === 'zh' ? '短路测试仪' : 'Short Circuit Tester'}
                </h2>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-500 font-mono tracking-widest uppercase">
                    Serial Precision Instrument for PCB Analysis
                </p>
            </div>

            {/* Steps */}
            <div className="flex gap-6 max-w-2xl w-full">
                {steps.map((step, i) => (
                    <div key={i} className="flex-1 bg-white/80 dark:bg-slate-900/40 border border-slate-300 dark:border-white/5 rounded-2xl p-6 flex flex-col items-center gap-3 transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-cyan-600/10 dark:bg-cyan-600/20 flex items-center justify-center border border-cyan-500/30">
                            <step.icon className="text-cyan-600 dark:text-cyan-400" size={24} />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-cyan-600 dark:text-cyan-400 bg-cyan-600/10 dark:bg-cyan-500/10 w-5 h-5 rounded-full flex items-center justify-center">{i + 1}</span>
                            <span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">{step.title}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">{step.desc}</p>
                    </div>
                ))}
            </div>

            {/* Error Banner */}
            {connectionError && (
                <div className="flex items-center gap-3 px-6 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl max-w-md w-full">
                    <AlertCircle className="text-red-500 flex-shrink-0" size={18} />
                    <span className="text-sm text-red-600 dark:text-red-400">{connectionError}</span>
                </div>
            )}

            {/* Connect Button */}
            <button
                onClick={onConnect}
                className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-black tracking-widest rounded-2xl shadow-xl flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
                <PlugZap size={20} />
                {language === 'zh' ? '连接设备' : 'CONNECT DEVICE'}
            </button>

            {/* Don't show again */}
            <label className="flex items-center gap-2 cursor-pointer group">
                <input
                    type="checkbox"
                    checked={dontShow}
                    onChange={(e) => handleDontShowChange(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-400 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500"
                />
                <span className="text-xs text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">
                    {language === 'zh' ? '下次启动时不再显示此引导' : "Don't show this guide on startup"}
                </span>
            </label>
        </div>
    );
};
