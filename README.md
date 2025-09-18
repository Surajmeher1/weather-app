# Weather2 Dashboard

## 📌 Overview
Weather2 is a web-based dashboard that monitors IoT weather station sensor data (via **Blynk Cloud**) and displays real-time information such as temperature, humidity, and pressure.  
It also provides **device online/offline detection** and **browser connection status** for reliable monitoring.

---

## 🚀 Features
- 🌡️ Real-time temperature, humidity, and pressure data.
- 🔗 Integration with **Blynk Cloud API** for IoT device monitoring.
- 🟢/🔴 Device online/offline detection using:
  - `isHardwareConnected` API (device connectivity).
  - `navigator.onLine` (browser internet status).
- ⚡ Auto-refresh with periodic API calls.
- 🎨 Clean UI with responsive design.

---

## 📂 Project Structure
```
weather2/
│── index.html        # Main webpage
│── css/
│   └── style.css     # Styling file
│── js/
│   └── script.js     # Logic for fetching data & detecting device status
│── .hintrc           # Configuration for webhint
```

---

## ⚙️ Setup Instructions
1. Clone or extract this project:
   ```bash
   git clone <your-repo-url>
   ```

2. Open `index.html` in your browser.

3. Update your **Blynk AUTH_TOKEN** inside `script.js`:
   ```javascript
   const AUTH_TOKEN = "your-blynk-auth-token";
   ```

4. Optionally, update the **Weather API key** if needed.

---

## 🔧 Usage
- The dashboard will fetch sensor data every **5 seconds**.
- Device status is checked every **10 seconds**.
- Connection status is updated instantly (online/offline).

---

## 📡 APIs Used
- **Blynk Cloud API**  
  - `https://blynk.cloud/external/api/get?token=...&V1` → Sensor values  
  - `https://blynk.cloud/external/api/isHardwareConnected?token=...` → Device connectivity  

- **Browser APIs**  
  - `navigator.onLine` → Internet connection status  
  - `online/offline` events → Real-time connectivity detection  

---

## 🖼️ Example UI
- Device Online → 🟢 Device Online  
- Device Offline → 🔴 Device Offline  
- No Internet → ⚠️ Connection Error  

---

## 👨‍💻 Author
Developed by **Suraj Meher**  
B.Tech CSE | GIET University  

