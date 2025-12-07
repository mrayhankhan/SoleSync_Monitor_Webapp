#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <MPU6050.h>
#include <Wire.h>

// -------------------------------------------------------------------------
// CONFIGURATION
// -------------------------------------------------------------------------
// Set to true for Right Insole, false for Left Insole
bool isRightInsole = true;

// BLE UUIDs
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// -------------------------------------------------------------------------
// DATA STRUCTURES
// -------------------------------------------------------------------------
// Must match the webapp's expected structure
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

// -------------------------------------------------------------------------
// SETUP
// -------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Serial.println("Starting BLE Work (IMU Only)!");

  // Initialize I2C
  Wire.begin(21, 22);

  // Initialize MPU6050
  Serial.println("Initializing MPU6050...");
  imu.initialize();

  // Explicitly set ranges
  imu.setFullScaleGyroRange(MPU6050_GYRO_FS_250);
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
  pAdvertising->setMinPreferred(0x06);
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

  // Read IMU data
  imu.getAcceleration(&ax, &ay, &az);
  imu.getRotation(&gx, &gy, &gz);

  // Debug Print
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
  Serial.println(gz);

  // Only send via BLE if connected
  if (deviceConnected) {
    // Convert to physical units (Float)
    currentData.ax = ax / 16384.0;
    currentData.ay = ay / 16384.0;
    currentData.az = az / 16384.0;

    currentData.gx = gx / 131.0;
    currentData.gy = gy / 131.0;
    currentData.gz = gz / 131.0;

    // Zero out FSRs for webapp compatibility
    for (int i = 0; i < 5; i++) {
      currentData.fsr[i] = 0;
    }
    currentData.heel = 0;

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

  delay(20); // Run at ~50Hz
}
