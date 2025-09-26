const express = require("express");
const app = express();
const port = process.env.PORT || 4500;
const multer = require("multer");
const upload = multer();
const { google } = require("googleapis");

const privateKey = Buffer.from(
  process.env.GOOGLE_PRIVATE_KEY_BASE64,
  "base64"
)
  .toString("utf8")
  .replace(/\\n/g, "\n") 
  .replace(/\r/g, ""); 

const serviceAccount = {
  type: process.env.GOOGLE_TYPE,
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: privateKey,
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN,
};

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = "1no97hcTVxJbxemmcNtRLZHn5Olv1A2_N2P47_VDeTVc";

async function updateTrackingStatus(waybillId, currentStatus, lastUpdateTime) {
  try {
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Orders!A2:A",
    });

    const rows = readRes.data.values;
    if (!rows || rows.length === 0) {
      console.log("No data found in column A.");
      return;
    }

    let targetRow = null;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] == waybillId) {
        targetRow = i + 2;
        break;
      }
    }

    if (!targetRow) {
      console.log(`Waybill ID ${waybillId} not found.`);
      return;
    }

    const updateRes = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `Orders!G${targetRow}`,
            values: [[currentStatus]],
          },
          {
            range: `Orders!L${targetRow}`,
            values: [[lastUpdateTime]],
          },
        ],
      },
    });

    console.log(`Updated row ${targetRow} for Waybill ID ${waybillId}`);
  } catch (error) {
    console.error("Error updating Google Sheet:", error);
  }
}

app.get("/", (req, res) => {
  res.json({
    message: "Herbcey Backend API is running!",
    status: "success",
    endpoints: {
      tracking_callback: "/api/tracking/callback",
    },
  });
});

app.post("/api/tracking/callback", upload.none(), (req, res) => {
  console.log(
    "Final parsed req.body in route handler (from Multer):",
    req.body
  );

  const waybillId = req.body.waybill_id;
  const currentStatus = req.body.current_status;
  const lastUpdateTime = req.body.last_update_time;

  console.log("Received Delivery Status Update:");
  console.log("Waybill ID:", waybillId);
  console.log("Current Status:", currentStatus);
  console.log("Last Update Time:", lastUpdateTime);

  // Your Code to Update Your Database
  if (waybillId && currentStatus) {
    updateTrackingStatus(waybillId, currentStatus, lastUpdateTime);
  } else {
    console.warn("Missing essential data (waybill_id or current_status).");
  }

  res.status(200).send("Callback received and processed.");
});

app.use((req, res, next) => {
  console.log(`\n--- Incoming Request ---`);
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log("Headers:", req.headers);
  next(); // Always call next() to pass to the route handler
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  console.log(
    `Your webhook endpoint will be: http://localhost:${port}/api/tracking/callback`
  );
});
