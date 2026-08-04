import React from 'react';
import { Coordinates } from '../types';
import { Maximize2, RefreshCw, AlertCircle, Scan, Radar, WifiOff } from 'lucide-react';

interface TargetVisualizerProps {
    isLoading: boolean;
    imageUrl: string | null;
    coords?: Coordinates | null;
    isNightMode: boolean;
}

const TargetVisualizer: React.FC<TargetVisualizerProps> = ({ isLoading, imageUrl, coords, isNightMode }) => {
    const borderColor = isNightMode ? 'border-amber-500/40' : 'border-blue-500/40';
    const accentColor = isNightMode ? 'text-amber-400' : 'text-blue-400';
    const bgColor = isNightMode ? 'bg-amber-500/10' : 'bg-blue-500/10';
    const glowColor = isNightMode ? 'shadow-amber-500/20' : 'shadow-blue-500/20';

    // Standby Mode (No coords selected)
    if (!coords) {
        return (
            <div className={`
                w-72 md:w-80 backdrop-blur-md bg-black/60 
                border-l-2 ${borderColor} border-t border-b border-r border-white/5
                rounded-r-lg shadow-lg overflow-hidden opacity-80
                transition-all duration-500
            `}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-2">
                        <Radar className={`w-4 h-4 ${accentColor} animate-spin-slow`} />
                        <span className="font-mono text-[10px] tracking-widest text-white/50">
                            SECTOR_SCAN
                        </span>
                    </div>
                    <span className="text-[9px] font-mono text-white/30">IDLE</span>
                </div>
                <div className="h-32 relative bg-black/40 flex items-center justify-center overflow-hidden">
                    {/* Scanning Grid Animation */}
                    <div className={`absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] animate-pan-grid`} />
                    <div className={`absolute top-0 w-full h-1 bg-${isNightMode ? 'amber' : 'blue'}-500/50 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-scan-vertical`} />
                    
                    <div className="font-mono text-[9px] text-white/20 text-center">
                        <div>AWAITING TARGET</div>
                        <div>COORDINATES</div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div key={`${coords.lat}-${coords.lon}`} className={`
            w-72 md:w-80 backdrop-blur-xl bg-black/80 
            border-l-2 ${borderColor} 
            rounded-r-lg shadow-2xl overflow-hidden
            animate-in zoom-in-50 duration-500 slide-in-from-left-10
        `}>
            {/* Header / Top Bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-2">
                    <Scan className={`w-4 h-4 ${accentColor} animate-pulse`} />
                    <span className="font-mono text-[10px] tracking-widest text-white/70">
                        SAT.FEED_V.04
                    </span>
                </div>
                <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-red-500 animate-ping" />
                    <span className="text-[9px] font-mono text-red-400">LIVE</span>
                </div>
            </div>

            {/* Main Visual Area */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group">
                
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]" />
                
                {/* Content */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center gap-3">
                        <RefreshCw className={`w-8 h-8 ${accentColor} animate-spin`} />
                        <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest">
                            Acquiring Visual...
                        </div>
                    </div>
                ) : imageUrl ? (
                    <>
                        <img 
                            src={imageUrl} 
                            alt="Target Visual" 
                            className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-110" 
                        />
                        {/* Scanline Effect */}
                        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[size:100%_4px] opacity-20" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-white/30 p-4 text-center">
                        <WifiOff className="w-6 h-6 mb-1 opacity-50" />
                        <span className="text-[10px] font-mono text-red-400/80">VISUAL FEED OFFLINE</span>
                        <span className="text-[9px] text-white/20">UNABLE TO ESTABLISH UPLINK</span>
                    </div>
                )}

                {/* Corner Brackets */}
                <div className={`absolute top-2 left-2 w-4 h-4 border-t border-l ${borderColor}`} />
                <div className={`absolute top-2 right-2 w-4 h-4 border-t border-r ${borderColor}`} />
                <div className={`absolute bottom-2 left-2 w-4 h-4 border-b border-l ${borderColor}`} />
                <div className={`absolute bottom-2 right-2 w-4 h-4 border-b border-r ${borderColor}`} />
            </div>

            {/* Footer Metadata */}
            <div className="p-3 grid grid-cols-2 gap-2 text-[9px] font-mono text-white/40 border-t border-white/10">
                <div className="flex flex-col">
                    <span className="text-white/20">TARGET_LOC</span>
                    <span className="text-white/80">
                        {coords ? `${coords.lat.toFixed(2)}, ${coords.lon.toFixed(2)}` : '--,--'}
                    </span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-white/20">ENCRYPTION</span>
                    <span className="text-white/80">AES-256-GCM</span>
                </div>
                <div className="col-span-2 mt-1">
                    <div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full w-2/3 ${bgColor}`} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TargetVisualizer;