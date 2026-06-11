
import React, { useState } from 'react';
import { Language } from '../types';
import { Crosshair, Usb, Zap, PlugZap, AlertCircle } from 'lucide-react';

/**
 * 欢迎引导页组件的属性定义
 */
interface WelcomeScreenProps {
    language: Language;                       // 当前语言（'zh' | 'en'）
    onConnect: () => void;                    // 点击连接按钮的回调函数
    onSkipChange: (skip: boolean) => void;    // 勾选"下次不再显示"的回调函数，用于持久化用户偏好
    connectionError: string | null;           // 串口连接失败时的错误提示信息
}

/**
 * 欢迎引导页组件
 * 
 * 作用：在未连接设备时展示三步操作指引（夹好测试夹 -> 连接USB -> 打开电源），
 * 并提供连接串口的入口按钮和"下次不再显示"的复选框。
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
    language, onConnect, onSkipChange, connectionError
}) => {
    // 内部状态：记录用户是否勾选了跳过引导
    const [dontShow, setDontShow] = useState(false);

    // 处理跳过复选框的变化，同步更新组件内部状态并向上层抛出事件
    const handleDontShowChange = (checked: boolean) => {
        setDontShow(checked);
        onSkipChange(checked);
    };

    // 操作步骤数据源，根据当前语言动态切换内容
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
            {/* 标题区域：产品名称与副标题 */}
            <div className="text-center">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight transition-colors">
                    {language === 'zh' ? '短路测试仪' : 'Short Circuit Tester'}
                </h2>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-500 font-mono tracking-widest uppercase">
                    Precision Short Circuit Detector
                </p>
            </div>

            {/* 操作步骤卡片区域：横向排列展示三个步骤 */}
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

            {/* 连接错误横幅：当连接失败时显示红色的错误提示 */}
            {connectionError && (
                <div className="flex items-center gap-3 px-6 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl max-w-md w-full">
                    <AlertCircle className="text-red-500 flex-shrink-0" size={18} />
                    <span className="text-sm text-red-600 dark:text-red-400">{connectionError}</span>
                </div>
            )}

            {/* 连接设备按钮：触发串口连接逻辑 */}
            <button
                onClick={onConnect}
                className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-black tracking-widest rounded-2xl shadow-xl flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
                <PlugZap size={20} />
                {language === 'zh' ? '连接设备' : 'CONNECT DEVICE'}
            </button>

            {/* 不再显示复选框：用于记住用户的跳过偏好 */}
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
