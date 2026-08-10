#include "wifi_utils.h"
#include "config.h"

#ifdef ESP8266
#include <ESP8266WiFi.h>
#else
#include <WiFi.h>
#endif

bool wifi_connect() {
#ifdef ESP8266
  WiFi.mode(WIFI_STA);
#else
  WiFi.mode(WIFI_STA);
#endif
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi: ");
  Serial.print(WIFI_SSID);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > WIFI_CONNECT_TIMEOUT_MS) {
      Serial.println("\nWiFi connect timeout!");
      return false;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
  wifi_printStatus();
  return true;
}

bool wifi_isConnected() {
  return WiFi.status() == WL_CONNECTED;
}

String wifi_getMac() {
  return WiFi.macAddress();
}

String wifi_getIp() {
  return WiFi.localIP().toString();
}

void wifi_printStatus() {
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("MAC: ");
  Serial.println(WiFi.macAddress());
}
