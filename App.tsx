import React, { useState, useEffect, useRef, useCallback } from 'react';
import RotatingEarth from './components/RotatingEarth';
import HolographicInterface from './components/ChatPanel';
import BootSequence from './components/BootSequence';
import { Coordinates } from './types';
import { Map, Sun, Moon } from 'lucide-react';

const App: React.FC = () => {
  const [currentCoords, setCurrentCoords] = useState<Coordinates>({ lat: 0, lon: 0 });
  const [selectedCoords, setSelectedCoords] = useState<Coordinates | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 800 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNightMode, setIsNightMode] = useState(false);
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleViewChange = useCallback((lat: number, lon: number) => {
    setCurrentCoords({ lat, lon });
  }, []);
  
  const handleLocationSelect = useCallback((lat: number, lon: number) => {
    const coords = { lat, lon };
    setSelectedCoords(coords);
    setCurrentCoords(coords);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#020202] text-white selection:bg-blue-500/30">
      
      {/* 0. BOOT SEQUENCE */}
      {isBooting && (
        <div className="absolute inset-0 z-[100] transition-opacity duration-1000 ease-in-out">
            <BootSequence onComplete={() => setIsBooting(false)} />
        </div>
      )}

      {/* BACKGROUND: The Globe */}
      <div ref={containerRef} className={`absolute inset-0 z-0 transition-all duration-1000 ${isBooting ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'}`}>
        <RotatingEarth 
            width={dimensions.width} 
            height={dimensions.height} 
            className="w-full h-full"
            onViewChange={handleViewChange}
            onLocationSelect={handleLocationSelect}
            isNightMode={isNightMode}
            selectedLocation={selectedCoords}
        />
      </div>

      {/* FOREGROUND: Holographic UI Layer */}
      <div className={`absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6 transition-all duration-1000 delay-500 ${isBooting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
        
        {/* TOP BAR: Header & Controls */}
        <div className="flex items-start justify-between pointer-events-auto">
            <div className="flex flex-col">
                <div className={`flex items-center gap-3 px-4 py-2 rounded-full border backdrop-blur-md transition-colors duration-500 ${
                    isNightMode 
                    ? 'bg-amber-950/20 border-amber-500/20 text-amber-100' 
                    : 'bg-black/20 border-white/10 text-white'
                }`}>
                    <Map className={`w-5 h-5 ${isNightMode ? 'text-amber-500' : 'text-blue-400'}`} />
                    <span className="font-bold tracking-wider text-sm">TERRAGEMINI</span>
                    <span className="text-[10px] opacity-50 border-l border-white/20 pl-3 font-mono">SYS.ONLINE</span>
                </div>
            </div>

            <button
                onClick={() => setIsNightMode(!isNightMode)}
                className={`p-3 rounded-full border backdrop-blur-md transition-all duration-300 group ${
                    isNightMode 
                    ? 'bg-amber-900/10 border-amber-500/20 text-amber-300 hover:bg-amber-900/30' 
                    : 'bg-white/5 border-white/10 text-blue-200 hover:bg-white/10'
                }`}
            >
                {isNightMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
        </div>

        {/* CENTER/BOTTOM: The Main Interface */}
        {/* We pass pointer-events-auto inside the component for interactive elements */}
        <HolographicInterface 
            currentCoords={currentCoords} 
            selectedCoords={selectedCoords}
            isNightMode={isNightMode}
            onLocationSearch={handleLocationSelect}
        />
      </div>
    </div>
  );
};

export default App;