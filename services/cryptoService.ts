// Helper to convert ArrayBuffer to Hex string
export const bufferToHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// Helper to convert Hex string to ArrayBuffer
export const hexToBuffer = (hex: string): ArrayBuffer => {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
  return bytes.buffer;
};

// SHA-256 Hashing
export const sha256 = async (data: string): Promise<string> => {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
  return bufferToHex(hashBuffer);
};

// Generate ECDSA Key Pair
export const generateKeyPair = async (): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey; publicKeyPem: string }> => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify']
  );

  const exported = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyPem = bufferToHex(exported);

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyPem,
  };
};

// Sign Data
export const signData = async (privateKey: CryptoKey, data: string): Promise<string> => {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  const signature = await window.crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    privateKey,
    encoded
  );
  return bufferToHex(signature);
};

// Verify Signature
export const verifySignature = async (publicKeyHex: string, signatureHex: string, data: string): Promise<boolean> => {
  try {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    const signatureBuffer = hexToBuffer(signatureHex);
    const publicKeyBuffer = hexToBuffer(publicKeyHex);

    const importedPublicKey = await window.crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      false,
      ['verify']
    );

    return await window.crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      importedPublicKey,
      signatureBuffer,
      encodedData
    );
  } catch (e) {
    console.error('Verification failed', e);
    return false;
  }
};
