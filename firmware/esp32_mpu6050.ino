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
// Packed struct to send data efficiently (36 bytes)
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

// MPU6050 Object (Address 0x68)
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
  Serial.println("Starting BLE Work!");

  // Initialize I2C (SDA=21, SCL=22)
  Wire.begin(21, 22);

  // Initialize MPU6050
  Serial.println("Initializing MPU6050...");
  imu.initialize();

  if (imu.testConnection()) {
    Serial.println("MPU6050 connection successful");
  } else {
    Serial.println("MPU6050 connection failed");
    // Don't halt, try to continue or retry?
    // For now, we proceed but data might be zero.
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

  // Create a BLE Descriptor (needed for notifications)
  pCharacteristic->addDescriptor(new BLE2902());

  // Start the service
  pService->start();

  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(
      0x0); // set value to 0x00 to not advertise this parameter
  BLEDevice::startAdvertising();
  Serial.println("Waiting a client connection to notify...");
}

// -------------------------------------------------------------------------
// LOOP
// -------------------------------------------------------------------------
void loop() {
  // notify changed value
  if (deviceConnected) {
    int16_t ax, ay, az;
    int16_t gx, gy, gz;

    // Read Raw Data
    imu.getAcceleration(&ax, &ay, &az);
    imu.getRotation(&gx, &gy, &gz);

    // Convert to physical units (Float)
    // Default Sensitivity: Accel +/- 2g (16384 LSB/g), Gyro +/- 250 deg/s (131
    // LSB/deg/s)

    currentData.ax = ax / 16384.0;
    currentData.ay = ay / 16384.0;
    currentData.az = az / 16384.0;

    currentData.gx = gx / 131.0;
    currentData.gy = gy / 131.0;
    currentData.gz = gz / 131.0;

    // Zero out FSRs for now as we only have IMU
    for (int i = 0; i < 5; i++)
      currentData.fsr[i] = 0;
    currentData.heel = 0;

    // Set values
    pCharacteristic->setValue((uint8_t *)&currentData, sizeof(SensorData));
    pCharacteristic->notify();

    delay(20); // ~50Hz
  }

  // disconnecting
  if (!deviceConnected && oldDeviceConnected) {
    delay(500); // give the bluetooth stack the chance to get things ready
    pServer->startAdvertising(); // restart advertising
    Serial.println("start advertising");
    oldDeviceConnected = deviceConnected;
  }
  // connecting
  if (deviceConnected && !oldDeviceConnected) {
    // do stuff here on connecting
    oldDeviceConnected = deviceConnected;
  }
}
