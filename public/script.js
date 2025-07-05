let socket = null; // Initialize socket after name is entered

const messages = document.getElementById('messages');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const status = document.getElementById('status');
const typingIndicator = document.getElementById('typing');
const nextBtn = document.getElementById('next-btn');
const nameModal = document.getElementById('name-modal');
const nameInput = document.getElementById('name-input');
const nameSubmitBtn = document.getElementById('name-submit');
const partnerNameSpan = document.getElementById('partner-name');

let paired = false;
let typingTimer = null;
let heartbeatInterval = null;
let connectionAttempts = 0;
let isReconnecting = false;
let userName = '';
let partnerName = '';

// Name handling functions
function showNameModal() {
  nameModal.style.display = 'flex';
  nameInput.focus();
}

function hideNameModal() {
  nameModal.style.display = 'none';
}

function submitName() {
  const name = nameInput.value.trim();
  if (name.length < 1) {
    nameInput.style.borderColor = '#ef4444';
    nameInput.placeholder = 'Please enter a name';
    return;
  }
  
  if (name.length > 20) {
    nameInput.style.borderColor = '#ef4444';
    nameInput.placeholder = 'Name too long (max 20 characters)';
    return;
  }
  
  userName = name;
  hideNameModal();
  initializeSocket();
}

function initializeSocket() {
  socket = io({
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });
  
  // Send name to server once connected
  socket.on('connect', () => {
    console.log('🔌 Connected to server');
    socket.emit('set_name', userName);
    setStatus('Looking for a partner...');
    disableChat();
    isReconnecting = false;
    connectionAttempts = 0;
  });
  
  // Initialize all other socket handlers
  initializeSocketHandlers();
  initializeConnection();
}

// Connection management
function initializeConnection() {
  // Start heartbeat
  heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('heartbeat');
    }
  }, 30000); // Every 30 seconds

  // Handle reconnection
  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Reconnected after', attemptNumber, 'attempts');
    isReconnecting = false;
    setStatus('Reconnected! Looking for a partner...');
    connectionAttempts = 0;
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    connectionAttempts = attemptNumber;
    isReconnecting = true;
    setStatus(`Connection lost. Reconnecting... (${attemptNumber}/5)`);
  });

  socket.on('reconnect_failed', () => {
    setStatus('Connection failed. Please refresh the page.');
    disableChat();
  });
}

function clearWelcomeScreen() {
  const welcomeScreen = messages.querySelector('.welcome-screen');
  if (welcomeScreen) {
    welcomeScreen.remove();
  }
}

function appendMessage(text, isOwn = false, isSystem = false) {
  clearWelcomeScreen();
  
  const container = document.createElement('div');
  
  if (isSystem) {
    container.className = 'system-message';
    container.textContent = text;
  } else {
    container.className = 'message-container';
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'sent' : 'received'}`;
    messageDiv.textContent = text;
    container.appendChild(messageDiv);
  }
  
  messages.appendChild(container);
  messages.scrollTop = messages.scrollHeight;
}

function setStatus(text) {
  status.textContent = text;
  
  // Update status dot color based on connection state
  const statusDot = document.querySelector('.status-dot');
  if (isReconnecting) {
    statusDot.style.background = '#f59e0b'; // Orange for reconnecting
  } else if (paired) {
    statusDot.style.background = '#10b981'; // Green for connected
  } else {
    statusDot.style.background = '#6b7280'; // Gray for waiting
  }
}

function enableChat() {
  input.disabled = false;
  sendBtn.disabled = false;
  input.focus();
  input.placeholder = 'Type your message...';
  nextBtn.classList.add('active');
}

function disableChat() {
  input.disabled = true;
  sendBtn.disabled = true;
  input.placeholder = 'Waiting for connection...';
  nextBtn.classList.remove('active');
  hidePartnerName();
}

function showPartnerName(name) {
  partnerName = name;
  partnerNameSpan.textContent = `Chatting with: ${name}`;
  partnerNameSpan.style.display = 'block';
}

function hidePartnerName() {
  partnerName = '';
  partnerNameSpan.style.display = 'none';
}

function showTyping() {
  typingIndicator.style.display = 'block';
  messages.scrollTop = messages.scrollHeight;
}

function hideTyping() {
  typingIndicator.style.display = 'none';
}

function showConnectionError() {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'system-message';
  errorDiv.style.color = '#ef4444';
  errorDiv.innerHTML = `
    <i class="fas fa-exclamation-triangle"></i>
    Connection lost. Attempting to reconnect...
  `;
  messages.appendChild(errorDiv);
}

function findNextPartner() {
  if (paired && socket && socket.connected) {
    // Send disconnect signal to current partner
    socket.emit('next_partner');
    
    // Update UI immediately
    paired = false;
    setStatus('Looking for a new partner...');
    disableChat();
    
    // Clear chat messages
    messages.innerHTML = '';
    
    // Show welcome screen
    const welcomeScreen = document.createElement('div');
    welcomeScreen.className = 'welcome-screen';
    welcomeScreen.innerHTML = `
      <div class="welcome-icon">
        <i class="fas fa-search"></i>
      </div>
      <div class="welcome-text">
        Looking for a new partner...<br>
        <small>This usually takes a few seconds</small>
      </div>
    `;
    messages.appendChild(welcomeScreen);
    
    // Add system message
    appendMessage('You clicked "Next" - looking for a new partner', false, true);
  }
}

// Event listeners
sendBtn.onclick = send;
nextBtn.onclick = findNextPartner;

// Name modal event listeners
nameSubmitBtn.onclick = submitName;
nameInput.onkeydown = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitName();
  }
};

input.onkeydown = (e) => { 
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
};

input.addEventListener('input', () => {
  if (paired && socket && socket.connected) {
    socket.emit('typing', true);
    
    // Clear existing timer
    if (typingTimer) {
      clearTimeout(typingTimer);
    }
    
    // Set new timer
    typingTimer = setTimeout(() => {
      socket.emit('typing', false);
    }, 1000);
  }
});

function send() {
  const msg = input.value.trim();
  if (msg && paired && socket && socket.connected) {
    appendMessage(msg, true);
    socket.emit('message', msg);
    input.value = '';
    
    // Stop typing indicator
    socket.emit('typing', false);
    if (typingTimer) {
      clearTimeout(typingTimer);
    }
  }
}

// Socket event handlers
function initializeSocketHandlers() {
  socket.on('disconnect', (reason) => {
    console.log('🔌 Disconnected:', reason);
    if (reason === 'io server disconnect') {
      // Server disconnected us, try to reconnect
      socket.connect();
    }
    setStatus('Connection lost. Reconnecting...');
    disableChat();
  });

  socket.on('status_update', (data) => {
    if (!paired && !isReconnecting) {
      const waitText = data.waiting > 0 ? ` (${data.waiting} waiting, ${data.active} active)` : '';
      const avgWait = data.averageWaitTime > 0 ? ` - Avg wait: ${data.averageWaitTime}s` : '';
      setStatus(`Looking for a partner...${waitText}${avgWait}`);
    }
  });

  socket.on('partner_found', (data) => {
    paired = true;
    setStatus('Connected!');
    enableChat();
    
    // Show partner name if provided
    if (data && data.partnerName) {
      showPartnerName(data.partnerName);
      appendMessage(`${data.partnerName} joined the chat`, false, true);
    } else {
      appendMessage('Partner connected', false, true);
    }
    
    // Add a small delay to make the connection feel more natural
    setTimeout(() => {
      if (paired) {
        appendMessage('Say hello! 👋', false, true);
      }
    }, 1000);
  });

  socket.on('message', (msg) => {
    appendMessage(msg, false);
    hideTyping();
  });

  socket.on('partner_left', () => {
    paired = false;
    setStatus('Partner disconnected. Looking for a new partner...');
    disableChat();
    appendMessage(`${partnerName || 'Partner'} disconnected`, false, true);
    
    // Show welcome screen again after a delay
    setTimeout(() => {
      if (!paired) {
        const welcomeScreen = document.createElement('div');
        welcomeScreen.className = 'welcome-screen';
        welcomeScreen.innerHTML = `
          <div class="welcome-icon">
            <i class="fas fa-user-friends"></i>
          </div>
          <div class="welcome-text">
            Looking for a new partner...<br>
            <small>This usually takes a few seconds</small>
          </div>
        `;
        messages.appendChild(welcomeScreen);
      }
    }, 2000);
  });

  socket.on('typing', () => {
    if (paired) {
      showTyping();
    }
  });

  socket.on('stop_typing', () => {
    hideTyping();
  });

  socket.on('heartbeat_ack', () => {
    // Connection is healthy
  });

  // Error handling
  socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error);
    setStatus('Connection error. Retrying...');
    showConnectionError();
  });
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  // Show name modal on page load
  showNameModal();
  
  // Add smooth scrolling
  messages.style.scrollBehavior = 'smooth';
  
  // Add input animation
  input.addEventListener('focus', () => {
    if (!input.disabled) {
      input.style.transform = 'scale(1.02)';
    }
  });
  
  input.addEventListener('blur', () => {
    input.style.transform = 'scale(1)';
  });

  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      send();
    }
    
    // Ctrl/Cmd + N for next partner
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      findNextPartner();
    }
  });

  // Add visual feedback for connection status
  const statusDot = document.querySelector('.status-dot');
  if (statusDot) {
    statusDot.style.transition = 'background-color 0.3s ease';
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  if (typingTimer) {
    clearTimeout(typingTimer);
  }
}); 