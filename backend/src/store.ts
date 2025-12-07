import { Pool } from 'pg';
import { SensorSample } from './parser';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'solesync',
    password: process.env.POSTGRES_PASSWORD || 'password',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

let isDbConnected = false;

// Local Store Fallback
const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'local_db.json');

interface LocalDB {
    sessions: any[];
    samples: any[];
}

let localDB: LocalDB = {
    sessions: [],
    samples: []
};

function loadLocalDB() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf-8');
            localDB = JSON.parse(data);
            console.log(`Loaded ${localDB.sessions.length} sessions and ${localDB.samples.length} samples from local DB.`);
        }
    } catch (err) {
        console.error("Failed to load local DB:", err);
    }
}

function saveLocalDB() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(localDB, null, 2));
    } catch (err) {
        console.error("Failed to save local DB:", err);
    }
}

export function getDbStatus() {
    return isDbConnected;
}

export async function initDB() {
    try {
        const client = await pool.connect();
        try {
            // Create sessions table
            await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          userId TEXT,
          startTime TIMESTAMPTZ,
          endTime TIMESTAMPTZ,
          metadata JSONB
        );
      `);

            // Create samples table (hypertable)
            await client.query(`
        CREATE TABLE IF NOT EXISTS samples (
          time TIMESTAMPTZ NOT NULL,
          sessionId TEXT NOT NULL,
          deviceId TEXT NOT NULL,
          foot TEXT NOT NULL,
          accelX DOUBLE PRECISION,
          accelY DOUBLE PRECISION,
          accelZ DOUBLE PRECISION,
          gyroX DOUBLE PRECISION,
          gyroY DOUBLE PRECISION,
          gyroZ DOUBLE PRECISION,
          fsr1 DOUBLE PRECISION,
          fsr2 DOUBLE PRECISION,
          fsr3 DOUBLE PRECISION,
          fsr4 DOUBLE PRECISION,
          fsr5 DOUBLE PRECISION,
          heelRaw DOUBLE PRECISION,
          voltage DOUBLE PRECISION,
          temperature DOUBLE PRECISION
        );
      `);

            // Create session summaries view
            await client.query(`
        CREATE OR REPLACE VIEW session_summaries AS
        SELECT
          sessionid,
          foot,
          MIN(time) AS start_time,
          MAX(time) AS end_time,
          COUNT(*) AS sample_count
        FROM samples
        GROUP BY sessionid, foot;
      `);

            try {
                await client.query("SELECT create_hypertable('samples', 'time', if_not_exists => TRUE);");
            } catch (err) {
                console.log('Hypertable creation skipped.');
            }

            console.log('Database initialized (PostgreSQL)');
            isDbConnected = true;
        } finally {
            client.release();
        }
    } catch (err) {
        console.warn('Database connection failed. Switching to LOCAL FILE STORE mode.');
        isDbConnected = false;
        loadLocalDB();
    }
}

export async function storeSamples(samples: SensorSample[]) {
    if (samples.length === 0) return;

    if (isDbConnected) {
        const client = await pool.connect();
        try {
            const query = `
      INSERT INTO samples (
        time, sessionId, deviceId, foot, 
        accelX, accelY, accelZ, 
        gyroX, gyroY, gyroZ, 
        fsr1, fsr2, fsr3, fsr4, fsr5, 
        heelRaw, voltage, temperature
      ) VALUES 
    ` + samples.map((_, i) => `($${i * 18 + 1}, $${i * 18 + 2}, $${i * 18 + 3}, $${i * 18 + 4}, $${i * 18 + 5}, $${i * 18 + 6}, $${i * 18 + 7}, $${i * 18 + 8}, $${i * 18 + 9}, $${i * 18 + 10}, $${i * 18 + 11}, $${i * 18 + 12}, $${i * 18 + 13}, $${i * 18 + 14}, $${i * 18 + 15}, $${i * 18 + 16}, $${i * 18 + 17}, $${i * 18 + 18})`).join(',');

            const values = samples.flatMap(s => [
                new Date(s.timestamp), s.sessionId, s.deviceId, s.foot,
                s.accel.x, s.accel.y, s.accel.z,
                s.gyro.x, s.gyro.y, s.gyro.z,
                s.fsr[0], s.fsr[1], s.fsr[2], s.fsr[3], s.fsr[4],
                s.heelRaw, s.voltage, s.temperature
            ]);

            await client.query(query, values);
        } catch (err) {
            console.error('Error storing samples:', err);
        } finally {
            client.release();
        }
    } else {
        // Local Store
        const newSamples = samples.map(s => ({
            time: new Date(s.timestamp).toISOString(),
            sessionId: s.sessionId,
            deviceId: s.deviceId,
            foot: s.foot,
            accelX: s.accel.x, accelY: s.accel.y, accelZ: s.accel.z,
            gyroX: s.gyro.x, gyroY: s.gyro.y, gyroZ: s.gyro.z,
            fsr1: s.fsr[0], fsr2: s.fsr[1], fsr3: s.fsr[2], fsr4: s.fsr[3], fsr5: s.fsr[4],
            heelRaw: s.heelRaw,
            voltage: s.voltage,
            temperature: s.temperature
        }));
        localDB.samples.push(...newSamples);
        // Throttle save? For now, save every 50 samples to avoid disk thrashing
        if (localDB.samples.length % 50 === 0) saveLocalDB();
    }
}

export async function getSessions() {
    if (isDbConnected) {
        const client = await pool.connect();
        try {
            const res = await client.query('SELECT * FROM sessions ORDER BY startTime DESC LIMIT 50');
            return res.rows;
        } finally {
            client.release();
        }
    } else {
        return localDB.sessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }
}

export async function getSessionData(sessionId: string) {
    if (isDbConnected) {
        const client = await pool.connect();
        try {
            const res = await client.query('SELECT * FROM samples WHERE sessionId = $1 ORDER BY time ASC', [sessionId]);
            return res.rows.map(row => ({
                ...row,
                timestamp: new Date(row.time).getTime(),
                accel: { x: row.accelx, y: row.accely, z: row.accelz },
                gyro: { x: row.gyrox, y: row.gyroy, z: row.gyroz },
                fsr: [row.fsr1, row.fsr2, row.fsr3, row.fsr4, row.fsr5],
                heelRaw: row.heelraw
            }));
        } finally {
            client.release();
        }
    } else {
        const samples = localDB.samples.filter(s => s.sessionId === sessionId).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        return samples.map(row => ({
            ...row,
            timestamp: new Date(row.time).getTime(),
            accel: { x: row.accelX, y: row.accelY, z: row.accelZ },
            gyro: { x: row.gyroX, y: row.gyroY, z: row.gyroZ },
            fsr: [row.fsr1, row.fsr2, row.fsr3, row.fsr4, row.fsr5],
            heelRaw: row.heelRaw
        }));
    }
}

export async function createSession(sessionId: string, userId: string = 'user1') {
    if (isDbConnected) {
        const client = await pool.connect();
        try {
            await client.query(
                'INSERT INTO sessions (id, userId, startTime) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO NOTHING',
                [sessionId, userId]
            );
        } finally {
            client.release();
        }
    } else {
        if (!localDB.sessions.find(s => s.id === sessionId)) {
            localDB.sessions.push({
                id: sessionId,
                userId,
                startTime: new Date().toISOString(),
                endTime: null,
                metadata: {}
            });
            saveLocalDB();
        }
    }
}

export async function getSessionSummaries() {
    if (isDbConnected) {
        const client = await pool.connect();
        try {
            const res = await client.query('SELECT sessionid, foot, start_time, end_time, sample_count FROM session_summaries ORDER BY start_time DESC');
            return res.rows;
        } finally {
            client.release();
        }
    } else {
        // Aggregate from localDB.samples
        const summaries: any[] = [];
        const sessionIds = Array.from(new Set(localDB.samples.map(s => s.sessionId)));

        sessionIds.forEach(sid => {
            const sSamples = localDB.samples.filter(s => s.sessionId === sid);
            const feet = Array.from(new Set(sSamples.map(s => s.foot)));

            feet.forEach(foot => {
                const fSamples = sSamples.filter(s => s.foot === foot);
                if (fSamples.length > 0) {
                    const sorted = fSamples.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
                    summaries.push({
                        sessionid: sid,
                        foot: foot,
                        start_time: sorted[0].time,
                        end_time: sorted[sorted.length - 1].time,
                        sample_count: fSamples.length
                    });
                }
            });
        });
        return summaries.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    }
}

export async function deleteSession(sessionId: string) {
    if (isDbConnected) {
        const client = await pool.connect();
        try {
            await client.query('DELETE FROM samples WHERE sessionid = $1', [sessionId]);
            await client.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
        } finally {
            client.release();
        }
    } else {
        localDB.samples = localDB.samples.filter(s => s.sessionId !== sessionId);
        localDB.sessions = localDB.sessions.filter(s => s.id !== sessionId);
        saveLocalDB();
    }
}

export async function getSessionSamples(sessionId: string, foot?: string) {
    if (isDbConnected) {
        const client = await pool.connect();
        try {
            let query = 'SELECT * FROM samples WHERE sessionid = $1';
            const params: any[] = [sessionId];

            if (foot) {
                query += ' AND foot = $2';
                params.push(foot);
            }

            query += ' ORDER BY time ASC';

            const res = await client.query(query, params);
            return res.rows.map(row => ({
                ...row,
                timestamp: new Date(row.time).getTime(),
                accel: { x: row.accelx, y: row.accely, z: row.accelz },
                gyro: { x: row.gyrox, y: row.gyroy, z: row.gyroz },
                fsr: [row.fsr1, row.fsr2, row.fsr3, row.fsr4, row.fsr5],
                heelRaw: row.heelraw
            }));
        } finally {
            client.release();
        }
    } else {
        let samples = localDB.samples.filter(s => s.sessionId === sessionId);
        if (foot) {
            samples = samples.filter(s => s.foot === foot);
        }
        samples.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        return samples.map(row => ({
            ...row,
            timestamp: new Date(row.time).getTime(),
            accel: { x: row.accelX, y: row.accelY, z: row.accelZ },
            gyro: { x: row.gyroX, y: row.gyroY, z: row.gyroZ },
            fsr: [row.fsr1, row.fsr2, row.fsr3, row.fsr4, row.fsr5],
            heelRaw: row.heelRaw
        }));
    }
}
