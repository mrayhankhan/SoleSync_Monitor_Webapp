import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { parseCsvChunk } from './parser';
import { processSamples } from './analytics';
import { storeSamples, initDB, createSession, getSessions, getSessionData, getSessionSummaries, deleteSession, getSessionSamples, getDbStatus } from './store';

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

import { startSimulation, stopSimulation } from './simulator';

// ... imports

// Helper to process CSV data (reused by Socket and Simulator)
async function processRawCSV(csv: string, sessionId: string) {
    try {
        const samples = parseCsvChunk(csv, sessionId);
        const processedSamples = processSamples(samples);
        await storeSamples(samples);
        io.emit('sampleBatch', { samples: processedSamples });
    } catch (err) {
        console.error('Error processing CSV:', err);
    }
}

// WebSocket connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });

    // Handle raw CSV data from gateway
    socket.on('rawCSV', async (data: { csv: string, gatewayId: string, sessionId: string }) => {
        await processRawCSV(data.csv, data.sessionId);
    });

    // Handle Simulation Control
    socket.on('startSimulation', () => {
        console.log('Received startSimulation command');
        startSimulation((csv, gatewayId, sessionId) => {
            processRawCSV(csv, sessionId);
        });
        io.emit('simulationStatus', { running: true });
    });

    socket.on('stopSimulation', () => {
        console.log('Received stopSimulation command');
        stopSimulation();
        io.emit('simulationStatus', { running: false });
    });
});

// Start Internal Simulation if enabled (DISABLED by default now, controlled via UI)
// if (process.env.ENABLE_SIMULATION === 'true') {
//     startSimulation((csv, gatewayId, sessionId) => {
//         processRawCSV(csv, sessionId);
//     });
// }

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



app.get('/api/session/:id/data', async (req, res) => {
    const { id } = req.params;
    const samples = await getSessionData(id);
    res.json({ samples });
});

app.get('/api/sessions', async (req, res) => {
    const sessions = await getSessionSummaries();
    res.json(sessions);
});

app.delete('/api/sessions/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    await deleteSession(sessionId);
    res.sendStatus(204);
});

app.get('/api/sessions/:sessionId/samples', async (req, res) => {
    const { sessionId } = req.params;
    const { foot } = req.query;
    const samples = await getSessionSamples(sessionId, foot as string);
    res.json(samples);
});

app.get('/', (req, res) => {
    res.send('SoleSync Backend is running 🚀');
});

app.get('/health', (req, res) => {
    res.send('SoleSync Backend is running');
});

app.get('/api/status', (req, res) => {
    res.json({
        backend: true,
        dbConnected: getDbStatus()
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
