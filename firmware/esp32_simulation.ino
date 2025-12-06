#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>

// -------------------------------------------------------------------------
// CONFIGURATION
// -------------------------------------------------------------------------
// IMPORTANT: If you experience a boot loop (restart) after "Starting BLE
// Work!", please change your Partition Scheme in Arduino IDE: Tools > Partition
// Scheme > "Huge APP (3MB No OTA/1MB SPIFFS)"

// Set to true for Right Insole, false for Left Insole
bool isRightInsole = false;

// BLE UUIDs - Unique IDs for the Service and Characteristic
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

// Simulation State
float t = 0.0f;
const float cycleDuration = 1.2f; // seconds per step

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
// SIMULATION LOGIC
// -------------------------------------------------------------------------
void updateSimulation() {
  // Time step
  t += 0.05; // 50ms

  // Phase calculation
  float timeOffset = isRightInsole ? cycleDuration / 2.0f : 0.0f;
  float localT = fmod(t + timeOffset, cycleDuration);
  float phase = localT / cycleDuration; // 0.0 to 1.0

  // Reset values
  currentData.ax = 0;
  currentData.ay = 0;
  currentData.az = 9.81;
  currentData.gx = 0;
  currentData.gy = 0;
  currentData.gz = 0;
  for (int i = 0; i < 5; i++)
    currentData.fsr[i] = 0;
  currentData.heel = 0;

  // Gait Simulation
  if (phase < 0.2) {
    // Heel Strike
    currentData.ax = 9.81 * sin(20 * PI / 180);
    currentData.az = 9.81 * cos(20 * PI / 180);
    currentData.heel = 900;
  } else if (phase < 0.5) {
    // Mid-Stance
    currentData.ax = 0;
    currentData.az = 9.81;
    currentData.heel = 200;
    currentData.fsr[3] = 600;
    currentData.fsr[4] = 600;
    currentData.fsr[2] = 300;
  } else if (phase < 0.7) {
    // Toe-Off
    currentData.ax = 9.81 * sin(-30 * PI / 180);
    currentData.az = 9.81 * cos(-30 * PI / 180);
    currentData.heel = 0;
    currentData.fsr[0] = 900;
    currentData.fsr[1] = 800;
    currentData.fsr[2] = 800;
    currentData.fsr[3] = 100;
    currentData.fsr[4] = 100;
  } else {
    // Swing
    currentData.ax = 5.0;
    currentData.az = 9.81;
    currentData.heel = 0;
  }
}

// -------------------------------------------------------------------------
// LOOP
// -------------------------------------------------------------------------
void loop() {
  // notify changed value
  if (deviceConnected) {
    updateSimulation();

    // Set values
    pCharacteristic->setValue((uint8_t *)&currentData, sizeof(SensorData));
    pCharacteristic->notify();

    delay(50); // 20Hz
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
