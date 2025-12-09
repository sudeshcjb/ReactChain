import React, { useState, useEffect } from 'react';
import { Block } from '../types';
import { AlertTriangle, Copy, Check, ShieldAlert } from 'lucide-react';
import { verifySignature } from '../services/cryptoService';

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
      {/* Normal View */}
      <div className="p-1 -m-1 rounded hover:bg-slate-700/30 transition-colors">
        <div className="flex justify-between items-center mb-0.5">
            <label className="text-[10px] uppercase text-slate-500 font-semibold">{label}</label>
            {!isGenesis && (
                <button 
                    onClick={handleCopy}
                    className="text-slate-500 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-700"
                    title="Copy full hash"
                >
                    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
            )}
        </div>
        <div className="text-xs font-mono text-slate-300 truncate cursor-help">
          {isGenesis ? 'GENESIS' : `${hash.substring(0, 12)}...`}
        </div>
      </div>

      {/* Hover Tooltip (Full Hash) */}
      {!isGenesis && (
        <div className="hidden group-hover:block absolute left-0 top-full mt-2 w-[140%] -ml-[20%] z-20 bg-slate-900 border border-emerald-500/30 rounded p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
          <div className="text-[9px] font-mono text-emerald-500 font-bold mb-1 flex items-center gap-1">
             FULL HASH
          </div>
          <div className="text-[9px] font-mono text-slate-300 break-all leading-tight">
            {hash}
          </div>
        </div>
      )}
    </div>
  );
};

const BlockCard: React.FC<BlockCardProps> = ({ block, onClick, status, isLatest }) => {
  const [txHealth, setTxHealth] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const checkSignatures = async () => {
        const health: Record<string, boolean> = {};
        for (const tx of block.transactions) {
            if (tx.sender === 'SYSTEM') {
                health[tx.id] = true;
                continue;
            }
            // Must include fee in verification string
            const dataToVerify = tx.sender + tx.recipient + tx.amount + tx.fee + tx.timestamp;
            const isValid = await verifySignature(tx.sender, tx.signature, dataToVerify);
            health[tx.id] = isValid;
        }
        setTxHealth(health);
    };
    checkSignatures();
  }, [block]);
  
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

  const invalidCount = Object.values(txHealth).filter(v => !v).length;

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
        
        {/* Transaction Health Visualizer */}
        {block.transactions.length > 0 && (
            <div className="pt-2 border-t border-slate-700/50">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] text-slate-500 uppercase font-bold">TX Health</span>
                    {invalidCount > 0 && <span className="text-[9px] text-red-400 font-bold">{invalidCount} Invalid</span>}
                </div>
                <div className="flex gap-1 flex-wrap">
                    {block.transactions.map((tx, i) => {
                        const isValid = txHealth[tx.id];
                        const isSystem = tx.sender === 'SYSTEM';
                        let color = 'bg-slate-700';
                        if (isValid === false) color = 'bg-red-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.5)]';
                        else if (isSystem) color = 'bg-blue-500';
                        else if (isValid === true) color = 'bg-emerald-500';

                        return (
                            <div 
                                key={tx.id} 
                                className={`w-2 h-2 rounded-sm ${color} cursor-help transition-transform hover:scale-150`} 
                                title={`Index: ${i}
ID: ${tx.id}
Type: ${isSystem ? 'Mining Reward' : 'Transfer'}
Status: ${isValid ? 'Valid Signature' : 'INVALID SIGNATURE'}`}
                            />
                        );
                    })}
                </div>
            </div>
        )}
      </div>
      
      {/* Chain Link Visual */}
      <div className={`absolute top-1/2 -right-6 w-6 h-1 hidden last:hidden lg:block z-0 transform -translate-y-1/2 ${status === 'invalid' ? 'bg-red-900' : 'bg-slate-700'}`} />
    </div>
  );
};

export default BlockCard;