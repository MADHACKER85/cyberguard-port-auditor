# CyberGuard // Host Port Auditor & Anomaly Detector

CyberGuard is a premium, interactive cybersecurity utility for Windows. It audits active listening network sockets, resolves their owning process trees (PIDs & names), flags security anomalies, and enables quick threat mitigation directly from a glassmorphic dashboard interface.

---

## Key Features

1. **Active Socket Mapping**: Automatically audits TCP & UDP listening ports on Windows using standard system utilities.
2. **Process Ownership Resolution**: Maps network ports directly to the running application processes (e.g. `svchost.exe`, `node.exe`) and PIDs.
3. **Anomaly Intelligence Engine**:
   - **Baseline Drift**: Detects unrecognized port/process configurations.
   - **Exposure Alerts**: Flags applications binding to public interfaces (`0.0.0.0`) instead of `127.0.0.1`.
   - **Dangerous Ports**: Alerts when high-risk ports or exploit default listeners (e.g. `4444`, `3389`, `445`) are active.
4. **Actionable Suggestions**: Provides clear, lightbulb-highlighted recommendations on how to close or isolate each flagged anomaly.
5. **Adaptive Whitelisting**: Click "Trust Configuration" to save approved profiles, eliminating future audit noise.
6. **Instant Process Termination**: Force-kill unauthorized or suspicious processes directly from the secure management console.
7. **Kaspersky-Style 3D Cybermap**: Includes a stunning, interactive 3D rotating globe background on the landing page showing simulated cyber attacks, city hubs, and continent grids with mouse drag controls.

---

## Tech Stack

- **Backend**: Node.js, Express API, Windows Command Core (`netstat` & `tasklist`)
- **Frontend**: HTML5 Canvas (3D Math Projection), Vanilla CSS (Glassmorphism), JavaScript (Spring Cursor Physics)
- **Dependencies**: Minimal (only `express`) for maximum security and fast load times.

---

## Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone <your-repository-url>
   cd network-port-scanner
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the application**:
   - For auditing normal processes:
     ```bash
     npm start
     ```
   - For terminating privileged system-level services, run your shell as an **Elevated Administrator** before starting.

4. **Access the Console**:
   Open [http://localhost:5000](http://localhost:5000) in your web browser.

---

## Licensing & Copyright

&copy; 2026 Keerthivasan Krishnamoorthy. All Rights Reserved.  
Use of this utility is subject to authorization policies. Unauthorised reproduction or distribution of this software is strictly prohibited.
