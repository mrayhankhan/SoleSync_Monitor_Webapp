# SoleSync Monitor Webapp

SoleSync is a real-time smart insole monitoring application that visualizes pressure distribution and motion data from connected insoles. It supports both simulated data via a backend server and direct Bluetooth Low Energy (BLE) connection from ESP32-based insoles.

## Features

*   **Real-time Visualization:**
    *   **Pressure Heatmap:** Visualizes force distribution across the foot (5 FSR sensors + Heel).
    *   **3D Motion Tracking:** Shows the orientation of the foot using a 3D shoe model (IMU data).
*   **Dual Connectivity Modes:**
    *   **Backend Simulation:** Connects to a Node.js backend via Socket.IO for simulated data streams.
    *   **Direct BLE Connection:** Connects directly to ESP32 microcontrollers via Web Bluetooth for live sensor data.
*   **Multi-Foot Support:** Monitors both Left and Right feet simultaneously.
*   **Responsive Dashboard:** Clean, dark-mode UI built with React and Tailwind CSS.

## Project Structure

*   `frontend/`: React application (Vite + TypeScript).
*   `backend/`: Node.js server (Express + Socket.IO) for data simulation and aggregation.
*   `firmware/`: Arduino/C++ code for ESP32 insoles.

## Getting Started

### Prerequisites

*   Node.js (v16+)
*   npm or yarn
*   ESP32 Development Board (for BLE mode)

### 1. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The application will start at `http://localhost:5173`.

### 2. Backend Setup (Optional - for Simulation)

```bash
cd backend
npm install
npm run dev
```

The backend server runs on port 3000. The frontend will automatically connect to it.

### 3. Firmware Setup (For BLE Mode)

1.  Navigate to the `firmware/` directory.
2.  Open `esp32_simulation.ino` in the Arduino IDE.
3.  Select your ESP32 board type.
4.  **Configuration:**
    *   Set `bool isRightInsole = false;` for the Left Insole.
    *   Set `bool isRightInsole = true;` for the Right Insole.
5.  Upload the code to your ESP32.

## Using BLE Connection

1.  Open the web application in a BLE-supported browser (Chrome, Edge).
2.  Power on your ESP32 insole.
3.  On the dashboard, click the **Connect BLE** button for the respective foot.
4.  Select **"SoleSync Left"** or **"SoleSync Right"** from the pairing dialog.
5.  Once connected, live data from the ESP32 will override the backend simulation.

## Technologies Used

*   **Frontend:** React, Vite, Tailwind CSS, Three.js (@react-three/fiber), Socket.IO Client
*   **Backend:** Node.js, Express, Socket.IO
*   **Firmware:** Arduino (C++) for ESP32

## Troubleshooting

### Web Bluetooth on Brave Browser
If you are using the Brave browser and see a "Web Bluetooth API globally disabled" error:
1.  Open a new tab and go to `brave://flags`.
2.  Search for **"Web Bluetooth"**.
3.  Change the setting from **Default** (or Disabled) to **Enabled**.
4.  Relaunch Brave.
