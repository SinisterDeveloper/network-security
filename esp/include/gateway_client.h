#pragma once
#include <Arduino.h>

struct EncryptResult {
  String kyberCiphertextBase64;
  String ivBase64;
  String payloadCiphertextBase64;
  bool ok = false;
  String error;
  int httpCode = 0;
};

// POST encryptUrl { publicKey, plaintext } -> EncryptResult
EncryptResult gateway_encrypt(const String& publicKey, const String& plaintext, const String& encryptUrl);

// POST encryptUrl { mac, plaintext } -> EncryptResult (server resolves key by mac)
EncryptResult gateway_encryptViaMac(const String& mac, const String& plaintext, const String& encryptUrl);

// POST publicKeyUrl { mac } -> base64 publicKey or empty on 404
String gateway_fetchPublicKey(const String& mac, const String& publicKeyUrl);

struct DataResult {
  int httpCode = 0;
  String body;
  bool ok = false;
};

// POST dataUrl with X-MAC-Address / X-SRAM-Data headers + encrypted body
DataResult gateway_sendData(
  const String& dataUrl,
  const String& mac,
  const String& sramHex,
  const EncryptResult& enc,
  const String& firmwareHash = ""
);
