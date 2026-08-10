#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"
#include "puf.h"
#include "wifi_utils.h"
#include "gateway_client.h"

// Resolved URLs at runtime
static String dataUrl;
static String encryptUrl;
static String publicKeyUrl;
static String cachedPublicKey;

static void buildUrls() {
  char buf[160];
  snprintf(buf, sizeof(buf), "http://%s:%d%s", GATEWAY_HOST, GATEWAY_PORT, GATEWAY_DATA_PATH);
  dataUrl = String(buf);
  snprintf(buf, sizeof(buf), "http://%s:%d%s", GATEWAY_HOST, GATEWAY_PORT, GATEWAY_ENCRYPT_PATH);
  encryptUrl = String(buf);
  // publicKey fetch via gateway -> forwarded to server's /client/publicKey
  // Gateway does not proxy /publicKey, so we hit server directly if needed
  snprintf(buf, sizeof(buf), "http://%s:%d/client/publicKey", SERVER_HOST, SERVER_PORT);
  publicKeyUrl = String(buf);
  // Also try gateway-host publicKey endpoint if server is same as gateway
  // ESP will first try HARDCODED_PUBLIC_KEY, then fetch via publicKeyUrl
}

static String resolvePublicKey(const String& mac) {
  // 1. Hardcoded wins (offline / stale demo)
  if (strlen(HARDCODED_PUBLIC_KEY) > 32) {
    return String(HARDCODED_PUBLIC_KEY);
  }
  // 2. Cache after first fetch
  if (cachedPublicKey.length() > 32) return cachedPublicKey;

  Serial.println(">> No hardcoded key, fetching via " + publicKeyUrl);
  String fetched = gateway_fetchPublicKey(mac, publicKeyUrl);
  if (fetched.length() > 32) {
    cachedPublicKey = fetched;
    Serial.println("Fetched publicKey (" + String(fetched.length()) + " chars)");
    return fetched;
  }
  // 3. Try gateway encrypt shim with mac-based lookup as fallback (server encrypt can resolve by mac)
  // In that case we can pass empty publicKey and let server resolve by mac — handled in loop
  Serial.println("PublicKey fetch failed (device not registered yet?)");
  return "";
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== EmbSec ESP (Phase 3) ===");
#ifdef ESP8266
  Serial.println("Board: ESP8266");
#else
  Serial.println("Board: ESP32");
#endif

  buildUrls();
  Serial.println("Data URL: " + dataUrl);
  Serial.println("Encrypt URL: " + encryptUrl);

  wifi_connect();
  puf_init();
  String hex = puf_toHex();
  Serial.println("PUF ready (" + String(hex.length()) + " hex chars)");
  puf_dumpHex(hex);
}

void loop() {
  if (!wifi_isConnected()) {
    Serial.println("WiFi disconnected — reconnecting...");
    wifi_connect();
    if (!wifi_isConnected()) { delay(LOOP_INTERVAL_MS); return; }
  }

  const String mac = wifi_getMac();
  const String sramHex = puf_toHex();

  // Build plaintext: gateway (Phase 2) expects device identity inside encrypted payload
  // but also reads PUF from X-SRAM-Data header. Keep both for compatibility.
  StaticJsonDocument<2048> plainDoc;
  plainDoc["mac"] = mac;
  plainDoc["sram"] = sramHex;
  String plaintext;
  serializeJson(plainDoc, plaintext);

  String publicKey = resolvePublicKey(mac);

  EncryptResult enc;
  if (publicKey.length() > 32) {
    Serial.println(">> Encrypting via " + encryptUrl);
    enc = gateway_encrypt(publicKey, plaintext, encryptUrl);
  } else {
    Serial.println(">> Encrypting via mac lookup (no publicKey)");
    enc = gateway_encryptViaMac(mac, plaintext, encryptUrl);
  }

  if (!enc.ok) {
    Serial.print("Encrypt failed HTTP ");
    Serial.print(enc.httpCode);
    Serial.print(": ");
    Serial.println(enc.error);
    delay(LOOP_INTERVAL_MS);
    return;
  }
  Serial.println("Encrypt OK: kyber " + String(enc.kyberCiphertextBase64.length()) + "B");

  DataResult dataRes = gateway_sendData(dataUrl, mac, sramHex, enc);
  Serial.print("Data POST code ");
  Serial.print(dataRes.httpCode);
  Serial.print(" body: ");
  Serial.println(dataRes.body.substring(0, 300));
  if (dataRes.httpCode == 403 && dataRes.body.indexOf("pending_approval") >= 0) {
    Serial.println("Device pending admin approval — will retry");
  }

  delay(LOOP_INTERVAL_MS);
}
