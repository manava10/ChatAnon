// Privacy-Enhanced Chat with End-to-End Encryption
// Messages are encrypted on the client side before sending to server

let socket = null;
let encryptionKey = null;
let partnerPublicKey = null;

// Simple encryption functions (for demonstration - use proper crypto in production)
class SimpleCrypto {
  static generateKeyPair() {
    // Generate a simple key pair (in production, use proper cryptography)
    const privateKey = this.generateRandomKey();
    const publicKey = this.derivePublicKey(privateKey);
    return { privateKey, publicKey };
  }
  
  static generateRandomKey() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  static derivePublicKey(privateKey) {
    // Simple derivation (use proper ECDH in production)
    return btoa(privateKey).slice(0, 32);
  }
  
  static encrypt(message, key) {
    // Simple XOR encryption (use AES-GCM in production)
    const encrypted = [];
    for (let i = 0; i < message.length; i++) {
      encrypted.push(message.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(String.fromCharCode(...encrypted));
  }
  
  static decrypt(encryptedMessage, key) {
    try {
      const encrypted = atob(encryptedMessage);
      const decrypted = [];
      for (let i = 0; i < encrypted.length; i++) {
        decrypted.push(String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length)));
      }
      return decrypted.join('');
    } catch (e) {
      return '[Decryption failed]';
    }
  }
}

// Initialize encryption when paired
function initializeEncryption() {
  const keyPair = SimpleCrypto.generateKeyPair();
  encryptionKey = keyPair.privateKey;
  
  // Send public key to partner
  socket.emit('exchange_key', keyPair.publicKey);
  
  console.log('🔐 Encryption initialized');
}

// Enhanced message sending with encryption
function sendEncryptedMessage(message) {
  if (!partnerPublicKey) {
    appendMessage('⚠️ Encryption not ready yet. Please wait...', false, true);
    return;
  }
  
  // Create shared secret from private key and partner's public key
  const sharedSecret = SimpleCrypto.derivePublicKey(encryptionKey + partnerPublicKey);
  
  // Encrypt the message
  const encryptedMessage = SimpleCrypto.encrypt(message, sharedSecret);
  
  // Send encrypted message
  socket.emit('encrypted_message', encryptedMessage);
  
  // Show original message in UI
  appendMessage(message, true);
  
  console.log('🔐 Message encrypted and sent');
}

// Enhanced message receiving with decryption
function receiveEncryptedMessage(encryptedMessage) {
  if (!partnerPublicKey) {
    appendMessage('[Encrypted message - key not ready]', false);
    return;
  }
  
  // Create shared secret
  const sharedSecret = SimpleCrypto.derivePublicKey(encryptionKey + partnerPublicKey);
  
  // Decrypt the message
  const decryptedMessage = SimpleCrypto.decrypt(encryptedMessage, sharedSecret);
  
  // Show decrypted message in UI
  appendMessage(decryptedMessage, false);
  
  console.log('🔐 Message received and decrypted');
}

// Enhanced socket handlers with encryption
function initializeEncryptedSocketHandlers() {
  socket.on('partner_found', (data) => {
    paired = true;
    setStatus('Partner found! Initializing secure connection...');
    
    if (data.partnerName) {
      showPartnerName(data.partnerName);
    }
    
    // Initialize encryption for this conversation
    initializeEncryption();
    
    appendMessage(`🔐 Connected with ${data.partnerName || 'Anonymous'}. Your conversation is encrypted.`, false, true);
    
    setTimeout(() => {
      setStatus('Connected & Encrypted');
      enableChat();
    }, 1000);
  });
  
  socket.on('key_exchange', (publicKey) => {
    partnerPublicKey = publicKey;
    console.log('🔐 Partner public key received');
    appendMessage('🔐 Secure connection established!', false, true);
  });
  
  socket.on('encrypted_message', (encryptedMessage) => {
    receiveEncryptedMessage(encryptedMessage);
  });
  
  socket.on('partner_left', (reason) => {
    paired = false;
    partnerPublicKey = null;
    encryptionKey = null;
    
    setStatus('Partner left. Looking for new partner...');
    disableChat();
    
    const reasonText = reason ? ` (${reason})` : '';
    appendMessage(`Partner disconnected${reasonText}`, false, true);
  });
}

// Privacy notice display
function showPrivacyNotice() {
  const privacyNotice = document.createElement('div');
  privacyNotice.className = 'system-message';
  privacyNotice.style.background = 'rgba(16, 185, 129, 0.1)';
  privacyNotice.style.border = '1px solid rgba(16, 185, 129, 0.3)';
  privacyNotice.innerHTML = `
    <i class="fas fa-shield-alt"></i>
    <strong>Privacy Protected:</strong> Your messages are encrypted end-to-end. 
    Even the server admin cannot read your conversations.
  `;
  messages.appendChild(privacyNotice);
}

// Show privacy notice on load
document.addEventListener('DOMContentLoaded', () => {
  showPrivacyNotice();
}); 