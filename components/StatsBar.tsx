
import React from 'react';
import { GameState } from '../types';

interface StatsBarProps {
  state: GameState;
  onSaveAndQuit: () => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({ state, onSaveAndQuit }) => {
  const dateStr = state.currentDate.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="sticky top-0 z-[150] bg-black/90 backdrop-blur-xl border-b border-white/5 p-3 sm:p-4 flex justify-between items-center shadow-2xl safe-top">
      <div className="flex gap-4 sm:gap-8 md:gap-12">
        <div className="flex flex-col">
          <span className="text-[8px] sm:text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em]">Month</span>
          <span className="text-xs sm:text-sm font-bold text-white uppercase">{dateStr}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] sm:text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em]">Cash</span>
          <span className="text-xs sm:text-sm font-bold text-amber-400">${state.player.money.toLocaleString()}</span>
        </div>
        <div className="flex flex-col hidden sm:flex">
          <span className="text-[8px] sm:text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em]">Audience</span>
          <span className="text-xs sm:text-sm font-bold text-red-500">{state.player.fans.toLocaleString()}</span>
        </div>
        <div className="flex flex-col hidden md:flex">
          <span className="text-[8px] sm:text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em]">Status</span>
          <span className="text-xs sm:text-sm font-bold text-amber-200">{(state.player.fame / 1000000).toFixed(2)}M</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button 
          onClick={onSaveAndQuit}
          className="bg-zinc-900/50 hover:bg-red-950/20 text-zinc-500 hover:text-red-500 border border-white/5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
        >
          Save
        </button>
        
        <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-white/5">
          <div className="w-8 h-8 sm:w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 to-amber-300 flex items-center justify-center p-[1px] sm:p-[2px]">
             <div className="w-full h-full bg-black rounded-full flex items-center justify-center font-black text-amber-400 text-xs sm:text-base">
              {state.player.stageName[0]}
             </div>
          </div>
          <div className="hidden sm:block">
            <div className="text-xs sm:text-sm font-black text-white tracking-tight leading-none">{state.player.stageName}</div>
            <div className="text-[8px] sm:text-[10px] text-zinc-500 uppercase font-bold">{state.player.genre}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
