const REMO_TOKEN = "アクセストークン";
const LIGHT_ID = "a0cadff2-3b56-4cae-bc32-a4e804c07f5f";//照明ID
const SHEET_NAME = "照明ログ";

/**
 * 状態を見て ON / OFF を切り替えるメイン関数
 */
function toggleLightAndLog() {
  const state = getLightState(); // "on" | "off"

  if (state === "on") {
    controlLight("off");
    writeLog("照明OFF");
  } else {
    controlLight("on");
    writeLog("照明ON");
  }
}


/**
 * 照明制御
 */
function controlLight(button) {
  UrlFetchApp.fetch(
    `https://api.nature.global/1/appliances/${LIGHT_ID}/light`,
    {
      method: "post",
      headers: {
        Authorization: "Bearer " + REMO_TOKEN
      },
      payload: { button }
    }
  );
}

/**
 * 現在の照明状態を取得する
 * @return "on" | "off"
 */
function getLightState() {
  const res = UrlFetchApp.fetch(
    "https://api.nature.global/1/appliances",
    {
      headers: {
        Authorization: "Bearer " + REMO_TOKEN
      }
    }
  );

  const appliances = JSON.parse(res.getContentText());
  const light = appliances.find(a => a.id === LIGHT_ID);

  if (!light || !light.light || !light.light.state) {
    throw new Error("照明が見つからない、または状態取得不可");
  }

  return light.light.state.power; // "on" or "off"
}
/**
 * ログ記録
 */
function writeLog(action) {
  const sheet =
    SpreadsheetApp.getActive().getSheetByName(SHEET_NAME)
    || SpreadsheetApp.getActive().insertSheet(SHEET_NAME);

  sheet.appendRow([new Date(), action]);
}
