import React, { useEffect, useState } from 'react';
import { Activity, Shield, Wifi, Database, Cpu } from 'lucide-react';

interface BootSequenceProps {
    onComplete: () => void;
}

const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
    const [lines, setLines] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);

    const bootLog = [
        "INIT_CORE_KERNEL... OK",
        "LOADING_GEOSPATIAL_ASSETS... OK",
        "CONNECTING_ORBITAL_UPLINK... ESTABLISHED",
        "DECRYPTING_SECURE_CHANNEL... DONE",
        "CALIBRATING_SENSORS... OK",
        "SYSTEM_READY."
    ];

    useEffect(() => {
        let delay = 0;
        
        // Log Lines
        bootLog.forEach((line, index) => {
            delay += Math.random() * 300 + 100;
            setTimeout(() => {
                setLines(prev => [...prev, line]);
            }, delay);
        });

        // Progress Bar
        const progressInterval = setInterval(() => {
            setProgress(p => {
                if (p >= 100) {
                    clearInterval(progressInterval);
                    return 100;
                }
                return p + Math.random() * 10;
            });
        }, 150);

        // Completion
        setTimeout(() => {
            onComplete();
        }, delay + 800);

        return () => clearInterval(progressInterval);
    }, []);

    return (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center font-mono text-xs md:text-sm cursor-wait select-none">
            <div className="w-80 md:w-96 space-y-6">
                
                {/* Header Logo Glitch */}
                <div className="flex items-center gap-3 text-blue-500 mb-8 animate-pulse">
                    <Activity className="w-6 h-6" />
                    <span className="text-lg tracking-[0.2em] font-bold">TERRAGEMINI BIOS v2.0</span>
                </div>

                {/* System Icons */}
                <div className="flex justify-between px-4 text-blue-500/50">
                    <Shield className={`w-4 h-4 ${progress > 20 ? 'text-blue-400' : ''}`} />
                    <Cpu className={`w-4 h-4 ${progress > 40 ? 'text-blue-400' : ''}`} />
                    <Database className={`w-4 h-4 ${progress > 60 ? 'text-blue-400' : ''}`} />
                    <Wifi className={`w-4 h-4 ${progress > 80 ? 'text-blue-400' : ''}`} />
                </div>

                {/* Progress Bar */}
                <div className="relative h-1 bg-blue-900/30 w-full rounded-full overflow-hidden">
                    <div 
                        className="absolute top-0 left-0 h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] transition-all duration-100 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] text-blue-500/60 uppercase">
                    <span>Memory Check</span>
                    <span>{Math.min(100, Math.floor(progress))}%</span>
                </div>

                {/* Console Output */}
                <div className="h-32 flex flex-col justify-end overflow-hidden border-l-2 border-blue-500/20 pl-4 py-2 bg-blue-500/5 rounded-r">
                    {lines.map((line, i) => (
                        <div key={i} className="text-blue-400/80 leading-relaxed truncate animate-in fade-in slide-in-from-left-2 duration-300">
                            <span className="opacity-30 mr-2">[{new Date().toISOString().split('T')[1].slice(0,8)}]</span>
                            {line}
                        </div>
                    ))}
                    <div className="w-2 h-4 bg-blue-500/50 animate-pulse mt-1" />
                </div>
            </div>
        </div>
    );
};

export default BootSequence;