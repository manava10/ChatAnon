# 🎭 Anonymous Chat Application

A modern, real-time anonymous chat application inspired by Omegle. Connect with random strangers around the world for instant conversations!

![Chat App Demo](https://img.shields.io/badge/Status-Live-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-v14+-green)
![Socket.io](https://img.shields.io/badge/Socket.io-v4.7.5-blue)

## ✨ Features

### 🎯 Core Functionality
- **Anonymous Random Pairing**: Connect with strangers instantly
- **Real-time Messaging**: Instant message delivery with Socket.io
- **User Names**: Enter your name to personalize conversations
- **"Next" Button**: Skip to a new partner anytime
- **Typing Indicators**: See when your partner is typing
- **Connection Status**: Real-time user count and status updates

### 🎨 Modern UI/UX
- **Beautiful Design**: Modern gradient backgrounds and glass-morphism effects
- **Mobile Responsive**: Works perfectly on all devices
- **Smooth Animations**: Elegant transitions and hover effects
- **Professional Color Scheme**: Purple/blue gradient theme
- **Font Awesome Icons**: Clean, modern iconography

### 🚀 High Performance
- **Robust Algorithm**: Priority queuing system for optimal pairing
- **Automatic Cleanup**: Removes inactive users automatically
- **Memory Efficient**: Optimized data structures
- **Scalable Architecture**: Supports clustering for high capacity

## 🛠️ Tech Stack

- **Backend**: Node.js + Express
- **Real-time Communication**: Socket.io
- **Frontend**: Vanilla JavaScript + CSS3
- **Architecture**: Event-driven, real-time WebSocket connections

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/anonymous-chat-app.git
   cd anonymous-chat-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

### Standard Server (Default)
```bash
node server.js
```
- **Capacity**: 50,000+ concurrent users
- **Memory**: ~200-300MB usage
- **Best for**: Small to medium deployments

### High-Capacity Clustered Server
```bash
node cluster-server.js
```
- **Capacity**: 500,000+ concurrent users
- **Memory**: Scales with available RAM
- **Best for**: Large-scale deployments

## 📊 Server Capacity

### Memory Usage
- **Per User**: ~3-4KB memory footprint
- **64GB RAM**: Can handle 1M+ concurrent users
- **Automatic Scaling**: Clusters across CPU cores

### API Endpoints
- `/status` - Real-time server statistics
- `/debug` - Debug information and current state
- `/health` - Health check endpoint

## 🏗️ Architecture

### User Management System
- **Priority Queue**: FIFO with "Next" button priority
- **State Management**: Clean separation of waiting/chatting states
- **Automatic Cleanup**: Removes inactive users after 5 minutes
- **Connection Validation**: Ensures robust pairing

### Real-time Features
- **Message Broadcasting**: Instant message delivery
- **Typing Indicators**: Real-time typing status
- **Connection Events**: Join/leave notifications
- **Status Updates**: Live user count updates

## 🚀 Deployment

### Local Development
```bash
npm start
```

### Production Deployment
```bash
# Set environment variables
export PORT=3000
export NODE_ENV=production

# Start with PM2 (recommended)
npm install -g pm2
pm2 start server.js --name "chat-app"
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

## 🔐 Security Features

- **Input Validation**: Sanitized user inputs
- **Connection Limits**: Rate limiting and timeout protection
- **CORS Configuration**: Secure cross-origin requests
- **Graceful Shutdown**: Proper cleanup on server restart

## 🎯 Usage

1. **Enter Your Name**: Set your display name
2. **Wait for Partner**: Automatic pairing with available users
3. **Start Chatting**: Send messages in real-time
4. **Next Partner**: Click "Next" to find a new conversation partner
5. **Disconnect**: Close browser or click disconnect

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Omegle's random chat concept
- Built with modern web technologies
- Designed for scalability and performance

## 📞 Support

If you encounter any issues or have questions:
- Open an issue on GitHub
- Check the `/debug` endpoint for troubleshooting
- Review server logs for detailed information

---

**Made with ❤️ for anonymous conversations** 