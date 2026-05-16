#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>

extern "C" {
  #include <user_interface.h>
}

const char *ssid = "AYULAPTOP";
const char *password = "LAPTOPAYU";

const char *dataUrl = "http://10.10.11.3:8824/data";
const char *encryptUrl = "http://10.10.11.3:3001/encrypt";

const char *publicKey =
"8ziNQnHDunwALis5P8Mne4KwfZO1FOiwqHaaGgJ3s3IG3RlS7xZpLyu58bJT2KZQaoMD88u127Npy3F63XLK6ke3VYaFAMuxPpIEtmJs8aM2rnV1HswZ9VCgBfFlD2Ayp+EdxNM2XxZT7dqFvOd9CXS+zhzOEWOOUNdMdVkk88MHJUc3PIo6elYeNmafi9c3hznHDAI1CbV5Oyt6suu6r7cXBxg2/KPF4RwwH5QphYUZ4DKUcMoyQppdcgrM4PS8xnIUrryrSlabpGl0NkaYj4JTc9qAXZZPCRVRn+mJ3XIQg1oJnFm/0oh7Y1ZsBHu06UMKigpOnndUlpxEKRcj3eJrYmARhSIZqnIFf+dc5PVOaUNnTVKUXYNnuXy7wBYChVu8WtlRyPySFUzHPaiC+MO/93hEJwyaM6WfLUkQZ/LCO1GB0HVlqNU6s8F4ASOIk+dg0EUF0UJX3MBMe3m6IjqQy6KlufS7BTulm5HJd9xarBQ908RU6vQOVHq7zAhTQ9wYNMjL5GOgf/uo4VxNSrABGlLAQfXDNtBesqpHRAQbYdALJMBzbvN6qYM0h/zLDdaaYRRlLTuTydhvslRbbtwzDldeSoCBzdJUNnciuhRKg2kQoyUEZHfDk/qmGCEpzABzguYRzNtXy+sK3RvIlhcbsmBRl4o4FqtW19qjJbTPYWYFsoLOuQqq8rOyzWqfgEjKhgclCHdMzVsHdRiBhuiPQmw44EZuIYoD1thHVNl3rnUXnfgi1alb9pYQuqM/jpCa6fQnG9WOHJMqF3VBCCkg/zMB/XhWJnYwupSZQNxnEtOH5bsBpuI1Rtcb8kpM48ljVDjFMKZjNpygUnETJpongeihl4Fv/KWW7/MCBvGREgiqnolvtTIKA6VyFfOvnFWb6AsboCcpmjE0Chk98ZSS5zZD7HtW89U9dTC5lspWBxKOLmpVqIk71WlkY+Yp4JOyo4aFy0W+K0Q91La66bArd3iyW0MOpEdZKtS3EcpT4HuTppW2b6QQc2dvqHlnAlapTGvkDyKRCOd8ryPwhFFoqs3tjxHzKIUKEBeRRn8=";

// ESP8266 RAM is limited
uint8_t sram_puf[512];

void getPUF();

void setup()
{
  Serial.begin(115200);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConnected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  randomSeed(analogRead(A0));

  // Generate pseudo SRAM data
  for (int i = 0; i < sizeof(sram_puf); i++)
  {
    sram_puf[i] = random(0, 256);
  }

  getPUF();
}

void loop()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    delay(5000);
    return;
  }

  WiFiClient client;

  /* =========================
     STEP 1: /encrypt
  ========================= */

  HTTPClient httpEncrypt;

  httpEncrypt.begin(client, encryptUrl);
  httpEncrypt.addHeader("Content-Type", "application/json");

  StaticJsonDocument<512> encDoc;

  encDoc["publicKey"] = publicKey;

  StaticJsonDocument<2048> plainDoc;

  plainDoc["mac"] = WiFi.macAddress();

  String sramHex;
  sramHex.reserve(sizeof(sram_puf) * 2 + 1);

  for (int i = 0; i < sizeof(sram_puf); i++)
  {
    char buf[3];
    sprintf(buf, "%02X", sram_puf[i]);
    sramHex += buf;
  }

  plainDoc["sram"] = sramHex;

  String plaintext;
  serializeJson(plainDoc, plaintext);

  encDoc["plaintext"] = plaintext;

  String encryptPayload;
  serializeJson(encDoc, encryptPayload);

  Serial.println(">> Sending to /encrypt...");

  int encryptCode = httpEncrypt.POST(encryptPayload);

  Serial.print("Encrypt response code: ");
  Serial.println(encryptCode);

  String kyberCiphertextBase64 = "";
  String ivBase64 = "";
  String payloadCiphertextBase64 = "";

  if (encryptCode == 200)
  {
    String encryptResponse = httpEncrypt.getString();

    Serial.println("Encrypt response:");
    Serial.println(encryptResponse);

    StaticJsonDocument<4096> respDoc;

    DeserializationError err =
      deserializeJson(respDoc, encryptResponse);

    if (!err)
    {
      kyberCiphertextBase64 =
        respDoc["kyberCiphertextBase64"].as<String>();

      ivBase64 =
        respDoc["ivBase64"].as<String>();

      payloadCiphertextBase64 =
        respDoc["payloadCiphertextBase64"].as<String>();
    }
    else
    {
      Serial.print("JSON parse error: ");
      Serial.println(err.c_str());
    }
  }
  else
  {
    Serial.println("Encrypt request failed!");
    Serial.println(httpEncrypt.getString());
  }

  httpEncrypt.end();

  /* =========================
     STEP 2: /data
  ========================= */

  if (
      payloadCiphertextBase64.length() > 0 &&
      kyberCiphertextBase64.length() > 0
     )
  {
    HTTPClient httpData;

    httpData.begin(client, dataUrl);

    httpData.addHeader(
      "Content-Type",
      "application/json"
    );

    httpData.addHeader(
      "X-MAC-Address",
      WiFi.macAddress()
    );

    httpData.addHeader(
      "X-SRAM-Data",
      sramHex
    );

    StaticJsonDocument<2048> dataDoc;

    dataDoc["kyberCiphertextBase64"] =
      kyberCiphertextBase64;

    dataDoc["ivBase64"] =
      ivBase64;

    dataDoc["payloadCiphertextBase64"] =
      payloadCiphertextBase64;

    // ESP8266 equivalent
    dataDoc["text"] = String(os_random());

    String dataPayload;

    serializeJson(dataDoc, dataPayload);

    Serial.println(">> Sending encrypted data to /data...");

    int dataCode = httpData.POST(dataPayload);

    Serial.print("Data response code: ");
    Serial.println(dataCode);

    String dataResponse = httpData.getString();

    Serial.println("Data response:");
    Serial.println(dataResponse);

    httpData.end();
  }
  else
  {
    Serial.println(
      "Skipping /data - no encrypted data available."
    );
  }

  delay(1000);
}

void getPUF()
{
  delay(1000);

  Serial.println();
  Serial.println("ESP8266 SRAM PUF Dump:");
  Serial.println("--------------------");

  for (int i = 0; i < sizeof(sram_puf); i++)
  {
    if (i % 16 == 0)
    {
      Serial.printf("\n%04X: ", i);
    }

    Serial.printf("%02X ", sram_puf[i]);
  }

  Serial.println("\n\nDone.");
}

void getMAC()
{
  Serial.print("ESP8266 MAC Address: ");
  Serial.println(WiFi.macAddress());
}
