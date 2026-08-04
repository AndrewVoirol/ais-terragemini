import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, X, Globe, Radio, ChevronRight, Loader2, ArrowRight, AlertCircle, AlertTriangle } from 'lucide-react';
import { Coordinates, ChatState } from '../types';
import { generateLocationInsight, generateLocationImage, resolveLocationFromText } from '../services/gemini';
import TargetVisualizer from './TargetVisualizer';

interface HolographicInterfaceProps {
    currentCoords: Coordinates;
    selectedCoords?: Coordinates | null;
    isNightMode: boolean;
    onLocationSearch: (lat: number, lon: number) => void;
}

// A single "Insight" unit, rather than a chat history
interface IntelligenceCard {
    title: string;
    content: string;
    type: 'analysis' | 'fact' | 'error';
    coords?: Coordinates;
}

const HolographicInterface: React.FC<HolographicInterfaceProps> = ({ currentCoords, selectedCoords, isNightMode, onLocationSearch }) => {
    const [input, setInput] = useState('');
    const [status, setStatus] = useState<ChatState>(ChatState.IDLE);
    
    // Instead of a list of messages, we show one active "Intelligence Card"
    const [activeCard, setActiveCard] = useState<IntelligenceCard | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [visualImage, setVisualImage] = useState<string | null>(null);
    const [visualLoading, setVisualLoading] = useState(false);

    // Theme helpers
    const accentColor = isNightMode ? 'text-amber-400' : 'text-blue-400';
    const borderColor = isNightMode ? 'border-amber-500/30' : 'border-blue-500/30';
    const glowColor = isNightMode ? 'shadow-amber-500/20' : 'shadow-blue-500/20';

    // Auto-analyze when a location is PINNED (selected)
    useEffect(() => {
        if (selectedCoords) {
            handleAutoAnalyze(selectedCoords);
        } else {
            // Close visualizer if selection cleared, but it will go to standby mode
            setVisualImage(null);
            setVisualLoading(false);
        }
    }, [selectedCoords]);

    const handleAutoAnalyze = async (coords: Coordinates) => {
        setStatus(ChatState.LOADING);
        setVisualLoading(true);
        setActiveCard(null); // Clear previous
        setIsExpanded(true); // Open the panel
        setVisualImage(null); // Clear previous image

        try {
            // Parallel fetching: Text Analysis + Visual Image
            const analysisPromise = generateLocationInsight(coords, "Analyze this specific coordinate location concisely.");
            const imgPromise = generateLocationImage(coords, `Landscape or Cityscape at ${coords.lat}, ${coords.lon}`);

            const [textResult, imgResult] = await Promise.allSettled([analysisPromise, imgPromise]);

            // Handle Text
            if (textResult.status === 'fulfilled') {
                setActiveCard({
                    title: "TARGET ANALYSIS",
                    content: textResult.value,
                    type: 'analysis',
                    coords: coords
                });
                setStatus(ChatState.IDLE);
            } else {
                // Handle Error (e.g., Quota Exceeded)
                setStatus(ChatState.ERROR);
                setActiveCard({
                    title: "UPLINK ERROR",
                    content: (textResult.reason as Error)?.message || "Signal Lost. Unable to retrieve planetary data.",
                    type: 'error',
                    coords: coords
                });
            }

            // Handle Image
            if (imgResult.status === 'fulfilled') {
                setVisualImage(imgResult.value);
            }
            setVisualLoading(false);

        } catch (e: any) {
            setStatus(ChatState.ERROR);
            setVisualLoading(false);
            setActiveCard({
                title: "SYSTEM FAILURE",
                content: e.message || "Critical error in communication subsystem.",
                type: 'error',
                coords: coords
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const query = input;
        setInput('');
        setStatus(ChatState.LOADING);
        setIsExpanded(true);

        try {
            // STEP 1: Attempt to resolve a location from the text
            const location = await resolveLocationFromText(query);
            
            if (location) {
                // FOUND LOCATION -> FLY TO IT
                // This triggers parent state update -> which triggers selectedCoords effect -> which calls handleAutoAnalyze
                onLocationSearch(location.lat, location.lon);
                // We don't need to generate insight here manually, the effect will do it.
            } else {
                // NO LOCATION -> Just a general query about the current view
                const target = selectedCoords || currentCoords;
                const result = await generateLocationInsight(target, query);
                
                setActiveCard({
                    title: `QUERY: ${query.toUpperCase()}`,
                    content: result,
                    type: 'fact',
                    coords: target
                });
                setStatus(ChatState.IDLE);
            }
        } catch (e: any) {
            setStatus(ChatState.ERROR);
            setActiveCard({
                title: "TRANSMISSION ERROR",
                content: e.message || "Failed to transmit query.",
                type: 'error',
                coords: selectedCoords || currentCoords
            });
        }
    };

    // Close the card
    const dismissCard = () => {
        setIsExpanded(false);
        setTimeout(() => setActiveCard(null), 300);
    };

    return (
        <div className="w-full h-full flex flex-col justify-between pointer-events-none relative">
            
            {/* 1. VISUAL TARGET DISPLAY (Pop-out Top Left) */}
            {/* Always rendered now, it handles 'Standby' mode internally if coords are null */}
            <div className="absolute top-16 left-0 md:left-4 z-40 pointer-events-auto transition-opacity duration-500">
                <TargetVisualizer 
                    isLoading={visualLoading} 
                    imageUrl={visualImage} 
                    coords={selectedCoords} 
                    isNightMode={isNightMode}
                />
            </div>

            {/* Spacer */}
            <div className="flex-grow" />

            {/* 2. INTELLIGENCE CARD (Bottom Center) */}
            <div className="w-full flex flex-col items-center">
                <div className={`
                    pointer-events-auto
                    transition-all duration-500 ease-out
                    ${isExpanded ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95 pointer-events-none'}
                    max-w-2xl w-full mb-6
                `}>
                    {status === ChatState.LOADING ? (
                        <div className="flex items-center justify-center gap-3 p-6 backdrop-blur-xl bg-black/40 border border-white/10 rounded-2xl">
                            <Loader2 className={`w-5 h-5 animate-spin ${accentColor}`} />
                            <span className="font-mono text-xs tracking-widest text-white/70">ESTABLISHING UPLINK...</span>
                        </div>
                    ) : activeCard ? (
                        <div className={`
                            relative overflow-hidden
                            backdrop-blur-xl bg-black/80 
                            border ${activeCard.type === 'error' ? 'border-red-500/50' : borderColor} rounded-2xl
                            shadow-2xl ${activeCard.type === 'error' ? 'shadow-red-900/40' : glowColor}
                        `}>
                            {/* Decorative Scanner Line */}
                            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${activeCard.type === 'error' ? 'via-red-500' : isNightMode ? 'via-amber-500' : 'via-blue-500'} to-transparent opacity-50`} />

                            {/* Card Header */}
                            <div className={`flex items-center justify-between px-6 py-4 border-b border-white/5 ${activeCard.type === 'error' ? 'bg-red-500/10' : 'bg-white/5'}`}>
                                <div className="flex items-center gap-3">
                                    {activeCard.type === 'analysis' ? (
                                        <div className={`p-1.5 rounded bg-${isNightMode ? 'amber' : 'blue'}-500/20`}>
                                            <Radio className={`w-4 h-4 ${accentColor} animate-pulse`} />
                                        </div>
                                    ) : activeCard.type === 'error' ? (
                                        <div className={`p-1.5 rounded bg-red-500/20`}>
                                            <AlertTriangle className="w-4 h-4 text-red-400" />
                                        </div>
                                    ) : (
                                        <div className={`p-1.5 rounded bg-purple-500/20`}>
                                            <Sparkles className="w-4 h-4 text-purple-400" />
                                        </div>
                                    )}
                                    <div>
                                        <h3 className={`font-mono text-xs font-bold tracking-widest ${activeCard.type === 'error' ? 'text-red-400' : accentColor}`}>
                                            {activeCard.title}
                                        </h3>
                                        {activeCard.coords && (
                                            <div className="text-[10px] text-white/40 font-mono mt-0.5">
                                                LAT: {activeCard.coords.lat.toFixed(4)} // LON: {activeCard.coords.lon.toFixed(4)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button onClick={dismissCard} className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Card Content */}
                            <div className="p-6 max-h-[40vh] overflow-y-auto">
                                <p className={`text-sm md:text-base leading-relaxed font-light ${activeCard.type === 'error' ? 'text-red-200' : 'text-gray-200'}`}>
                                    {activeCard.content}
                                </p>
                            </div>

                            {/* Footer decorative bits */}
                            <div className="px-6 py-2 bg-black/20 border-t border-white/5 flex justify-between items-center text-[10px] text-white/20 font-mono">
                                <span>{activeCard.type === 'error' ? 'STATUS: CRITICAL FAIL' : 'CONFIDENCE: 98.4%'}</span>
                                <span>SOURCE: GEMINI-2.5-FLASH</span>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* 3. COMMAND BAR (The Input) */}
                <div className="w-full max-w-xl pointer-events-auto relative z-50 mb-8">
                    {/* Status Indicator floating above input */}
                    <div className="flex justify-between items-end mb-2 px-2">
                        <div className="flex items-center gap-2">
                            {selectedCoords ? (
                                <div className={`flex items-center gap-2 px-3 py-1 rounded bg-${isNightMode ? 'amber' : 'blue'}-900/30 border ${borderColor} text-[10px] font-mono tracking-wider ${accentColor}`}>
                                    <Radio className="w-3 h-3 animate-pulse" />
                                    TARGET LOCKED
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 px-3 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-mono tracking-wider text-white/40">
                                    <Globe className="w-3 h-3" />
                                    GLOBAL SCAN
                                </div>
                            )}
                        </div>
                        
                        {/* Coordinates readout */}
                        <div className="text-[10px] font-mono text-white/30 hidden md:block">
                            {currentCoords.lat.toFixed(2)}° N, {currentCoords.lon.toFixed(2)}° E
                        </div>
                    </div>

                    <form 
                        onSubmit={handleSubmit}
                        className={`
                            relative group
                            transition-all duration-300
                            ${status === ChatState.LOADING ? 'opacity-50 pointer-events-none' : 'opacity-100'}
                        `}
                    >
                        <div className={`
                            absolute inset-0 rounded-xl bg-black/60 backdrop-blur-xl
                            border ${borderColor} transition-colors
                            group-hover:bg-black/80
                            group-focus-within:ring-1 group-focus-within:ring-${isNightMode ? 'amber' : 'blue'}-500/50
                        `} />
                        
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={selectedCoords ? "Ask about this target..." : "Command: 'Go to Paris' or 'Find Everest'"}
                            className="relative w-full bg-transparent border-none text-white px-5 py-4 pr-14 focus:ring-0 placeholder:text-white/30 font-light text-sm"
                        />
                        
                        <button 
                            type="submit"
                            disabled={!input.trim()}
                            className={`
                                absolute right-2 top-1/2 -translate-y-1/2
                                p-2 rounded-lg transition-all duration-200
                                ${input.trim() 
                                    ? `bg-${isNightMode ? 'amber' : 'blue'}-500 text-white shadow-lg` 
                                    : 'bg-white/5 text-white/20'
                                }
                            `}
                        >
                            {status === ChatState.LOADING ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <ArrowRight className="w-4 h-4" />
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default HolographicInterface;