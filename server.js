const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const BASELINE_PATH = path.join(__dirname, 'baseline.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Known common/malicious ports to flag
const DANGEROUS_PORTS = {
  21: 'FTP (Often unencrypted, target for brute force)',
  22: 'SSH (Target for brute force/tunneling)',
  23: 'Telnet (Unencrypted, highly insecure)',
  25: 'SMTP (Target for spam/relaying)',
  135: 'RPC (Microsoft RPC Endpoint Mapper, vector for exploits)',
  139: 'NetBIOS (Often targeted for network scanning)',
  445: 'SMB (Target for EternalBlue and worm propagation)',
  1433: 'MSSQL (Database port, target for SQL injection/brute force)',
  3306: 'MySQL (Database port, target for exploitation)',
  3389: 'RDP (Remote Desktop, high risk of brute force/RDP exploits)',
  4444: 'Metasploit default listener (Commonly malicious)',
  5555: 'Android Debug Bridge (ADB over network, vector for exploits)',
  8000: 'Common web dev port (Sometimes used by malware backdoors)',
  8080: 'Common proxy/web port',
  31337: 'Back Orifice / Hackers utility port'
};

// Helper: Run command asynchronously
function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        // netstat can sometimes return non-zero exit codes if there are warnings,
        // we'll return stdout anyway if available.
        if (stdout) return resolve(stdout);
        return reject(error);
      }
      resolve(stdout);
    });
  });
}

// Read baseline file
function readBaseline() {
  try {
    if (!fs.existsSync(BASELINE_PATH)) {
      fs.writeFileSync(BASELINE_PATH, JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync(BASELINE_PATH, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading baseline file:', err);
    return [];
  }
}

// Write baseline file
function writeBaseline(baseline) {
  try {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
    return true;
  } catch (err) {
    console.error('Error writing baseline file:', err);
    return false;
  }
}

// Parse tasklist to get PID -> Process mappings
async function getProcessMap() {
  const map = {};
  try {
    // tasklist /fo csv /nh -> Format CSV, No Headers
    // Output: "taskhostw.exe","2320","Console","1","15,220 K"
    const stdout = await runCommand('tasklist /fo csv /nh');
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      // CSV parse line: splitting by comma, taking care of quotes
      const parts = line.split('","');
      if (parts.length >= 2) {
        const name = parts[0].replace(/"/g, '').trim();
        const pid = parseInt(parts[1].replace(/"/g, '').trim(), 10);
        if (!isNaN(pid)) {
          map[pid] = name;
        }
      }
    }
  } catch (err) {
    console.error('Error getting process list:', err);
  }
  return map;
}

// Parse netstat -ano to find LISTENING ports
async function getListeningPorts() {
  const ports = [];
  try {
    const stdout = await runCommand('netstat -ano');
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Look for TCP/UDP listening ports
      // Pattern: TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       996
      // UDP parses differently because there's no state column usually:
      // UDP    0.0.0.0:5357           *:*                                    2180
      const tokens = trimmed.split(/\s+/);
      if (tokens.length < 4) continue;
      
      const proto = tokens[0].toUpperCase();
      if (proto !== 'TCP' && proto !== 'UDP') continue;
      
      const localAddress = tokens[1];
      let foreignAddress = tokens[2];
      let state = '';
      let pidStr = '';
      
      if (proto === 'TCP') {
        state = tokens[3];
        pidStr = tokens[4];
      } else {
        // UDP doesn't have "LISTENING" state, but it is listening to receive packets
        state = 'LISTENING (UDP)';
        pidStr = tokens[3];
      }
      
      // We only care about listeners (active servers)
      if (state !== 'LISTENING' && state !== 'LISTENING (UDP)') continue;
      
      const pid = parseInt(pidStr, 10);
      if (isNaN(pid)) continue;
      
      // Parse local IP and Port
      // Address formats can be:
      // 0.0.0.0:135 (IPv4)
      // [::]:135 (IPv6)
      // 127.0.0.1:49673
      // [::1]:49673
      let ip = '';
      let port = null;
      
      if (localAddress.includes(']:')) {
        // IPv6 bracketed address
        const idx = localAddress.lastIndexOf(':');
        ip = localAddress.substring(0, idx);
        port = parseInt(localAddress.substring(idx + 1), 10);
      } else {
        const idx = localAddress.lastIndexOf(':');
        if (idx !== -1) {
          ip = localAddress.substring(0, idx);
          port = parseInt(localAddress.substring(idx + 1), 10);
        }
      }
      
      if (port !== null && !isNaN(port)) {
        ports.push({
          protocol: proto,
          localIp: ip,
          port: port,
          pid: pid,
          state: state
        });
      }
    }
  } catch (err) {
    console.error('Error running netstat:', err);
  }
  return ports;
}

// Check if a port/process matches the trusted baseline
function isBaselined(port, processName, protocol, baseline) {
  return baseline.some(item => 
    item.port === port && 
    item.process.toLowerCase() === processName.toLowerCase() && 
    item.protocol.toUpperCase() === protocol.toUpperCase()
  );
}

// Scans ports and performs anomaly analysis
async function runAudit() {
  const [ports, processMap, baseline] = await Promise.all([
    getListeningPorts(),
    getProcessMap(),
    readBaseline()
  ]);

  // Combine netstat outputs with process list & anomaly checks
  const results = ports.map(item => {
    const processName = processMap[item.pid] || 'Unknown Process';
    const isLocalOnly = item.localIp === '127.0.0.1' || item.localIp === '[::1]';
    const baselined = isBaselined(item.port, processName, item.protocol, baseline);
    
    // Evaluate anomalies
    const anomalies = [];
    
    // 1. Check if the port/process pair is in the baseline
    if (!baselined) {
      anomalies.push({
        type: 'baseline_drift',
        severity: 'low',
        message: 'This process & port configuration is not in the trusted baseline.',
        suggestion: 'If this application is authorized, click "Trust Configuration" to whitelist it. Otherwise, investigate or terminate this process.'
      });
    }

    // 2. Public connection binding warnings
    if (!isLocalOnly) {
      // If it listens on 0.0.0.0 or [::] it accepts foreign connections
      anomalies.push({
        type: 'external_binding',
        severity: 'medium',
        message: `Listens on public interface (${item.localIp}). Exposed to external network.`,
        suggestion: 'Configure the application to bind to "127.0.0.1" (localhost) instead of "0.0.0.0" to prevent exposure to external devices.'
      });
    }

    // 3. Known critical or malicious ports
    if (DANGEROUS_PORTS[item.port]) {
      const details = DANGEROUS_PORTS[item.port];
      anomalies.push({
        type: 'dangerous_port',
        severity: 'high',
        message: `High-risk port active: ${item.port} - ${details}`,
        suggestion: `Close this port unless strictly required. Terminate the process using "Kill Process" or block inbound port ${item.port} traffic via Windows Firewall.`
      });
    }

    // Determine highest anomaly severity
    let maxSeverity = 'info';
    if (anomalies.length > 0) {
      if (anomalies.some(a => a.severity === 'high')) maxSeverity = 'high';
      else if (anomalies.some(a => a.severity === 'medium')) maxSeverity = 'medium';
      else maxSeverity = 'low';
    }

    return {
      ...item,
      processName,
      isLocalOnly,
      baselined,
      anomalies,
      severity: maxSeverity
    };
  });

  // Unique key to distinguish different records (e.g. proto + port + processName)
  return results;
}

// --- API ROUTES ---

// Trigger a fresh port scan & anomaly audit
app.get('/api/scan', async (req, res) => {
  try {
    const auditData = await runAudit();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: auditData
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// View baseline list
app.get('/api/baseline', (req, res) => {
  res.json({ success: true, baseline: readBaseline() });
});

// Add trusted profile to baseline
app.post('/api/baseline', (req, res) => {
  const { port, process, protocol } = req.body;
  if (!port || !process || !protocol) {
    return res.status(400).json({ success: false, error: 'Port, process, and protocol are required.' });
  }

  const baseline = readBaseline();
  
  // Prevent duplicate baseline items
  const exists = baseline.some(item => 
    item.port === parseInt(port, 10) && 
    item.process.toLowerCase() === process.toLowerCase() && 
    item.protocol.toUpperCase() === protocol.toUpperCase()
  );

  if (!exists) {
    baseline.push({
      port: parseInt(port, 10),
      process: process,
      protocol: protocol.toUpperCase(),
      addedAt: new Date().toISOString()
    });
    writeBaseline(baseline);
  }

  res.json({ success: true, message: 'Added to trusted baseline successfully.' });
});

// Remove profile from baseline
app.delete('/api/baseline', (req, res) => {
  const { port, process, protocol } = req.body;
  if (!port || !process || !protocol) {
    return res.status(400).json({ success: false, error: 'Port, process, and protocol are required.' });
  }

  let baseline = readBaseline();
  const initialLength = baseline.length;
  baseline = baseline.filter(item => 
    !(item.port === parseInt(port, 10) && 
      item.process.toLowerCase() === process.toLowerCase() && 
      item.protocol.toUpperCase() === protocol.toUpperCase())
  );

  if (baseline.length < initialLength) {
    writeBaseline(baseline);
    return res.json({ success: true, message: 'Removed from baseline.' });
  }
  res.status(404).json({ success: false, error: 'Configuration not found in baseline.' });
});

// Kill process by PID
app.post('/api/kill', async (req, res) => {
  const { pid } = req.body;
  if (!pid) {
    return res.status(400).json({ success: false, error: 'Process PID is required.' });
  }

  try {
    // /F - Force terminate, /PID - process ID
    await runCommand(`taskkill /F /PID ${pid}`);
    res.json({ success: true, message: `Process with PID ${pid} terminated successfully.` });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: `Failed to terminate PID ${pid}. Run server as Administrator to kill system-level processes.` 
    });
  }
});

// Start Express App
app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`   Network Port Scanner & Anomaly Detector Server`);
  console.log(`   Running on: http://localhost:${PORT}`);
  console.log(`========================================================`);
});
