#pragma once
#include <Arduino.h>

// Connect to WiFi using config.h credentials. Blocks up to WIFI_CONNECT_TIMEOUT_MS.
// Returns true if WL_CONNECTED.
bool wifi_connect();

// Non-blocking check
bool wifi_isConnected();

// Helpers
String wifi_getMac();
String wifi_getIp();
void wifi_printStatus();
