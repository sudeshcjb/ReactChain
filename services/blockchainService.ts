import { Block, Transaction } from '../types';
import { sha256, verifySignature } from './cryptoService';

export class Blockchain {
  public chain: Block[];
  public pendingTransactions: Transaction[];
  public difficulty: number;
  public miningReward: number;

  constructor() {
    this.chain = [];
    this.pendingTransactions = [];
    this.difficulty = 2; // Default starting difficulty (number of leading zeros)
    this.miningReward = 100;
  }

  // Calculate the hash of a block
  async calculateHash(index: number, previousHash: string, timestamp: number, transactions: Transaction[], nonce: number): Promise<string> {
    const data = index + previousHash + timestamp + JSON.stringify(transactions) + nonce;
    return await sha256(data);
  }

  // Create the Genesis block
  async createGenesisBlock(): Promise<Block> {
    const timestamp = Date.now();
    const transactions: Transaction[] = [];
    const hash = await this.calculateHash(0, '0', timestamp, transactions, 0);
    return {
      index: 0,
      timestamp,
      transactions,
      previousHash: '0',
      hash,
      nonce: 0,
      difficulty: 0,
    };
  }

  async initialize() {
    if (this.chain.length === 0) {
      const genesisBlock = await this.createGenesisBlock();
      this.chain.push(genesisBlock);
    }
  }

  getLatestBlock(): Block {
    return this.chain[this.chain.length - 1];
  }

  // Add a new transaction to pending
  addTransaction(transaction: Transaction) {
    if (!transaction.sender || !transaction.recipient) {
      throw new Error('Transaction must include sender and recipient');
    }
    if (!transaction.signature) {
      throw new Error('No signature in transaction');
    }
    this.pendingTransactions.push(transaction);
  }

  // Mine pending transactions
  // This is a generator function to allow the UI to show progress without blocking
  async *minePendingTransactions(minerAddress: string): AsyncGenerator<{ nonce: number; currentHash: string; found: boolean }, Block, unknown> {
    const rewardTx: Transaction = {
      id: crypto.randomUUID(),
      sender: 'SYSTEM',
      recipient: minerAddress,
      amount: this.miningReward,
      timestamp: Date.now(),
      signature: 'SYSTEM_REWARD',
    };

    // Include reward transaction
    const transactions = [...this.pendingTransactions, rewardTx];
    
    const previousBlock = this.getLatestBlock();
    const index = previousBlock.index + 1;
    const timestamp = Date.now();
    let nonce = 0;
    let hash = await this.calculateHash(index, previousBlock.hash, timestamp, transactions, nonce);

    // Proof of Work Loop
    const target = Array(this.difficulty + 1).join('0');
    
    while (hash.substring(0, this.difficulty) !== target) {
      nonce++;
      hash = await this.calculateHash(index, previousBlock.hash, timestamp, transactions, nonce);
      
      // Yield progress every 500 iterations to update UI
      if (nonce % 500 === 0) {
        yield { nonce, currentHash: hash, found: false };
        // Small delay to let UI render
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    const newBlock: Block = {
      index,
      timestamp,
      transactions,
      previousHash: previousBlock.hash,
      hash,
      nonce,
      difficulty: this.difficulty,
    };

    this.chain.push(newBlock);
    this.pendingTransactions = [];
    
    yield { nonce, currentHash: hash, found: true };
    return newBlock;
  }

  // Check if chain is valid
  // Returns { isValid: boolean, errorBlockIndex: number }
  async isChainValid(): Promise<{ isValid: boolean; errorBlockIndex: number }> {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Check if previous hash reference is correct
      if (currentBlock.previousHash !== previousBlock.hash) {
        return { isValid: false, errorBlockIndex: i };
      }

      // Verify signatures of all transactions in the block
      for (const tx of currentBlock.transactions) {
        // Skip system reward transactions as they are not signed by a wallet
        if (tx.sender === 'SYSTEM') continue;

        const dataToVerify = tx.sender + tx.recipient + tx.amount + tx.timestamp;
        const isValidSignature = await verifySignature(tx.sender, tx.signature, dataToVerify);

        if (!isValidSignature) {
          console.warn(`Invalid signature detected in block ${i}, transaction ${tx.id}`);
          return { isValid: false, errorBlockIndex: i };
        }
      }

      // Check if the data has been tampered with (hash no longer matches data)
      const hash = await this.calculateHash(
        currentBlock.index,
        currentBlock.previousHash,
        currentBlock.timestamp,
        currentBlock.transactions,
        currentBlock.nonce
      );

      if (currentBlock.hash !== hash) {
        return { isValid: false, errorBlockIndex: i };
      }
    }
    return { isValid: true, errorBlockIndex: -1 };
  }
  
  getBalanceOfAddress(address: string): number {
    let balance = 0;

    for (const block of this.chain) {
      for (const trans of block.transactions) {
        if (trans.sender === address) {
          balance -= trans.amount;
        }
        if (trans.recipient === address) {
          balance += trans.amount;
        }
      }
    }
    
    // Check pending transactions for spending
    for (const trans of this.pendingTransactions) {
        if (trans.sender === address) {
            balance -= trans.amount;
        }
    }

    return balance;
  }

  // Simulation Methods
  
  // Update difficulty for future blocks
  setDifficulty(diff: number) {
      this.difficulty = diff;
  }

  setMiningReward(amount: number) {
      this.miningReward = amount;
  }

  // Simulates an attack: Modifies data in an existing block without re-mining
  corruptBlock(index: number) {
      if (index >= 0 && index < this.chain.length) {
          // Hack: Modify the first transaction amount or add a fake one
          if (this.chain[index].transactions.length > 0) {
              this.chain[index].transactions[0].amount = 999999999; 
          } else {
             // If empty, add a fake transaction
             this.chain[index].transactions.push({
                 id: 'FAKE',
                 sender: 'HACKER',
                 recipient: 'HACKER',
                 amount: 1000000,
                 timestamp: Date.now(),
                 signature: 'FAKE_SIG'
             });
          }
      }
  }
}