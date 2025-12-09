import React, { useState, useMemo } from 'react';
import { WalletKeys, Transaction } from '../types';
import { generateKeyPair, signData } from '../services/cryptoService';
import {  Send, Wallet, RefreshCw, Copy, Check, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface WalletViewProps {
  wallet: WalletKeys | null;
  setWallet: (wallet: WalletKeys) => void;
  balance: number;
  onSendTransaction: (tx: Transaction) => void;
  relevantTransactions: Transaction[];
  selectedBlockIndex: number | null;
}

const WalletView: React.FC<WalletViewProps> = ({ 
    wallet, 
    setWallet, 
    balance, 
    onSendTransaction,
    relevantTransactions,
    selectedBlockIndex
}) => {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('10');
  const [copied, setCopied] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  const createWallet = async () => {
    const keys = await generateKeyPair();
    // Simplified address generation (just using part of pubkey for visual simplicity in this demo)
    const address = keys.publicKeyPem;
    setWallet({ ...keys, address });
  };

  const handleSend = async () => {
    if (!wallet || !amount || !recipient) return;
    setIsSigning(true);
    
    try {
        const txData = {
            sender: wallet.publicKeyPem,
            recipient: recipient,
            amount: parseFloat(amount),
            timestamp: Date.now(),
            id: crypto.randomUUID()
        };

        // Create signatureable string
        const dataToSign = txData.sender + txData.recipient + txData.amount + txData.timestamp;
        const signature = await signData(wallet.privateKey, dataToSign);

        const newTx: Transaction = {
            ...txData,
            signature
        };

        onSendTransaction(newTx);
        setAmount('');
    } catch (e) {
        console.error(e);
        alert('Failed to sign transaction');
    } finally {
        setIsSigning(false);
    }
  };

  const copyAddress = () => {
      if(wallet) {
          navigator.clipboard.writeText(wallet.publicKeyPem);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  }

  // Calculate net change for the selected block
  const blockActivity = useMemo(() => {
      if (!relevantTransactions.length || !wallet) return null;
      
      let received = 0;
      let sent = 0;
      
      relevantTransactions.forEach(tx => {
          if (tx.recipient === wallet.publicKeyPem) received += tx.amount;
          if (tx.sender === wallet.publicKeyPem) sent += tx.amount;
      });

      return { received, sent, net: received - sent };
  }, [relevantTransactions, wallet]);

  if (!wallet) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4 bg-slate-800/50 rounded-2xl border border-slate-700">
        <div className="p-4 bg-blue-500/10 rounded-full text-blue-400">
            <Wallet size={48} />
        </div>
        <h3 className="text-xl font-bold text-white">No Wallet Connected</h3>
        <p className="text-slate-400 max-w-sm">Create a new cryptographic key pair (ECDSA) to start signing transactions and interacting with the chain.</p>
        <button 
          onClick={createWallet}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20"
        >
          <RefreshCw size={20} /> Generate Keys
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 flex flex-col h-full overflow-y-auto">
      <div className="flex justify-between items-start mb-6 shrink-0">
        <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Wallet size={20} className="text-blue-400"/> Your Wallet
            </h3>
            <p className="text-slate-400 text-xs mt-1">ECDSA P-256 Curve</p>
        </div>
        <div className="text-right">
            <div className="text-sm text-slate-400">Balance</div>
            <div className="text-2xl font-bold text-emerald-400">{balance.toFixed(2)} COIN</div>
        </div>
      </div>

      <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50 group relative shrink-0">
        <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Your Public Address</label>
        <div className="font-mono text-xs text-slate-300 break-all leading-relaxed">
            {wallet.publicKeyPem}
        </div>
        <button 
            onClick={copyAddress}
            className="absolute top-2 right-2 p-2 rounded hover:bg-slate-700 text-slate-400 transition-colors"
        >
            {copied ? <Check size={14} className="text-emerald-400"/> : <Copy size={14} />}
        </button>
      </div>

      {/* Block Activity Context - Shows when selected block has relevant txs */}
      {blockActivity && (
          <div className="mb-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-lg relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Activity size={48} className="text-indigo-400" />
                   </div>
                   <h4 className="text-indigo-300 text-xs font-bold mb-2 flex items-center gap-2">
                       <Activity size={12} /> Activity in Block #{selectedBlockIndex}
                   </h4>
                   <div className="flex gap-4">
                       {blockActivity.received > 0 && (
                           <div className="flex items-center gap-1 text-emerald-400 text-sm font-mono font-bold">
                               <TrendingDown size={14} /> +{blockActivity.received}
                           </div>
                       )}
                       {blockActivity.sent > 0 && (
                           <div className="flex items-center gap-1 text-amber-400 text-sm font-mono font-bold">
                               <TrendingUp size={14} /> -{blockActivity.sent}
                           </div>
                       )}
                   </div>
                   <div className="mt-2 text-[10px] text-indigo-200/60 border-t border-indigo-500/20 pt-1">
                       Net Change: <span className={blockActivity.net >= 0 ? 'text-emerald-400' : 'text-amber-400'}>{blockActivity.net > 0 ? '+' : ''}{blockActivity.net}</span>
                   </div>
              </div>
          </div>
      )}

      <div className="space-y-4 mt-auto">
        <h4 className="font-semibold text-slate-200 text-sm">Create Transaction</h4>
        
        <div>
            <label className="text-xs text-slate-400 mb-1 block">Recipient Address (Public Key)</label>
            <input 
                type="text" 
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Paste public key..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors font-mono"
            />
        </div>

        <div>
            <label className="text-xs text-slate-400 mb-1 block">Amount</label>
            <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
        </div>

        <button 
            onClick={handleSend}
            disabled={!recipient || !amount || isSigning || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
        >
            {isSigning ? 'Signing...' : <><Send size={18} /> Sign & Send Transaction</>}
        </button>
      </div>
    </div>
  );
};

export default WalletView;