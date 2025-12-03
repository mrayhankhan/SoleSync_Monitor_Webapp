import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { parseCsvChunk } from './parser';
import { processSamples } from './analytics';
import { storeSamples, initDB, createSession, getSessions, getSessionData } from './store';

dotenv.config();

// Initialize DB
initDB();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// WebSocket connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });

    // Handle raw CSV data from gateway
    socket.on('rawCSV', async (data: { csv: string, gatewayId: string, sessionId: string }) => {
        try {
            const samples = parseCsvChunk(data.csv, data.sessionId);

            // Process samples (AHRS, Steps)
            const processedSamples = processSamples(samples);

            // Store samples (raw + processed info if schema supports, or just raw for now)
            // For MVP, we store raw samples. If we want to store processed, we need to update schema.
            // Let's store raw samples as per plan.
            await storeSamples(samples);

            // Broadcast processed samples to frontend
            io.emit('sampleBatch', { samples: processedSamples });
        } catch (err) {
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
    await createSession(sessionId);
    res.status(201).json({ message: 'Session started' });
});

app.get('/api/sessions', async (req, res) => {
    const sessions = await getSessions();
    res.json(sessions);
});

app.get('/api/session/:id/data', async (req, res) => {
    const { id } = req.params;
    const samples = await getSessionData(id);
    res.json({ samples });
});

app.get('/health', (req, res) => {
    res.send('SoleSync Backend is running');
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
