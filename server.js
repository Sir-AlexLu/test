const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const si = require('systeminformation');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Global variables for tracking
let connectedUsers = 0;
let totalRequests = 0;
let requestsPerSecond = 0;
let requestTimestamps = [];
let serverStats = {
  cpu: 0,
  memory: {
    total: 0,
    used: 0,
    free: 0,
    percentage: 0
  },
  uptime: 0
};

// Clean up old timestamps (older than 1 second)
setInterval(() => {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(timestamp => now - timestamp < 1000);
  requestsPerSecond = requestTimestamps.length;
}, 100);

// Update server stats every 2 seconds
setInterval(async () => {
  try {
    const cpuData = await si.currentLoad();
    const memData = await si.mem();
    
    serverStats = {
      cpu: cpuData.currentLoad.toFixed(2),
      memory: {
        total: Math.round(memData.total / 1024 / 1024),
        used: Math.round(memData.used / 1024 / 1024),
        free: Math.round(memData.free / 1024 / 1024),
        percentage: ((memData.used / memData.total) * 100).toFixed(2)
      },
      uptime: process.uptime()
    };
  } catch (error) {
    console.error('Error fetching system stats:', error);
  }
}, 2000);

// API Routes
app.get('/api/stats', (req, res) => {
  totalRequests++;
  requestTimestamps.push(Date.now());
  
  res.json({
    connectedUsers,
    totalRequests,
    requestsPerSecond,
    serverStats
  });
});

app.get('/api/load-test', (req, res) => {
  totalRequests++;
  requestTimestamps.push(Date.now());
  
  // Simulate some processing time
  const processingTime = Math.random() * 100; // 0-100ms
  setTimeout(() => {
    res.json({
      message: 'Load test response',
      processingTime: processingTime.toFixed(2),
      timestamp: new Date().toISOString()
    });
  }, processingTime);
});

app.post('/api/heavy-load', (req, res) => {
  totalRequests++;
  requestTimestamps.push(Date.now());
  
  // Simulate heavier processing
  const processingTime = Math.random() * 500; // 0-500ms
  const iterations = Math.floor(Math.random() * 1000000);
  
  // CPU intensive task
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.random();
  }
  
  setTimeout(() => {
    res.json({
      message: 'Heavy load test response',
      processingTime: processingTime.toFixed(2),
      iterations,
      result: result.toFixed(2),
      timestamp: new Date().toISOString()
    });
  }, processingTime);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  connectedUsers++;
  console.log(`User connected. Total users: ${connectedUsers}`);
  
  // Send current stats to the newly connected client
  socket.emit('stats-update', {
    connectedUsers,
    totalRequests,
    requestsPerSecond,
    serverStats
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    connectedUsers--;
    console.log(`User disconnected. Total users: ${connectedUsers}`);
  });
  
  // Handle ping requests
  socket.on('ping', () => {
    totalRequests++;
    requestTimestamps.push(Date.now());
    socket.emit('pong', { timestamp: Date.now() });
  });
});

// Broadcast stats updates to all connected clients every second
setInterval(() => {
  io.emit('stats-update', {
    connectedUsers,
    totalRequests,
    requestsPerSecond,
    serverStats
  });
}, 1000);

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
