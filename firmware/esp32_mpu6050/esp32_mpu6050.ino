#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <MPU6050.h>
#include <Wire.h>

// -------------------------------------------------------------------------
// CONFIGURATION
// -------------------------------------------------------------------------
// IMPORTANT: If you experience a boot loop (restart) after "Starting BLE
// Work!", please change your Partition Scheme in Arduino IDE: Tools > Partition
// Scheme > "Huge APP (3MB No OTA/1MB SPIFFS)"

// Set to true for Right Insole, false for Left Insole
bool isRightInsole = true;

// BLE UUIDs
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// -------------------------------------------------------------------------
// DATA STRUCTURES
// -------------------------------------------------------------------------
struct __attribute__((packed)) SensorData {
  float ax;
  float ay;
  float az;
  float gx;
  float gy;
  float gz;
  uint16_t fsr[5];
  uint16_t heel;
};

SensorData currentData;

// -------------------------------------------------------------------------
// GLOBALS
// -------------------------------------------------------------------------
BLEServer *pServer = NULL;
BLECharacteristic *pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

MPU6050 imu(0x68);

// -------------------------------------------------------------------------
// BLE CALLBACKS
// -------------------------------------------------------------------------
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    deviceConnected = true;
    Serial.println("Device Connected");
  };

  void onDisconnect(BLEServer *pServer) {
    deviceConnected = false;
    Serial.println("Device Disconnected");
  }
};

// FSR Pins
// User specified: 32, 33, 34, 35, VN (39)
const int FSR_PINS[5] = {32, 33, 34, 35, 39};
// const int HEEL_PIN = 39; // Removed as user only listed 5 pins

// -------------------------------------------------------------------------
// SETUP
// -------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Serial.println("Starting BLE Work!");

  // Initialize FSR Pins
  for (int i = 0; i < 5; i++) {
    pinMode(FSR_PINS[i], INPUT);
  }
  // pinMode(HEEL_PIN, INPUT);

  // Initialize I2C
  Wire.begin(21, 22);

  // Initialize MPU6050
  Serial.println("Initializing MPU6050...");
  imu.initialize();

  // Explicitly set ranges to match our scaling factors
  // Gyro: +/- 250 deg/s -> 131 LSB/deg/s
  imu.setFullScaleGyroRange(MPU6050_GYRO_FS_250);
  // Accel: +/- 2g -> 16384 LSB/g
  imu.setFullScaleAccelRange(MPU6050_ACCEL_FS_2);

  if (imu.testConnection()) {
    Serial.println("MPU6050 connection successful");
  } else {
    Serial.println("MPU6050 connection failed");
  }

  // Initialize BLE
  BLEDevice::init(isRightInsole ? "SoleSync Right" : "SoleSync Left");

  // Create Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // Create Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Create Characteristic
  pCharacteristic = pService->createCharacteristic(
      CHARACTERISTIC_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);

  pCharacteristic->addDescriptor(new BLE2902());

  // Start the service
  pService->start();

  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(
      0x06); // functions that help with iPhone connections issue
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("Waiting a client connection to notify...");
  Serial.println("Setup Complete. Starting Loop...");
}

// -------------------------------------------------------------------------
// LOOP
// -------------------------------------------------------------------------
void loop() {
  int16_t ax, ay, az;
  int16_t gx, gy, gz;

  // Always read sensor data
  imu.getAcceleration(&ax, &ay, &az);
  imu.getRotation(&gx, &gy, &gz);

  // Read FSRs
  // IMPORTANT: Pins 34, 35, 36, 39 are INPUT ONLY on ESP32.
  // They do NOT have internal pull-up/pull-down resistors.
  // You MUST use an external voltage divider (e.g., 10k resistor to GND) for
  // these pins. If you don't, they will float or read 0. Pins 32, 33 have
  // internal pull-ups/downs available, which might be why they work if wired
  // simply.

  uint16_t fsrValues[5];
  for (int i = 0; i < 5; i++) {
    fsrValues[i] = map(analogRead(FSR_PINS[i]), 0, 4095, 0, 1023);
  }
  // uint16_t heelValue = map(analogRead(HEEL_PIN), 0, 4095, 0, 1023);
  uint16_t heelValue = 0; // Default to 0 as we only have 5 pins

  // Debug Print (Serial Monitor & Plotter compatible)
  // Format: "Label:Value,Label:Value,..."
  // Moved OUTSIDE if(deviceConnected) so it always prints
  Serial.print("ax:");
  Serial.print(ax);
  Serial.print(",");
  Serial.print("ay:");
  Serial.print(ay);
  Serial.print(",");
  Serial.print("az:");
  Serial.print(az);
  Serial.print(",");
  Serial.print("gx:");
  Serial.print(gx);
  Serial.print(",");
  Serial.print("gy:");
  Serial.print(gy);
  Serial.print(",");
  Serial.print("gz:");
  Serial.print(gz);
  Serial.print(",");

  Serial.print("FSR0:");
  Serial.print(fsrValues[0]);
  Serial.print(",");
  Serial.print("FSR1:");
  Serial.print(fsrValues[1]);
  Serial.print(",");
  Serial.print("FSR2:");
  Serial.print(fsrValues[2]);
  Serial.print(",");
  Serial.print("FSR3:");
  Serial.print(fsrValues[3]);
  Serial.print(",");
  Serial.print("FSR4:");
  Serial.print(fsrValues[4]);
  Serial.print(",");
  Serial.print("Heel:");
  Serial.println(heelValue);

  // Only send via BLE if connected
  if (deviceConnected) {
    // Convert to physical units (Float)
    currentData.ax = ax / 16384.0;
    currentData.ay = ay / 16384.0;
    currentData.az = az / 16384.0;

    currentData.gx = gx / 131.0;
    currentData.gy = gy / 131.0;
    currentData.gz = gz / 131.0;

    // Populate FSRs
    for (int i = 0; i < 5; i++) {
      currentData.fsr[i] = fsrValues[i];
    }
    currentData.heel = heelValue;

    // Send
    pCharacteristic->setValue((uint8_t *)&currentData, sizeof(SensorData));
    pCharacteristic->notify();
  }

  // Handle Disconnect
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("start advertising");
    oldDeviceConnected = deviceConnected;
  }
  // Handle Connect
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  delay(20); // Run at ~50Hz to match frontend expectation
}
