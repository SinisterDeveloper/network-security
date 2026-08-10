#include "puf.h"
#include "config.h"

#ifdef ESP8266
extern "C" {
  #include <user_interface.h>
}
#include <ESP8266WiFi.h>
#else
#include <esp_system.h>
#endif

uint8_t sram_puf[SRAM_PUF_BYTES];

void puf_init() {
#ifdef ESP32
  // ESP32: hardware RNG — stable per boot, better entropy than analogRead
  for (size_t i = 0; i < SRAM_PUF_BYTES; i++) {
    // esp_random() returns 32-bit; take low byte
    sram_puf[i] = (uint8_t)(esp_random() & 0xFF);
  }
#else
  // ESP8266: analog noise + os_random()
  randomSeed(analogRead(A0) ^ (uint16_t)os_random());
  for (size_t i = 0; i < SRAM_PUF_BYTES; i++) {
    sram_puf[i] = (uint8_t)random(0, 256);
  }
#endif

#ifdef DEBUG_PUF_DUMP
  puf_dump();
#endif
}

String puf_toHex() {
  String hex;
  hex.reserve(SRAM_PUF_HEX_LEN + 1);
  char buf[3];
  for (size_t i = 0; i < SRAM_PUF_BYTES; i++) {
    sprintf(buf, "%02X", sram_puf[i]);
    hex += buf;
  }
  return hex;
}

void puf_dump() {
  delay(300);
  Serial.println();
  Serial.println("SRAM PUF Dump (" + String(SRAM_PUF_BYTES) + "B):");
  Serial.println("--------------------");
  for (size_t i = 0; i < SRAM_PUF_BYTES; i++) {
    if (i % 16 == 0) Serial.printf("\n%04X: ", (unsigned)i);
    Serial.printf("%02X ", sram_puf[i]);
  }
  Serial.println("\n\nDone.");
}

void puf_dumpHex(const String& hex) {
  Serial.println("PUF hex (" + String(hex.length()) + " chars): " + hex.substring(0, 32) + "...");
}
