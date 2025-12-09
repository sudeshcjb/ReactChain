import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Blockchain } from './services/blockchainService';
import { Block, Transaction, WalletKeys, AppStatus } from './types';
import BlockCard from './components/BlockCard';
import WalletView from './components/WalletView';
import { Pickaxe, Box, Activity, ShieldCheck, Cpu, ArrowRight, Zap, CheckCircle, XCircle, RefreshCw, Settings, AlertTriangle, Hammer, Repeat, Hash, ArrowDownLeft, ArrowUpRight, Search } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// Instantiate Blockchain logic outside component to persist state across re-renders (in a real app, use Context)
const blockchain = new Blockchain();

function App() {
  const [chain, setChain] = useState<Block[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [wallet, setWallet] = useState<WalletKeys | null>(null);
  const [balance, setBalance] = useState(0);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [miningState, setMiningState] = useState<{ nonce: number; hash: string } | null>(null);
  const [geminiAnalysis, setGeminiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [validationResult, setValidationResult] = useState<'valid' | 'invalid' | null>(null);
  const [invalidBlockIndex, setInvalidBlockIndex] = useState<number>(-1);
  const [isValidating, setIsValidating] = useState(false);
  
  // Search State
  const [txSearchTerm, setTxSearchTerm] = useState('');
  
  // Settings State
  const [difficulty, setDifficulty] = useState(2);
  const [reward, setReward] = useState(100);

  // Initialize
  useEffect(() => {
    const init = async () => {
        await blockchain.initialize();
        setChain([...blockchain.chain]);
        setSelectedBlock(blockchain.chain[0]);
    };
    init();
  }, []);

  // Update balance when chain or pending tx changes
  useEffect(() => {
    if (wallet) {
      const bal = blockchain.getBalanceOfAddress(wallet.publicKeyPem);
      setBalance(bal);
    }
  }, [chain, pendingTransactions, wallet]);

  const handleTransaction = (tx: Transaction) => {
      try {
          blockchain.addTransaction(tx);
          setPendingTransactions([...blockchain.pendingTransactions]);
      } catch (e) {
          alert((e as Error).message);
      }
  };

  const updateSettings = () => {
      blockchain.setDifficulty(difficulty);
      blockchain.setMiningReward(reward);
  };

  const mineBlock = async () => {
      if (!wallet) {
          alert('Connect wallet to receive mining rewards!');
          return;
      }
      // Ensure settings are synced before mining
      updateSettings();

      setStatus(AppStatus.MINING);
      
      const miner = blockchain.minePendingTransactions(wallet.publicKeyPem);
      
      try {
          while (true) {
              const result = await miner.next();
              if (result.done) {
                  // Mining finished
                  const newBlock = result.value as Block;
                  setChain([...blockchain.chain]);
                  setPendingTransactions([]);
                  setSelectedBlock(newBlock);
                  setStatus(AppStatus.IDLE);
                  setMiningState(null);
                  break;
              } else {
                  // Update UI with mining progress
                  const progress = result.value as { nonce: number; currentHash: string; found: boolean };
                  setMiningState({
                      nonce: progress.nonce,
                      hash: progress.currentHash
                  });
              }
          }
      } catch (e) {
          console.error(e);
          setStatus(AppStatus.IDLE);
      }
  };

  const analyzeWithGemini = async () => {
    if (!selectedBlock || !process.env.API_KEY) return;
    setIsAnalyzing(true);
    setGeminiAnalysis('');

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `
            Analyze this blockchain block data and explain it simply to a student.
            Highlight the Proof of Work (nonce/difficulty) and any interesting transactions.
            
            Block Data:
            ${JSON.stringify({
                index: selectedBlock.index,
                hash: selectedBlock.hash,
                previousHash: selectedBlock.previousHash,
                nonce: selectedBlock.nonce,
                transactions: selectedBlock.transactions.map(t => ({
                    from: t.sender.substring(0, 20) + '...',
                    to: t.recipient.substring(0, 20) + '...',
                    amount: t.amount
                }))
            }, null, 2)}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        
        setGeminiAnalysis(response.text || "No analysis generated.");
    } catch (error) {
        console.error("Gemini Error:", error);
        setGeminiAnalysis("Could not analyze block. Ensure API Key is valid.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleValidateChain = async () => {
      setIsValidating(true);
      setValidationResult(null);
      setInvalidBlockIndex(-1);
      
      // Small delay to show loading state
      await new Promise(r => setTimeout(r, 600));
      
      const { isValid, errorBlockIndex } = await blockchain.isChainValid();
      
      setValidationResult(isValid ? 'valid' : 'invalid');
      setInvalidBlockIndex(errorBlockIndex);
      setIsValidating(false);

      if (errorBlockIndex !== -1) {
          // Auto scroll or select the bad block could happen here
          setSelectedBlock(blockchain.chain[errorBlockIndex]);
      }

      // Auto clear after 6s
      setTimeout(() => {
          setValidationResult(null);
      }, 6000);
  };

  const handleTamperBlock = () => {
      if (!selectedBlock) return;
      if (confirm(`Are you sure you want to corrupt Block #${selectedBlock.index}? This will invalidate the chain.`)) {
          blockchain.corruptBlock(selectedBlock.index);
          // Force update chain state
          setChain([...blockchain.chain]);
          setSelectedBlock({...blockchain.chain[selectedBlock.index]}); // Refresh selected view
          
          // Clear previous validation status so user has to click validate again to see the error
          setValidationResult(null);
          setInvalidBlockIndex(-1);
      }
  };

  const handleReplayTransactions = () => {
    if (!selectedBlock) return;
    
    // Filter out system rewards, we only want to replay user signed actions
    const userTxs = selectedBlock.transactions.filter(tx => tx.sender !== 'SYSTEM');
    
    if (userTxs.length === 0) {
        alert("No replayable user transactions found in this block.");
        return;
    }

    // Add valid signed transactions back to pending pool
    userTxs.forEach(tx => {
        // Clone to simulate a fresh submission of the exact same signed payload
        blockchain.addTransaction({ ...tx });
    });

    setPendingTransactions([...blockchain.pendingTransactions]);
    alert(`${userTxs.length} transactions re-added to Mempool! Mine a new block to verify they can be processed again (Replay Attack).`);
  };

  // Compute transactions involving the user in the selected block
  const relevantWalletTransactions = useMemo(() => {
      if (!wallet || !selectedBlock) return [];
      return selectedBlock.transactions.filter(
          tx => tx.sender === wallet.publicKeyPem || tx.recipient === wallet.publicKeyPem
      );
  }, [wallet, selectedBlock]);

  // Filter transactions based on search
  const filteredTransactions = useMemo(() => {
      if (!selectedBlock) return [];
      if (!txSearchTerm.trim()) return selectedBlock.transactions;

      const term = txSearchTerm.toLowerCase();
      return selectedBlock.transactions.filter(tx => 
          tx.sender.toLowerCase().includes(term) || 
          tx.recipient.toLowerCase().includes(term)
      );
  }, [selectedBlock, txSearchTerm]);

  // Helper to check if address belongs to current wallet
  const isMe = useCallback((address: string) => {
      return wallet && address === wallet.publicKeyPem;
  }, [wallet]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row text-slate-200 overflow-hidden">
      
      {/* Sidebar / Left Panel */}
      <aside className="w-full lg:w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-[50vh] lg:h-screen shrink-0 overflow-y-auto">
        <div className="p-6 border-b border-slate-800">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
                <Box className="text-blue-500" /> ReactChain
            </h1>
            <p className="text-slate-500 text-xs mt-2">Client-side Blockchain Simulator</p>
        </div>

        <div className="p-4 space-y-4">
            {/* Mining Status Panel */}
            <div className={`p-4 rounded-xl border ${status === AppStatus.MINING ? 'bg-amber-900/20 border-amber-700/50' : 'bg-slate-800/50 border-slate-700'}`}>
                <div className="flex justify-between items-center mb-2">
                    <h2 className="font-semibold text-sm flex items-center gap-2">
                        <Pickaxe size={16} className={status === AppStatus.MINING ? 'animate-bounce text-amber-500' : 'text-slate-400'} />
                        Miner Status
                    </h2>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${status === AppStatus.MINING ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
                        {status}
                    </span>
                </div>
                
                {status === AppStatus.MINING && miningState ? (
                    <div className="space-y-3 mt-3 relative animate-in fade-in duration-300">
                         {/* Styles for the scanning animation */}
                         <style>{`
                            @keyframes scan {
                                0% { transform: translateX(-100%); }
                                100% { transform: translateX(250%); }
                            }
                         `}</style>

                         <div className="bg-black/40 p-3 rounded-lg border border-amber-500/30 relative overflow-hidden group">
                            
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] uppercase text-slate-500 font-bold">Target Diff: {difficulty}</span>
                                <span className="text-[10px] font-mono text-amber-500 animate-pulse">Computing...</span>
                            </div>
                            
                            {/* The visual match */}
                            <div className="flex items-center gap-1 font-mono text-lg leading-none mb-3">
                                <div className="flex">
                                    {Array.from({length: difficulty}).map((_, i) => (
                                        <div key={i} className="w-5 h-7 bg-slate-800 rounded mx-0.5 flex items-center justify-center text-emerald-500 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.4)] font-bold">
                                            0
                                        </div>
                                    ))}
                                    {/* Placeholder for the rest */}
                                    <div className="w-5 h-7 bg-slate-900/50 rounded mx-0.5 flex items-center justify-center text-slate-700 border border-transparent">?</div>
                                    <div className="w-5 h-7 bg-slate-900/50 rounded mx-0.5 flex items-center justify-center text-slate-700 border border-transparent">?</div>
                                </div>
                            </div>

                            {/* Current Hash Stream */}
                            <div className="border-t border-slate-800 pt-2">
                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Nonce: <span className="text-slate-200">{miningState.nonce.toLocaleString()}</span></span>
                                </div>
                                <div className="font-mono text-[10px] text-slate-500 truncate relative p-1 bg-slate-950/50 rounded">
                                    <span className="text-amber-600">{miningState.hash.substring(0, difficulty)}</span>
                                    <span>{miningState.hash.substring(difficulty)}</span>
                                    
                                    {/* Scanning overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent w-full h-full pointer-events-none" style={{ animation: 'scan 1.5s linear infinite' }}></div>
                                </div>
                            </div>
                         </div>
                         
                         {/* Indeterminate Progress Bar */}
                         <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden relative">
                             <div className="absolute top-0 left-0 h-full w-1/3 bg-amber-500 blur-[2px]" style={{ animation: 'scan 1s linear infinite' }}></div>
                         </div>
                    </div>
                ) : (
                    <button 
                        onClick={mineBlock}
                        disabled={!wallet || status === AppStatus.MINING}
                        className="w-full mt-2 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-xs font-bold rounded-lg transition-all text-white flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95"
                    >
                        <Pickaxe size={16} />
                        {pendingTransactions.length > 0 ? `Mine Block (${pendingTransactions.length} TXs)` : 'Mine Empty Block'}
                    </button>
                )}
                <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
                    <span>Pending TXs: {pendingTransactions.length}</span>
                    <span>Reward: {reward}</span>
                </div>
            </div>

            {/* Network Settings */}
            <div className="p-4 rounded-xl border bg-slate-800/50 border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                    <Settings size={16} className="text-slate-400" />
                    <h2 className="font-semibold text-sm">Network Settings</h2>
                </div>
                
                <div className="space-y-3">
                    <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span>Difficulty (Leading Zeros)</span>
                            <span className="text-white font-mono">{difficulty}</span>
                        </div>
                        <input 
                            type="range" min="1" max="5" step="1"
                            value={difficulty}
                            onChange={(e) => setDifficulty(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                     <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span>Mining Reward</span>
                            <span className="text-white font-mono">{reward}</span>
                        </div>
                        <input 
                            type="number"
                            value={reward}
                            onChange={(e) => setReward(parseInt(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs"
                        />
                    </div>
                </div>
            </div>

            {/* Validation Panel */}
            <div className={`p-4 rounded-xl border transition-colors ${
                validationResult === 'valid' ? 'bg-emerald-900/10 border-emerald-700/30' :
                validationResult === 'invalid' ? 'bg-red-900/10 border-red-700/30' :
                'bg-slate-800/50 border-slate-700'
            }`}>
                <div className="flex justify-between items-center mb-2">
                    <h2 className="font-semibold text-sm flex items-center gap-2 text-slate-200">
                        <ShieldCheck size={16} className={validationResult === 'valid' ? 'text-emerald-500' : validationResult === 'invalid' ? 'text-red-500' : 'text-slate-400'} />
                        Chain Health
                    </h2>
                </div>
                
                <button 
                    onClick={handleValidateChain}
                    disabled={isValidating || status === AppStatus.MINING}
                    className={`w-full py-2 text-xs font-bold rounded transition-all text-white flex items-center justify-center gap-2
                        ${validationResult === 'valid' ? 'bg-emerald-600 cursor-default' : 
                          validationResult === 'invalid' ? 'bg-red-600 cursor-default' : 
                          'bg-slate-700 hover:bg-slate-600'}
                    `}
                >
                    {isValidating ? (
                        <><RefreshCw size={14} className="animate-spin"/> Verifying...</>
                    ) : validationResult === 'valid' ? (
                        <><CheckCircle size={14}/> Chain Valid</>
                    ) : validationResult === 'invalid' ? (
                        <><XCircle size={14}/> Chain Corrupted</>
                    ) : (
                        'Validate Chain Integrity'
                    )}
                </button>
                {validationResult === 'invalid' && (
                    <div className="mt-2 text-[10px] text-red-400 text-center">
                        Validation Failed at Block #{invalidBlockIndex}
                    </div>
                )}
            </div>

            {/* Wallet Panel */}
            <div className="flex-1 overflow-hidden flex flex-col">
                 <WalletView 
                    wallet={wallet} 
                    setWallet={setWallet} 
                    balance={balance}
                    onSendTransaction={handleTransaction}
                    relevantTransactions={relevantWalletTransactions}
                    selectedBlockIndex={selectedBlock ? selectedBlock.index : null}
                 />
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-[50vh] lg:h-screen overflow-hidden bg-[#0b1120]">
        
        {/* Chain Visualization (Horizontal Scroll) */}
        <div className="h-1/2 p-6 overflow-x-auto overflow-y-hidden border-b border-slate-800 bg-slate-900/50 relative">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 sticky left-0">
                <Activity size={16} /> Blockchain State
            </h2>
            <div className="flex gap-8 items-center min-w-max pb-4 px-2">
                {chain.map((block, idx) => {
                    let status: 'default' | 'selected' | 'invalid' = 'default';
                    if (invalidBlockIndex !== -1 && idx >= invalidBlockIndex) {
                        status = 'invalid';
                    } else if (selectedBlock?.hash === block.hash) {
                        status = 'selected';
                    }

                    return (
                        <React.Fragment key={block.hash}>
                            <BlockCard 
                                block={block} 
                                onClick={setSelectedBlock} 
                                status={status}
                                isLatest={idx === chain.length - 1}
                            />
                            {idx < chain.length - 1 && (
                                 <ArrowRight className={`shrink-0 ${status === 'invalid' ? 'text-red-800' : 'text-slate-700'}`} size={24} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>

        {/* Block Detail & Inspector */}
        <div className="h-1/2 p-6 overflow-y-auto flex flex-col lg:flex-row gap-6">
            
            {/* Block Data JSON */}
            <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                     <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Cpu size={16} /> Block Inspector {selectedBlock && <span className="text-white normal-case opacity-50">#{selectedBlock.index}</span>}
                    </h2>
                    {selectedBlock && selectedBlock.index !== 0 && (
                         <button 
                            onClick={handleTamperBlock}
                            className="text-[10px] bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900 px-3 py-1 rounded flex items-center gap-1 transition-all"
                            title="Simulate a 51% attack by modifying data"
                         >
                            <Hammer size={12} /> Corrupt Data
                         </button>
                    )}
                </div>
               
                <div className={`rounded-xl border p-4 font-mono text-xs overflow-auto flex-1 transition-colors ${
                    invalidBlockIndex !== -1 && selectedBlock && selectedBlock.index >= invalidBlockIndex
                    ? 'bg-red-950/10 border-red-500/30 text-red-400'
                    : 'bg-black/40 border-slate-800 text-emerald-500'
                }`}>
                    {selectedBlock ? (
                        <pre>{JSON.stringify(selectedBlock, null, 2)}</pre>
                    ) : (
                        <div className="text-slate-500 italic">Select a block to inspect details</div>
                    )}
                </div>
            </div>

            {/* Transactions & Analysis */}
            <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ShieldCheck size={16} /> Analysis & Transactions
                    </h2>
                    <div className="flex gap-2">
                        {selectedBlock && selectedBlock.transactions.some(t => t.sender !== 'SYSTEM') && (
                            <button 
                            onClick={handleReplayTransactions}
                            className="text-[10px] bg-amber-900/30 hover:bg-amber-900/50 text-amber-400 border border-amber-900 px-3 py-1 rounded flex items-center gap-1 transition-all"
                            title="Re-broadcast these transactions to the network (Replay Attack Simulation)"
                            >
                            <Repeat size={12} /> Replay Txs
                            </button>
                        )}
                        {selectedBlock && process.env.API_KEY && (
                            <button 
                                onClick={analyzeWithGemini}
                                disabled={isAnalyzing}
                                className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-full flex items-center gap-1 transition-all"
                            >
                                <Zap size={10} /> {isAnalyzing ? 'Analyzing...' : 'Ask Gemini AI'}
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="bg-slate-800/30 rounded-xl border border-slate-800 p-4 flex-1 overflow-auto flex flex-col">
                    {/* Gemini Result */}
                    {geminiAnalysis && (
                        <div className="p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-lg mb-4">
                            <h4 className="text-indigo-400 text-xs font-bold mb-1 flex items-center gap-1">
                                <Zap size={12} /> AI Insight
                            </h4>
                            <p className="text-xs text-indigo-100 leading-relaxed whitespace-pre-wrap">
                                {geminiAnalysis}
                            </p>
                        </div>
                    )}

                    {/* Search Bar */}
                    <div className="relative mb-3 shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input 
                            type="text" 
                            placeholder="Search sender or recipient address..." 
                            value={txSearchTerm}
                            onChange={(e) => setTxSearchTerm(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-9 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                        />
                    </div>

                    {/* Transaction List */}
                    <div className="space-y-4 overflow-y-auto">
                        {filteredTransactions.length === 0 && (
                            <div className="text-center text-slate-500 py-8 text-sm">
                                {selectedBlock?.transactions.length === 0 ? "No transactions in this block" : "No matches found"}
                            </div>
                        )}
                        
                        {filteredTransactions.map((tx) => {
                            const sentByMe = isMe(tx.sender);
                            const receivedByMe = isMe(tx.recipient);
                            
                            return (
                                <div key={tx.id} className={`p-3 rounded border transition-colors ${
                                    sentByMe ? 'bg-amber-900/10 border-amber-800/50' :
                                    receivedByMe ? 'bg-emerald-900/10 border-emerald-800/50' :
                                    'bg-slate-900 border-slate-700/50'
                                }`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex gap-2">
                                            <span className={`text-[10px] px-1.5 rounded flex items-center gap-1 ${tx.sender === 'SYSTEM' ? 'bg-blue-900 text-blue-300' : 'bg-slate-700 text-slate-300'}`}>
                                                {tx.sender === 'SYSTEM' ? 'MINING REWARD' : 'TRANSFER'}
                                            </span>
                                            {sentByMe && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 rounded flex items-center gap-1 font-bold"><ArrowUpRight size={10} /> SENT</span>}
                                            {receivedByMe && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 rounded flex items-center gap-1 font-bold"><ArrowDownLeft size={10} /> RECEIVED</span>}
                                        </div>
                                        <span className="text-emerald-400 font-mono text-sm font-bold">
                                            {tx.amount} COIN
                                        </span>
                                    </div>
                                    <div className="space-y-1 mt-2">
                                        <div className="flex gap-2 text-[10px]">
                                            <span className="text-slate-500 w-10">From:</span>
                                            <span className={`font-mono truncate w-48 ${sentByMe ? 'text-amber-400 font-bold' : 'text-slate-400'}`} title={tx.sender}>
                                                {tx.sender === 'SYSTEM' ? 'SYSTEM (Proof of Work)' : (sentByMe ? 'YOU (My Wallet)' : tx.sender)}
                                            </span>
                                        </div>
                                        <div className="flex gap-2 text-[10px]">
                                            <span className="text-slate-500 w-10">To:</span>
                                            <span className={`font-mono truncate w-48 ${receivedByMe ? 'text-emerald-400 font-bold' : 'text-slate-400'}`} title={tx.recipient}>
                                                {receivedByMe ? 'YOU (My Wallet)' : tx.recipient}
                                            </span>
                                        </div>
                                        <div className="flex gap-2 text-[10px]">
                                            <span className="text-slate-500 w-10">Sign:</span>
                                            <span className="font-mono text-slate-600 truncate w-48">{tx.signature.substring(0, 20)}...</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

        </div>
      </main>
    </div>
  );
}

export default App;