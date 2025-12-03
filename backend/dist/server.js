"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const parser_1 = require("./parser");
const analytics_1 = require("./analytics");
const store_1 = require("./store");
dotenv_1.default.config();
// Initialize DB
(0, store_1.initDB)();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const PORT = process.env.PORT || 3000;
// WebSocket connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
    // Handle raw CSV data from gateway
    socket.on('rawCSV', async (data) => {
        try {
            const samples = (0, parser_1.parseCsvChunk)(data.csv, data.sessionId);
            // Process samples (AHRS, Steps)
            const processedSamples = (0, analytics_1.processSamples)(samples);
            // Store samples (raw + processed info if schema supports, or just raw for now)
            // For MVP, we store raw samples. If we want to store processed, we need to update schema.
            // Let's store raw samples as per plan.
            await (0, store_1.storeSamples)(samples);
            // Broadcast processed samples to frontend
            io.emit('sampleBatch', { samples: processedSamples });
        }
        catch (err) {
            console.error('Error processing CSV:', err);
        }
    });
});
// REST API
app.post('/api/session/start', async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
        res.status(400).send('Missing sessionId');
        return;
    }
    await (0, store_1.createSession)(sessionId);
    res.status(201).json({ message: 'Session started' });
});
app.get('/api/sessions', async (req, res) => {
    const sessions = await (0, store_1.getSessions)();
    res.json(sessions);
});
app.get('/api/session/:id/data', async (req, res) => {
    const { id } = req.params;
    const samples = await (0, store_1.getSessionData)(id);
    res.json({ samples });
});
app.get('/health', (req, res) => {
    res.send('SoleSync Backend is running');
});
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
