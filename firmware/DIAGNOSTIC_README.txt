TROUBLESHOOTING: Serial Monitor shows only "Device Connected"

If you only see "Device Connected" and no sensor readings:

1. CHECK BAUD RATE:
   - Open Serial Monitor
   - Set baud rate to 115200 (bottom right corner)
   - Close and reopen Serial Monitor

2. CHECK LINE ENDINGS:
   - In Serial Monitor, try changing "No line ending" to "Both NL & CR"

3. VERIFY UPLOAD:
   - Make sure you uploaded the LATEST version of esp32_mpu6050.ino
   - You should see "Setup Complete. Starting Loop..." in Serial Monitor after upload
   - If you don't see this, the code didn't upload correctly

4. TEST IF LOOP IS RUNNING:
   - After "Setup Complete", you should see a continuous stream of data
   - If you don't, the ESP32 might be crashing in the loop
   - Try pressing the RESET button on the ESP32

5. RAW TEST:
   - Disconnect any wiring from pins 34, 35, 39
   - Leave only the IMU (pins 21, 22) connected
   - Upload and check if IMU data appears
   - If yes, the problem is with FSR wiring causing a crash

Expected Serial Monitor Output:
Starting BLE Work!
Initializing MPU6050...
MPU6050 connection successful
Waiting a client connection to notify...
Setup Complete. Starting Loop...
ax:123,ay:456,az:16384,gx:0,gy:0,gz:0,FSR0:0,FSR1:0,FSR2:0,FSR3:0,FSR4:0,Heel:0
ax:125,ay:453,az:16380,gx:1,gy:-1,gz:0,FSR0:15,FSR1:0,FSR2:0,FSR3:0,FSR4:0,Heel:0
... (continuous stream)
