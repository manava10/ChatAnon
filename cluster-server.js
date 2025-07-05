const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const path = require('path');

if (cluster.isMaster) {
  console.log(`🚀 Master process ${process.pid} is running`);
  console.log(`💾 Available RAM: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
  console.log(`🖥️  CPU cores: ${numCPUs}`);
  
  // Fork workers for each CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Handle worker crashes
  cluster.on('exit', (worker, code, signal) => {
    console.log(`💀 Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });

  // Log cluster stats every 30 seconds
  setInterval(() => {
    const memUsage = process.memoryUsage();
    console.log(`📊 Master Stats - RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  }, 30000);

} else {
  // Worker process - run the actual server
  const app = express();
  const server = http.createServer(app);
  
  // Redis adapter for cross-worker communication
  const io = new Server(server, {
    pingTimeout: 60000,
    pingInterval: 25000,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Redis setup (optional - for scaling across multiple servers)
  /*
  const pubClient = createClient({ url: 'redis://localhost:6379' });
  const subClient = pubClient.duplicate();
  
  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log(`🔗 Worker ${process.pid} connected to Redis`);
  });
  */

  app.use(express.static(path.join(__dirname, 'public')));

  // Enhanced UserManager for high-capacity scenarios
  class HighCapacityUserManager {
    constructor() {
      this.waitingQueue = [];
      this.activeChats = new Map();
      this.userMap = new Map();
      this.userStats = {
        totalConnections: 0,
        activeChats: 0,
        waitingUsers: 0,
        totalMessages: 0,
        averageWaitTime: 0,
        nextClicks: 0,
        successfulPairings: 0,
        workerId: process.pid
      };
      this.cleanupInterval = null;
      this.startCleanup();
      this.startMemoryMonitoring();
    }

    // Memory monitoring for high-capacity scenarios
    startMemoryMonitoring() {
      setInterval(() => {
        const memUsage = process.memoryUsage();
        const memoryMB = Math.round(memUsage.rss / 1024 / 1024);
        
        // Log memory usage every 60 seconds
        if (memoryMB > 100) { // Only log if using significant memory
          console.log(`📊 Worker ${process.pid} - Memory: ${memoryMB}MB, Users: ${this.userMap.size}, Queue: ${this.waitingQueue.length}`);
        }
        
        // Alert if memory usage is high
        if (memoryMB > 8192) { // 8GB per worker
          console.warn(`⚠️  High memory usage on worker ${process.pid}: ${memoryMB}MB`);
        }
      }, 60000);
    }

    // Batch processing for high-capacity scenarios
    attemptBatchPairing() {
      const batchSize = Math.min(100, Math.floor(this.waitingQueue.length / 2));
      let pairingsAttempted = 0;
      
      while (this.waitingQueue.length >= 2 && pairingsAttempted < batchSize) {
        const user1 = this.waitingQueue.shift();
        const user2 = this.waitingQueue.shift();
        
        if (this.isValidPair(user1, user2)) {
          this.pairUsers(user1, user2);
          pairingsAttempted++;
        }
      }
      
      if (pairingsAttempted > 0) {
        console.log(`🔄 Worker ${process.pid} - Batch paired ${pairingsAttempted} pairs`);
      }
    }

    // ... (rest of the UserManager methods would be similar to the original)
    addUser(socket, name = null) {
      this.removeUserFromAllStates(socket.id);
      
      const user = {
        id: socket.id,
        socket: socket,
        name: name || 'Anonymous',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        status: 'waiting',
        workerId: process.pid
      };

      this.waitingQueue.push(user);
      this.userMap.set(socket.id, user);
      
      this.userStats.totalConnections++;
      this.userStats.waitingUsers++;
      
      // Use batch pairing for efficiency at scale
      if (this.waitingQueue.length >= 2) {
        this.attemptBatchPairing();
      }
      
      return user;
    }

    isValidPair(user1, user2) {
      return user1 && user2 && 
             user1.socket && user2.socket &&
             user1.socket.connected && user2.socket.connected &&
             user1.id !== user2.id;
    }

    pairUsers(user1, user2) {
      this.activeChats.set(user1.id, user2.id);
      this.activeChats.set(user2.id, user1.id);
      
      user1.status = 'chatting';
      user2.status = 'chatting';
      
      this.userStats.waitingUsers -= 2;
      this.userStats.activeChats++;
      this.userStats.successfulPairings++;
      
      // Notify both users
      user1.socket.emit('partner_found', { partnerName: user2.name });
      user2.socket.emit('partner_found', { partnerName: user1.name });
      
      console.log(`💑 Worker ${process.pid} - Paired ${user1.name} with ${user2.name}`);
    }

    removeUserFromAllStates(socketId) {
      const queueIndex = this.waitingQueue.findIndex(user => user.id === socketId);
      if (queueIndex !== -1) {
        this.waitingQueue.splice(queueIndex, 1);
        this.userStats.waitingUsers--;
      }

      const partnerId = this.activeChats.get(socketId);
      if (partnerId) {
        this.activeChats.delete(socketId);
        this.activeChats.delete(partnerId);
        this.userStats.activeChats--;
        
        const partner = io.sockets.sockets.get(partnerId);
        if (partner && partner.connected) {
          partner.emit('partner_left');
        }
      }

      this.userMap.delete(socketId);
    }

    startCleanup() {
      this.cleanupInterval = setInterval(() => {
        this.cleanupInactiveUsers();
      }, 30000);
    }

    cleanupInactiveUsers() {
      const now = Date.now();
      const inactiveThreshold = 5 * 60 * 1000;
      let cleanedCount = 0;

      for (const [socketId, user] of this.userMap.entries()) {
        if (now - user.lastActivity > inactiveThreshold) {
          this.removeUserFromAllStates(socketId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 Worker ${process.pid} - Cleaned ${cleanedCount} inactive users`);
      }
    }

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
  }

  const userManager = new HighCapacityUserManager();

  // Socket handling (similar to original but with worker awareness)
  io.on('connection', (socket) => {
    console.log(`🔌 Worker ${process.pid} - New connection: ${socket.id.slice(0, 8)}`);
    
    let user = null;

    socket.on('set_name', (name) => {
      if (!user) {
        user = userManager.addUser(socket, name);
      }
    });

    socket.on('message', (msg) => {
      const partnerId = userManager.activeChats.get(socket.id);
      if (partnerId) {
        const partner = io.sockets.sockets.get(partnerId);
        if (partner && partner.connected) {
          partner.emit('message', msg);
          userManager.userStats.totalMessages++;
        }
      }
    });

    socket.on('disconnect', () => {
      userManager.removeUserFromAllStates(socket.id);
    });
  });

  // Enhanced status endpoint with worker info
  app.get('/status', (req, res) => {
    res.json({
      ...userManager.getStats(),
      workerId: process.pid,
      isClustered: true
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🚀 Worker ${process.pid} running on port ${PORT}`);
  });
} 