const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// Robust user management system with clear-cut logic
class UserManager {
  constructor() {
    this.waitingQueue = []; // Array of user objects for FIFO ordering
    this.activeChats = new Map(); // socket.id -> partner socket.id
    this.userMap = new Map(); // socket.id -> user object for quick lookups
    this.userStats = {
      totalConnections: 0,
      activeChats: 0,
      waitingUsers: 0,
      totalMessages: 0,
      averageWaitTime: 0,
      nextClicks: 0,
      successfulPairings: 0
    };
    this.cleanupInterval = null;
    this.startCleanup();
  }

  // Add user to waiting queue
  addUser(socket, name = null) {
    // Remove user from any existing state first
    this.removeUserFromAllStates(socket.id);
    
    const user = {
      id: socket.id,
      socket: socket,
      name: name || 'Anonymous',
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      status: 'waiting'
    };

    // Add to waiting queue (FIFO)
    this.waitingQueue.push(user);
    this.userMap.set(socket.id, user);
    
    this.userStats.totalConnections++;
    this.userStats.waitingUsers++;
    
    console.log(`👤 User ${user.name} (${socket.id.slice(0, 8)}) added to queue. Queue size: ${this.waitingQueue.length}`);
    
    // Try to pair immediately
    this.attemptPairing();
    
    return user;
  }

  // Set user name
  setUserName(socketId, name) {
    const user = this.userMap.get(socketId);
    if (user) {
      user.name = name || 'Anonymous';
      console.log(`📝 User ${socketId.slice(0, 8)} set name to: ${user.name}`);
    }
  }

  // Remove user from all states (queue, active chats, user map)
  removeUserFromAllStates(socketId) {
    // Remove from waiting queue
    const queueIndex = this.waitingQueue.findIndex(user => user.id === socketId);
    if (queueIndex !== -1) {
      this.waitingQueue.splice(queueIndex, 1);
      this.userStats.waitingUsers--;
      console.log(`❌ User ${socketId.slice(0, 8)} removed from queue`);
    }

    // Remove from active chats
    const partnerId = this.activeChats.get(socketId);
    if (partnerId) {
      this.activeChats.delete(socketId);
      this.activeChats.delete(partnerId);
      this.userStats.activeChats--;
      console.log(`💔 Chat ended between ${socketId.slice(0, 8)} and ${partnerId.slice(0, 8)}`);
      
      // Notify partner
      const partner = io.sockets.sockets.get(partnerId);
      if (partner && partner.connected) {
        partner.emit('partner_left');
      }
    }

    // Remove from user map
    this.userMap.delete(socketId);
  }

  // Handle "Next" button click
  handleNextPartner(socketId) {
    console.log(`⏭️ User ${socketId.slice(0, 8)} clicked "Next"`);
    this.userStats.nextClicks++;
    
    const user = this.userMap.get(socketId);
    if (!user) {
      console.log(`⚠️ User ${socketId.slice(0, 8)} not found in user map`);
      return;
    }

    // Get current partner
    const partnerId = this.activeChats.get(socketId);
    if (partnerId) {
      console.log(`🔄 Ending chat between ${socketId.slice(0, 8)} and ${partnerId.slice(0, 8)}`);
      
      // Remove both from active chats
      this.activeChats.delete(socketId);
      this.activeChats.delete(partnerId);
      this.userStats.activeChats--;
      
      // Re-queue the current user FIRST (priority)
      this.reQueueUser(socketId);
      
      // Then notify partner and re-queue them
      const partner = io.sockets.sockets.get(partnerId);
      if (partner && partner.connected) {
        partner.emit('partner_left', 'Partner clicked "Next"');
        // Re-queue the partner (goes to back of queue)
        this.reQueueUserToBack(partnerId);
      }
    } else {
      // User not in active chat, just re-queue them
      this.reQueueUser(socketId);
    }
  }

  // Re-queue a user to the front (priority for "Next" button users)
  reQueueUser(socketId) {
    const user = this.userMap.get(socketId);
    if (user && user.socket.connected) {
      // Reset user state
      user.status = 'waiting';
      user.connectedAt = Date.now();
      user.lastActivity = Date.now();
      
      // Add to front of queue for immediate pairing
      this.waitingQueue.unshift(user);
      this.userStats.waitingUsers++;
      
      console.log(`🔄 User ${socketId.slice(0, 8)} re-queued with priority. Queue size: ${this.waitingQueue.length}`);
      
      // Try to pair immediately
      this.attemptPairing();
    }
  }

  // Re-queue a user to the back (normal queuing for disconnected partners)
  reQueueUserToBack(socketId) {
    const user = this.userMap.get(socketId);
    if (user && user.socket.connected) {
      // Reset user state
      user.status = 'waiting';
      user.connectedAt = Date.now();
      user.lastActivity = Date.now();
      
      // Add to back of queue (normal FIFO)
      this.waitingQueue.push(user);
      this.userStats.waitingUsers++;
      
      console.log(`🔄 User ${socketId.slice(0, 8)} re-queued normally. Queue size: ${this.waitingQueue.length}`);
      
      // Try to pair immediately
      this.attemptPairing();
    }
  }

  // Robust pairing algorithm
  attemptPairing() {
    console.log(`🔍 Attempting to pair. Queue size: ${this.waitingQueue.length}`);
    
    // Clean up disconnected users first
    this.cleanupDisconnectedUsers();
    
    // Try to pair users
    while (this.waitingQueue.length >= 2) {
      const user1 = this.waitingQueue.shift();
      const user2 = this.waitingQueue.shift();
      
      // Validate both users are still connected
      if (this.isValidPair(user1, user2)) {
        this.pairUsers(user1, user2);
      } else {
        console.log(`⚠️ Invalid pair detected, skipping`);
        // Re-queue valid users
        if (this.isValidUser(user1)) {
          this.waitingQueue.unshift(user1);
        }
        if (this.isValidUser(user2)) {
          this.waitingQueue.unshift(user2);
        }
      }
    }
    
    // Update average wait time
    this.updateAverageWaitTime();
    
    console.log(`📊 Pairing complete. Queue: ${this.waitingQueue.length}, Active: ${this.activeChats.size / 2}`);
  }

  // Validate if a user is still valid
  isValidUser(user) {
    return user && 
           user.socket && 
           user.socket.connected && 
           this.userMap.has(user.id);
  }

  // Validate if two users can be paired
  isValidPair(user1, user2) {
    return this.isValidUser(user1) && 
           this.isValidUser(user2) && 
           user1.id !== user2.id &&
           !this.activeChats.has(user1.id) &&
           !this.activeChats.has(user2.id);
  }

  // Pair two users
  pairUsers(user1, user2) {
    // Remove from waiting queue (already done in attemptPairing)
    this.userStats.waitingUsers -= 2;
    
    // Add to active chats
    this.activeChats.set(user1.id, user2.id);
    this.activeChats.set(user2.id, user1.id);
    this.userStats.activeChats++;
    this.userStats.successfulPairings++;
    
    // Update user status
    user1.status = 'chatting';
    user2.status = 'chatting';
    
    // Notify both users with partner names
    user1.socket.emit('partner_found', { partnerName: user2.name });
    user2.socket.emit('partner_found', { partnerName: user1.name });
    
    console.log(`🤝 Successfully paired ${user1.name} (${user1.id.slice(0, 8)}) and ${user2.name} (${user2.id.slice(0, 8)})`);
  }

  // Clean up disconnected users from queue
  cleanupDisconnectedUsers() {
    const validUsers = [];
    
    for (const user of this.waitingQueue) {
      if (this.isValidUser(user)) {
        validUsers.push(user);
      } else {
        console.log(`🧹 Removing disconnected user ${user.id.slice(0, 8)} from queue`);
        this.userMap.delete(user.id);
      }
    }
    
    this.waitingQueue = validUsers;
    this.userStats.waitingUsers = this.waitingQueue.length;
  }

  // Update average wait time
  updateAverageWaitTime() {
    if (this.waitingQueue.length > 0) {
      const totalWaitTime = this.waitingQueue.reduce((sum, user) => {
        return sum + (Date.now() - user.connectedAt);
      }, 0);
      this.userStats.averageWaitTime = Math.round(totalWaitTime / this.waitingQueue.length / 1000);
    }
  }

  // Update user activity
  updateUserActivity(socketId) {
    const user = this.userMap.get(socketId);
    if (user) {
      user.lastActivity = Date.now();
    }
  }

  // Start cleanup interval
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveUsers();
    }, 30000); // Clean up every 30 seconds
  }

  // Clean up inactive users
  cleanupInactiveUsers() {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [socketId, user] of this.userMap.entries()) {
      if (now - user.lastActivity > inactiveThreshold) {
        console.log(`🧹 Cleaning up inactive user ${socketId.slice(0, 8)}`);
        this.removeUserFromAllStates(socketId);
      }
    }
  }

  // Get comprehensive stats
  getStats() {
    return {
      ...this.userStats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      queueSize: this.waitingQueue.length,
      activeChatsCount: this.activeChats.size / 2,
      totalUsers: this.userMap.size
    };
  }

  // Debug function to log current state
  debugState() {
    console.log('\n🔍 DEBUG STATE:');
    console.log(`Queue: ${this.waitingQueue.length} users`);
    console.log(`Active chats: ${this.activeChats.size / 2} pairs`);
    console.log(`Total users: ${this.userMap.size}`);
    
    if (this.waitingQueue.length > 0) {
      console.log('Queue users:', this.waitingQueue.map(u => u.id.slice(0, 8)));
    }
    
    if (this.activeChats.size > 0) {
      console.log('Active chats:', Array.from(this.activeChats.entries()).map(([id, partner]) => 
        `${id.slice(0, 8)} ↔ ${partner.slice(0, 8)}`
      ));
    }
    console.log('');
  }
}

const userManager = new UserManager();

// Socket connection handling
io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id.slice(0, 8)}`);
  
  // Don't add user to queue immediately - wait for name
  let user = null;

  // Handle name setting
  socket.on('set_name', (name) => {
    if (!user) {
      // Add user to waiting queue with name
      user = userManager.addUser(socket, name);
      
      // Send initial status
      socket.emit('status_update', {
        waiting: userManager.userStats.waitingUsers,
        active: userManager.userStats.activeChats / 2,
        averageWaitTime: userManager.userStats.averageWaitTime
      });
    } else {
      // Update existing user's name
      userManager.setUserName(socket.id, name);
    }
  });

  // Message handling
  socket.on('message', (msg) => {
    const partnerId = userManager.activeChats.get(socket.id);
    if (partnerId) {
      const partner = io.sockets.sockets.get(partnerId);
      if (partner && partner.connected) {
        partner.emit('message', msg);
        userManager.userStats.totalMessages++;
        userManager.updateUserActivity(socket.id);
      }
    }
  });

  // Typing indicators
  socket.on('typing', (isTyping) => {
    const partnerId = userManager.activeChats.get(socket.id);
    if (partnerId) {
      const partner = io.sockets.sockets.get(partnerId);
      if (partner && partner.connected) {
        partner.emit(isTyping ? 'typing' : 'stop_typing');
      }
    }
  });

  // Next partner handling
  socket.on('next_partner', () => {
    userManager.handleNextPartner(socket.id);
  });

  // Heartbeat to keep connection alive
  socket.on('heartbeat', () => {
    userManager.updateUserActivity(socket.id);
    socket.emit('heartbeat_ack');
  });

  // Disconnection handling
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Disconnection: ${socket.id.slice(0, 8)} - ${reason}`);
    userManager.removeUserFromAllStates(socket.id);
    
    // Send updated stats to remaining users
    io.emit('status_update', {
      waiting: userManager.userStats.waitingUsers,
      active: userManager.userStats.activeChats / 2,
      averageWaitTime: userManager.userStats.averageWaitTime
    });
  });

  // Error handling
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id.slice(0, 8)}:`, error);
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json(userManager.getStats());
});

// Debug endpoint
app.get('/debug', (req, res) => {
  userManager.debugState();
  res.json({ message: 'Debug state logged to console' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Status endpoint: http://localhost:${PORT}/status`);
  console.log(`🔍 Debug endpoint: http://localhost:${PORT}/debug`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...');
  if (userManager.cleanupInterval) {
    clearInterval(userManager.cleanupInterval);
  }
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}); 