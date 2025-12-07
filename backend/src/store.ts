import { Pool } from 'pg';
import { SensorSample } from './parser';

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'solesync',
    password: process.env.POSTGRES_PASSWORD || 'password',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

let isDbConnected = false;

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

            console.log('Database initialized');
            isDbConnected = true;
        } finally {
            client.release();
        }
    } catch (err) {
        console.warn('Database connection failed. Running in MOCK mode (no persistence).');
        isDbConnected = false;
    }
}

export async function storeSamples(samples: SensorSample[]) {
    if (!isDbConnected || samples.length === 0) return;

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
}

export async function getSessions() {
    if (!isDbConnected) return [];
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM sessions ORDER BY startTime DESC LIMIT 50');
        return res.rows;
    } finally {
        client.release();
    }
}

export async function getSessionData(sessionId: string) {
    if (!isDbConnected) return [];
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
}

export async function createSession(sessionId: string, userId: string = 'user1') {
    if (!isDbConnected) return;
    const client = await pool.connect();
    try {
        await client.query(
            'INSERT INTO sessions (id, userId, startTime) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO NOTHING',
            [sessionId, userId]
        );
    } finally {
        client.release();
    }
}

export async function getSessionSummaries() {
    if (!isDbConnected) return [];
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT sessionid, foot, start_time, end_time, sample_count FROM session_summaries ORDER BY start_time DESC');
        return res.rows;
    } finally {
        client.release();
    }
}

export async function deleteSession(sessionId: string) {
    if (!isDbConnected) return;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM samples WHERE sessionid = $1', [sessionId]);
        await client.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
    } finally {
        client.release();
    }
}

export async function getSessionSamples(sessionId: string, foot?: string) {
    if (!isDbConnected) return [];
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
}
