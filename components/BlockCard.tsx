import React, { useState } from 'react';
import { Block } from '../types';
import { AlertTriangle, Copy, Check } from 'lucide-react';

interface BlockCardProps {
  block: Block;
  onClick: (block: Block) => void;
  status: 'default' | 'selected' | 'invalid';
  isLatest: boolean;
}

const HashDisplay = ({ label, hash, isGenesis = false }: { label: string; hash: string; isGenesis?: boolean }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      {/* Normal View (Truncated) */}
      <div className="p-1 -m-1 rounded hover:bg-slate-700/30 transition-colors">
        <label className="text-[10px] uppercase text-slate-500 font-semibold block">{label}</label>
        <div className="text-xs font-mono text-slate-300 truncate">
          {isGenesis ? 'GENESIS' : `${hash.substring(0, 12)}...`}
        </div>
      </div>

      {/* Hover Popup (Full Hash) */}
      {!isGenesis && (
        <div className="hidden group-hover:block absolute top-0 left-0 w-[110%] -ml-[5%] z-20 bg-slate-800 border border-emerald-500/50 rounded p-3 shadow-2xl animate-in fade-in duration-100">
          <div className="flex justify-between items-center mb-1">
             <label className="text-[10px] uppercase text-emerald-400 font-bold flex items-center gap-2">
                {label}
             </label>
             <div className="flex items-center gap-2">
                 <span className="text-[8px] text-emerald-600 border border-emerald-800 px-1 rounded">FULL</span>
                 <button 
                    onClick={handleCopy}
                    className="text-emerald-500 hover:text-emerald-300 transition-colors p-1 hover:bg-emerald-900/30 rounded"
                    title="Copy full hash"
                 >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                 </button>
             </div>
          </div>
          <div className="text-[10px] font-mono text-white break-all leading-relaxed bg-black/30 p-1 rounded border border-white/5">
            {hash}
          </div>
        </div>
      )}
    </div>
  );
};

const BlockCard: React.FC<BlockCardProps> = ({ block, onClick, status, isLatest }) => {
  
  let borderColor = 'border-slate-700';
  let bgColor = 'bg-slate-800/50';
  let shadow = '';

  if (status === 'selected') {
      borderColor = 'border-blue-500';
      bgColor = 'bg-slate-800';
      shadow = 'shadow-[0_0_15px_rgba(59,130,246,0.3)]';
  } else if (status === 'invalid') {
      borderColor = 'border-red-500';
      bgColor = 'bg-red-950/20';
      shadow = 'shadow-[0_0_15px_rgba(239,68,68,0.4)]';
  } else if (isLatest) {
      borderColor = 'border-emerald-500';
      bgColor = 'bg-emerald-950/20';
      shadow = 'shadow-[0_0_20px_rgba(16,185,129,0.2)]';
  }

  return (
    <div 
      onClick={() => onClick(block)}
      className={`
        relative p-4 rounded-xl border-2 transition-all cursor-pointer hover:scale-105 active:scale-95
        ${borderColor} ${bgColor} ${shadow}
        w-64 flex-shrink-0 flex flex-col gap-2
      `}
    >
      <div className="flex justify-between items-center mb-2">
        <span className={`text-xs font-bold uppercase tracking-wider ${status === 'invalid' ? 'text-red-400' : 'text-slate-400'}`}>
            {status === 'invalid' && <AlertTriangle size={12} className="inline mr-1 mb-0.5" />}
            Block #{block.index}
        </span>
        <span className="text-[10px] text-slate-500">{new Date(block.timestamp).toLocaleTimeString()}</span>
      </div>
      
      <div className="space-y-3">
        <HashDisplay label="Hash" hash={block.hash} />
        <HashDisplay label="Prev Hash" hash={block.previousHash} isGenesis={block.previousHash === '0'} />

        <div className="flex justify-between items-center pt-2 mt-1">
            <div className="flex gap-1">
                <div className="bg-slate-900/50 px-2 py-1 rounded text-[10px] text-slate-400">
                    Nonce: {block.nonce}
                </div>
                <div className="bg-slate-900/50 px-2 py-1 rounded text-[10px] text-slate-400" title={`Difficulty: ${block.difficulty}`}>
                    Diff: {block.difficulty}
                </div>
            </div>
            <div className={`px-2 py-1 rounded text-[10px] font-bold ${status === 'invalid' ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'}`}>
                {block.transactions.length} TXs
            </div>
        </div>
      </div>
      
      {/* Chain Link Visual */}
      <div className={`absolute top-1/2 -right-6 w-6 h-1 hidden last:hidden lg:block z-0 transform -translate-y-1/2 ${status === 'invalid' ? 'bg-red-900' : 'bg-slate-700'}`} />
    </div>
  );
};

export default BlockCard;