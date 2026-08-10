#include "gateway_client.h"
#include "config.h"
#include <ArduinoJson.h>

#ifdef ESP8266
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#else
#include <WiFi.h>
#include <HTTPClient.h>
#endif

// Internal helper to build HTTP client with timeout
static void http_setTimeout(HTTPClient& http) {
  http.setTimeout(HTTP_TIMEOUT_MS);
#ifdef ESP8266
  http.setReuse(false);
#endif
}

EncryptResult gateway_encrypt(const String& publicKey, const String& plaintext, const String& encryptUrl) {
  EncryptResult res;

#ifdef ESP8266
  WiFiClient client;
  HTTPClient http;
  if (!http.begin(client, encryptUrl)) {
    res.error = "http.begin failed";
    return res;
  }
#else
  HTTPClient http;
  if (!http.begin(encryptUrl)) {
    res.error = "http.begin failed";
    return res;
  }
#endif
  http_setTimeout(http);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<512> encDoc;
  encDoc["publicKey"] = publicKey;
  encDoc["plaintext"] = plaintext;

  String body;
  serializeJson(encDoc, body);

  int code = http.POST(body);
  res.httpCode = code;
  if (code == 200) {
    String payload = http.getString();
    StaticJsonDocument<4096> resp;
    DeserializationError err = deserializeJson(resp, payload);
    if (err) {
      res.error = String("JSON parse: ") + err.c_str();
    } else {
      res.kyberCiphertextBase64 = resp["kyberCiphertextBase64"].as<String>();
      res.ivBase64 = resp["ivBase64"].as<String>();
      res.payloadCiphertextBase64 = resp["payloadCiphertextBase64"].as<String>();
      res.ok = res.kyberCiphertextBase64.length() > 0 && res.payloadCiphertextBase64.length() > 0;
      if (!res.ok) res.error = "missing ciphertext fields";
    }
  } else {
    res.error = http.getString();
    if (res.error.length() == 0) res.error = "encrypt HTTP " + String(code);
  }
  http.end();
  return res;
}

EncryptResult gateway_encryptViaMac(const String& mac, const String& plaintext, const String& encryptUrl) {
  EncryptResult res;
#ifdef ESP8266
  WiFiClient client;
  HTTPClient http;
  if (!http.begin(client, encryptUrl)) { res.error = "http.begin failed"; return res; }
#else
  HTTPClient http;
  if (!http.begin(encryptUrl)) { res.error = "http.begin failed"; return res; }
#endif
  http_setTimeout(http);
  http.addHeader("Content-Type", "application/json");
  StaticJsonDocument<512> doc;
  doc["mac"] = mac;
  doc["plaintext"] = plaintext;
  String body; serializeJson(doc, body);
  int code = http.POST(body);
  res.httpCode = code;
  String payload = http.getString();
  if (code == 200) {
    StaticJsonDocument<4096> resp;
    DeserializationError err = deserializeJson(resp, payload);
    if (err) res.error = String("JSON parse: ") + err.c_str();
    else {
      res.kyberCiphertextBase64 = resp["kyberCiphertextBase64"].as<String>();
      res.ivBase64 = resp["ivBase64"].as<String>();
      res.payloadCiphertextBase64 = resp["payloadCiphertextBase64"].as<String>();
      res.ok = res.kyberCiphertextBase64.length() > 0 && res.payloadCiphertextBase64.length() > 0;
      if (!res.ok) res.error = "missing ciphertext fields";
    }
  } else {
    res.error = payload;
    if (res.error.length()==0) res.error = "encryptViaMac HTTP " + String(code);
  }
  http.end();
  return res;
}

String gateway_fetchPublicKey(const String& mac, const String& publicKeyUrl) {
#ifdef ESP8266
  WiFiClient client;
  HTTPClient http;
  if (!http.begin(client, publicKeyUrl)) return "";
#else
  HTTPClient http;
  if (!http.begin(publicKeyUrl)) return "";
#endif
  http_setTimeout(http);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["mac"] = mac;
  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code == 200) {
    String payload = http.getString();
    StaticJsonDocument<2048> resp;
    if (!deserializeJson(resp, payload)) {
      String pk = resp["publicKey"].as<String>();
      http.end();
      return pk;
    }
  }
  http.end();
  return "";
}

DataResult gateway_sendData(const String& dataUrl, const String& mac, const String& sramHex, const EncryptResult& enc, const String& firmwareHash) {
  DataResult res;

#ifdef ESP8266
  WiFiClient client;
  HTTPClient http;
  if (!http.begin(client, dataUrl)) {
    res.body = "http.begin failed";
    return res;
  }
#else
  HTTPClient http;
  if (!http.begin(dataUrl)) {
    res.body = "http.begin failed";
    return res;
  }
#endif
  http_setTimeout(http);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-MAC-Address", mac);
  http.addHeader("X-SRAM-Data", sramHex);
  if (firmwareHash.length() > 0) http.addHeader("X-Firmware-Hash", firmwareHash);

  StaticJsonDocument<2048> dataDoc;
  dataDoc["kyberCiphertextBase64"] = enc.kyberCiphertextBase64;
  dataDoc["ivBase64"] = enc.ivBase64;
  dataDoc["payloadCiphertextBase64"] = enc.payloadCiphertextBase64;
#ifdef ESP8266
  extern "C" { uint32_t os_random(void); }
  dataDoc["text"] = String(os_random());
#else
  dataDoc["text"] = String(esp_random());
#endif

  String payload;
  serializeJson(dataDoc, payload);

  int code = http.POST(payload);
  res.httpCode = code;
  res.body = http.getString();
  res.ok = (code >= 200 && code < 300);
  http.end();
  return res;
}
