#pragma once
#include <Arduino.h>

static const size_t SRAM_PUF_BYTES = 512;
static const size_t SRAM_PUF_HEX_LEN = SRAM_PUF_BYTES * 2; // 1024

extern uint8_t sram_puf[SRAM_PUF_BYTES];

// Generate stable PUF once at boot (pseudo-SRAM via noise).
// For ESP32: uses esp_random(); for ESP8266: analogRead(A0) + os_random().
// Result is kept in RTC memory for the boot session — not regenerated on every loop.
void puf_init();

// Hex-encoded PUF (1024 chars, uppercase)
String puf_toHex();

// Debug dump over Serial
void puf_dump();
void puf_dumpHex(const String& hex);
