export interface Transaction {
  id: string;
  sender: string; // Public Key
  recipient: string; // Public Key
  amount: number;
  timestamp: number;
  signature: string;
}

export interface Block {
  index: number;
  timestamp: number;
  transactions: Transaction[];
  previousHash: string;
  hash: string;
  nonce: number;
  difficulty: number;
}

export interface WalletKeys {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyPem: string;
  address: string; // Simplified version of public key for display
}

export enum AppStatus {
  IDLE = 'IDLE',
  MINING = 'MINING',
  SYNCING = 'SYNCING',
}