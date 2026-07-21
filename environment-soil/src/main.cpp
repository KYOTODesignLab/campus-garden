#include "M5StickCPlus2.h"
#include <Wire.h>
#include <Adafruit_SHT4x.h>

// ---------------------------------------------------------------------------
// Pin configuration
// ---------------------------------------------------------------------------
// SHT40 over the Grove I2C port. Wire.begin(SDA, SCL): SDA=G32, SCL=G33.
constexpr int I2C_SDA_PIN = 32;
constexpr int I2C_SCL_PIN = 33;

// HW-080 fork probe wired as a pull-up divider: 3V3 -- 10k -- G36 -- soil -- GND.
// Dry soil => high resistance => voltage near 3V3 => high raw value.
// Wet soil => low  resistance => voltage near 0   => low  raw value.
constexpr int SOIL_ADC_PIN = 36;

// ---------------------------------------------------------------------------
// Soil calibration (MUST be tuned against the real probe/soil)
// ---------------------------------------------------------------------------
// Measure the averaged raw value in fully dry air/soil and in water/wet soil,
// then update these two constants. Because of the pull-up divider above, the
// dry reading is the higher raw value and the wet reading is the lower one.
constexpr int SOIL_RAW_DRY = 3000;  // 0%   (dry)  -- placeholder, calibrate
constexpr int SOIL_RAW_WET = 1200;  // 100% (wet)  -- placeholder, calibrate

// Number of ADC samples to average out ESP32 ADC noise.
constexpr int SOIL_SAMPLE_COUNT = 10;

// Refresh interval (ms).
constexpr uint32_t UPDATE_INTERVAL_MS = 1000;

// Moisture thresholds for the color coding (percent).
constexpr int SOIL_DRY_THRESHOLD = 30;  // below => red
constexpr int SOIL_WET_THRESHOLD = 70;  // above => green, between => yellow

Adafruit_SHT4x sht4;
bool shtReady = false;
uint32_t lastUpdate = 0;

// Read the soil ADC several times and return the mean to reduce noise.
int readSoilRaw() {
  uint32_t sum = 0;
  for (int i = 0; i < SOIL_SAMPLE_COUNT; ++i) {
    sum += analogRead(SOIL_ADC_PIN);
  }
  return static_cast<int>(sum / SOIL_SAMPLE_COUNT);
}

// Map an averaged raw value to 0..100% using the calibration constants.
int soilPercent(int raw) {
  // map() handles the inverted (dry high -> wet low) range directly.
  long pct = map(raw, SOIL_RAW_DRY, SOIL_RAW_WET, 0, 100);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return static_cast<int>(pct);
}

uint16_t soilColor(int percent) {
  if (percent < SOIL_DRY_THRESHOLD) return TFT_RED;
  if (percent > SOIL_WET_THRESHOLD) return TFT_GREEN;
  return TFT_YELLOW;
}

void drawStaticLayout() {
  auto &lcd = StickCP2.Display;
  lcd.fillScreen(TFT_BLACK);

  // Title bar.
  lcd.fillRect(0, 0, lcd.width(), 22, TFT_NAVY);
  lcd.setTextColor(TFT_WHITE, TFT_NAVY);
  lcd.setTextDatum(middle_center);
  lcd.setTextSize(2);
  lcd.drawString("ENV MONITOR", lcd.width() / 2, 11);
  lcd.setTextDatum(top_left);
}

// Render the latest readings. sht values are NAN when the sensor read failed.
void render(float tempC, float humidity, int soilRaw, int soilPct) {
  auto &lcd = StickCP2.Display;
  const int w = lcd.width();

  // Clear the dynamic region below the title bar.
  lcd.fillRect(0, 24, w, lcd.height() - 24, TFT_BLACK);

  lcd.setTextSize(2);

  // Temperature.
  lcd.setTextColor(TFT_CYAN, TFT_BLACK);
  lcd.setCursor(6, 32);
  if (isnan(tempC)) {
    lcd.print("Temp  --.- C");
  } else {
    lcd.printf("Temp %5.1f C", tempC);
  }

  // Humidity.
  lcd.setTextColor(TFT_WHITE, TFT_BLACK);
  lcd.setCursor(6, 58);
  if (isnan(humidity)) {
    lcd.print("Hum   --.- %");
  } else {
    lcd.printf("Hum  %5.1f %%", humidity);
  }

  // Divider line.
  lcd.drawFastHLine(6, 84, w - 12, TFT_DARKGREY);

  // Soil moisture (color coded).
  lcd.setTextColor(TFT_WHITE, TFT_BLACK);
  lcd.setCursor(6, 96);
  lcd.print("Soil");

  lcd.setTextSize(3);
  lcd.setTextColor(soilColor(soilPct), TFT_BLACK);
  lcd.setCursor(6, 118);
  lcd.printf("%3d %%", soilPct);

  // Raw ADC value for calibration reference.
  lcd.setTextSize(1);
  lcd.setTextColor(TFT_DARKGREY, TFT_BLACK);
  lcd.setCursor(6, 150);
  lcd.printf("raw: %4d", soilRaw);
}

void setup() {
  auto cfg = M5.config();
  StickCP2.begin(cfg);
  StickCP2.Display.setRotation(0);  // portrait 135x240

  // Grove I2C bus for the SHT40.
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  shtReady = sht4.begin(&Wire);
  if (shtReady) {
    sht4.setPrecision(SHT4X_HIGH_PRECISION);
    sht4.setHeater(SHT4X_NO_HEATER);
  }

  drawStaticLayout();
  if (!shtReady) {
    StickCP2.Display.setTextSize(1);
    StickCP2.Display.setTextColor(TFT_RED, TFT_BLACK);
    StickCP2.Display.setCursor(6, 200);
    StickCP2.Display.print("SHT40 not found");
  }
}

void loop() {
  StickCP2.update();

  const uint32_t now = millis();
  if (now - lastUpdate < UPDATE_INTERVAL_MS) {
    return;
  }
  lastUpdate = now;

  float tempC = NAN;
  float humidity = NAN;
  if (shtReady) {
    sensors_event_t humEvent, tempEvent;
    if (sht4.getEvent(&humEvent, &tempEvent)) {
      tempC = tempEvent.temperature;
      humidity = humEvent.relative_humidity;
    }
  } else {
    // Try to recover the sensor if it was not present at boot.
    shtReady = sht4.begin(&Wire);
    if (shtReady) {
      sht4.setPrecision(SHT4X_HIGH_PRECISION);
      sht4.setHeater(SHT4X_NO_HEATER);
    }
  }

  const int soilRaw = readSoilRaw();
  const int soilPct = soilPercent(soilRaw);

  render(tempC, humidity, soilRaw, soilPct);
}
