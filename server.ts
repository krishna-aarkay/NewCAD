import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { generateInitialData, DatabaseSchema } from './src/server/mockData';
import { LicenseServer, UserProfile, Checkout, UsageRecord, BorrowRecord, LicenseComplianceIssue, OptionsRule } from './src/types';
import { GoogleGenAI } from '@google/genai';

const PORT = 3000;
const DB_PATH = path.join(process.cwd(), 'db.json');

// Lazy initialize Gemini API client for compliance optimization guidance
let aiInstance: GoogleGenAI | null = null;
function getGeminiSDK(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === '') {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Read/Write DB helper using simple synchronous filesystem calls for atomic consistency
function readDB(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error('Error reading db.json, generating defaults', error);
  }
  // Generate and save initial data if not exists or corrupted
  const initial = generateInitialData();
  writeDB(initial);
  return initial;
}

function writeDB(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to db.json', error);
  }
}

// Initialize db.json immediately
readDB();

async function startServer() {
  const app = express();
  app.use(express.json());

  // CORS headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Simple token/user auth checking middleware
  const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const userIdHeader = req.headers['x-user-id'] as string;
    const isAuthRequest = req.path.startsWith('/auth/initialized') || 
                          req.path.startsWith('/auth/login') || 
                          req.path.startsWith('/auth/register') ||
                          req.path.startsWith('/api/auth/initialized') || 
                          req.path.startsWith('/api/auth/login') || 
                          req.path.startsWith('/api/auth/register');

    if (!userIdHeader) {
      // Allow general unauthenticated calls for setup/auth endpoints
      if (isAuthRequest) {
        return next();
      }
      return res.status(401).json({ error: 'Authentication required. Missing x-user-id' });
    }
    const db = readDB();
    const user = db.users.find(u => u.id === userIdHeader || u.username === userIdHeader);
    if (!user) {
      if (isAuthRequest) {
        return next();
      }
      return res.status(401).json({ error: 'User does not exist in the database' });
    }
    (req as any).user = user;
    next();
  };

  // Mount Auth Middleware for /api routes
  app.use('/api', authMiddleware);

  // --- API Routes ---

  // Auth Status check: Check if any registered user exists in system
  app.get('/api/auth/initialized', (req, res) => {
    const db = readDB();
    const initialized = db.users.length > 0;
    res.json({ initialized });
  });

  // Login
  app.post('/api/auth/login', (req, res) => {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const db = readDB();
    const cleanUsername = username.trim().toLowerCase();
    const user = db.users.find(u => u.username.toLowerCase() === cleanUsername);
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register.' });
    }
    res.json({ user });
  });

  // Register First User / Create Login
  app.post('/api/auth/register', (req, res) => {
    const { username, email, role, group, project, host } = req.body;
    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }

    const db = readDB();
    const cleanUsername = username.trim();
    const exist = db.users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (exist) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Default notifications setup
    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      username: cleanUsername,
      email: email.trim(),
      role: role || (db.users.length === 0 ? 'Admin' : 'Engineer'),
      notifications: {
        emailAlerts: true,
        expiryDaysThreshold: 30,
        checkoutAlerts: true,
        preemptionAlerts: true
      },
      group: group || 'IC_DESIGN_LEAD',
      project: project || 'Project_Apollo',
      host: host || 'workstation-local'
    };

    db.users.push(newUser);
    writeDB(db);

    res.status(201).json({ user: newUser });
  });

  // Get current active profile
  app.get('/api/auth/me', (req, res) => {
    const user = (req as any).user;
    res.json({ user });
  });

  // Update profile and notification settings
  app.put('/api/auth/profile', (req, res) => {
    const currentUser = (req as any).user;
    const { email, group, project, host, role, notifications } = req.body;

    const db = readDB();
    const userIndex = db.users.findIndex(u => u.id === currentUser.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (email) db.users[userIndex].email = email;
    if (group) db.users[userIndex].group = group;
    if (project) db.users[userIndex].project = project;
    if (host) db.users[userIndex].host = host;
    if (role) db.users[userIndex].role = role;
    if (notifications) {
      db.users[userIndex].notifications = {
        ...db.users[userIndex].notifications,
        ...notifications
      };
    }

    writeDB(db);
    res.json({ user: db.users[userIndex] });
  });

  // Users management list (Admins / Managers only)
  app.get('/api/users', (req, res) => {
    const db = readDB();
    res.json({ users: db.users });
  });

  app.put('/api/users/:id/role', (req, res) => {
    const caller = (req as any).user;
    if (caller.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized. Only admins can manage roles.' });
    }
    const { id } = req.params;
    const { role } = req.body;

    const db = readDB();
    const user = db.users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.role = role;
    writeDB(db);
    res.json({ user });
  });

  // Create login user (Admins only)
  app.post('/api/users', (req, res) => {
    const caller = (req as any).user;
    if (caller.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized. Admins only.' });
    }
    const { username, email, role, group, project, host } = req.body;
    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }

    const db = readDB();
    const cleanUsername = username.trim();
    if (db.users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      username: cleanUsername,
      email: email.trim(),
      role: role || 'Engineer',
      notifications: {
        emailAlerts: true,
        expiryDaysThreshold: 30,
        checkoutAlerts: true,
        preemptionAlerts: true
      },
      group: group || 'IC_DESIGN_LEAD',
      project: project || 'Project_Apollo',
      host: host || 'workstation-local'
    };

    db.users.push(newUser);
    writeDB(db);
    res.status(201).json({ user: newUser });
  });

  // Delete login user (Admins only)
  app.delete('/api/users/:id', (req, res) => {
    const caller = (req as any).user;
    if (caller.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized. Admins only.' });
    }
    const { id } = req.params;
    if (caller.id === id || caller.username === id) {
      return res.status(400).json({ error: 'Cannot delete your own active login session account.' });
    }

    const db = readDB();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'User not found in system directory' });

    db.users.splice(idx, 1);
    writeDB(db);
    res.json({ success: true });
  });

  // --- License Servers API ---

  // List servers
  app.get('/api/servers', (req, res) => {
    const db = readDB();
    res.json({ servers: db.servers });
  });

  // Get single server details
  app.get('/api/servers/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const server = db.servers.find(s => s.id === id);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    res.json({ server });
  });

  // Create new server
  app.post('/api/servers', (req, res) => {
    const caller = (req as any).user;
    if (caller.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized. Admins only.' });
    }
    const { name, type, host, port, expiryDate, features, sshEnabled, sshHost, sshPort, sshUsername, sshPassword } = req.body;

    if (!name || !type || !host || !port) {
      return res.status(400).json({ error: 'Name, type, host, and port are required' });
    }

    const db = readDB();
    const newServer: LicenseServer = {
      id: `srv-${Date.now()}`,
      name,
      type,
      host,
      port: Number(port),
      status: 'online',
      lastChecked: new Date().toISOString(),
      totalLicenses: features ? features.reduce((acc: number, cur: any) => acc + (Number(cur.total) || 0), 0) : 0,
      usedLicenses: 0,
      expiryDate: expiryDate || '2026-12-31',
      features: features ? features.map((f: any, i: number) => ({
        id: `feat-${Date.now()}-${i}`,
        name: f.name,
        total: Number(f.total) || 10,
        used: 0,
        expiryDate: f.expiryDate || expiryDate || '2026-12-31',
        checkouts: []
      })) : [],
      licenseFileContent: `# FlexLM License File\nSERVER ${host} ANY ${port}\nVENDOR master_daemon /apps/bin/daemon\n`,
      optionsFileContent: `# Options File\n`,
      sshEnabled: !!sshEnabled,
      sshHost: sshHost || host,
      sshPort: sshPort ? Number(sshPort) : 22,
      sshUsername: sshUsername || '',
      sshPassword: sshPassword || ''
    };

    db.servers.push(newServer);
    db.optionsFiles[newServer.id] = newServer.optionsFileContent;
    writeDB(db);

    res.status(201).json({ server: newServer });
  });

  // Update server parameters
  app.put('/api/servers/:id', (req, res) => {
    const caller = (req as any).user;
    if (caller.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized. Admins only.' });
    }
    const { id } = req.params;
    const { name, host, port, expiryDate, sshEnabled, sshHost, sshPort, sshUsername, sshPassword } = req.body;

    const db = readDB();
    const idx = db.servers.findIndex(s => s.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Server not found' });

    if (name !== undefined) db.servers[idx].name = name;
    if (host !== undefined) db.servers[idx].host = host;
    if (port !== undefined) db.servers[idx].port = Number(port);
    if (expiryDate !== undefined) db.servers[idx].expiryDate = expiryDate;
    if (sshEnabled !== undefined) db.servers[idx].sshEnabled = !!sshEnabled;
    if (sshHost !== undefined) db.servers[idx].sshHost = sshHost;
    if (sshPort !== undefined) db.servers[idx].sshPort = Number(sshPort);
    if (sshUsername !== undefined) db.servers[idx].sshUsername = sshUsername;
    if (sshPassword !== undefined) db.servers[idx].sshPassword = sshPassword;

    writeDB(db);
    res.json({ server: db.servers[idx] });
  });

  // Delete server
  app.delete('/api/servers/:id', (req, res) => {
    const caller = (req as any).user;
    if (caller.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized. Admins only.' });
    }
    const { id } = req.params;

    const db = readDB();
    const idx = db.servers.findIndex(s => s.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Server not found' });

    const server = db.servers[idx];
    if (server.sshEnabled) {
      const loggerTimestamp = new Date().toISOString();
      const sshLog = `[SSH-DELETION] Establishing connection to remote server: ${server.sshUsername}@${server.sshHost || server.host}:${server.sshPort || 22}...
[SSH-DELETION] Remote authentication accepted via password protocol.
[SSH-DELETION] Remote machine: ${server.host} (type: ${server.type})
[SSH-DELETION] Command triggered: lmutil lmdown -c /var/flexlm/${server.type}.lic -force
[SSH-DELETION] Output: Shutting down CAD license system daemons on daemon port ${server.port}...
[SSH-DELETION] Command triggered: rm -f /var/flexlm/${server.type}.lic /var/flexlm/options/${server.type}.opt
[SSH-DELETION] Output: File directories cleaned up successfully.
[SSH-DELETION] SSH session closed. Remote license host removed.`;

      db.commandLogs.push({
        id: `log-del-${Date.now()}`,
        timestamp: loggerTimestamp,
        serverId: id,
        action: 'SSH_DELETE_SERVER',
        output: sshLog
      });
    }

    db.servers.splice(idx, 1);
    delete db.optionsFiles[id];
    writeDB(db);

    res.json({ success: true });
  });

  // Actions command execution: lmdown, lmreread, lmup, lmstat
  app.post('/api/servers/:id/actions', (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'lmreread', 'lmdown', 'lmup', 'lmstat'
    const caller = (req as any).user;

    const db = readDB();
    const serverIdx = db.servers.findIndex(s => s.id === id);
    if (serverIdx === -1) return res.status(404).json({ error: 'Server not found' });

    const server = db.servers[serverIdx];
    const loggerTimestamp = new Date().toISOString();
    let commandOutput = '';

    // If SSH is enabled, add a technical SSH diagnostics header
    if (server.sshEnabled) {
      commandOutput += `[SSH] Establishing terminal connection to ${server.sshUsername || 'lmadmin'}@${server.sshHost || server.host}:${server.sshPort || 22}...\n`;
      commandOutput += `[SSH] Connection established successfully using secure key cryptography.\n`;
      commandOutput += `[SSH] Remote user: ${server.sshUsername || 'lmadmin'} | Active session: bash (tty)\n`;
      commandOutput += `[SSH] Executing command: lmutil ${action === 'lmup' ? 'lmgrd' : action} -c /etc/flexlm/${server.type}.lic\n`;
      commandOutput += `------------------------------------------------------------\n`;
    }

    if (action === 'lmdown') {
      server.status = 'offline';
      // Release checkouts on lmdown!
      server.features.forEach(f => {
        f.used = 0;
        f.checkouts = [];
      });
      server.usedLicenses = 0;
      commandOutput += `lmutil - Copyright (c) 1989-2023 Flexera. All Rights Reserved.
Sending shutdown request to license manager server on ${server.host}:${server.port}...
Trying connection... Connected.
Vendor daemon shut down successfully.
Server main daemon is now offline.`;
    } else if (action === 'lmup') {
      server.status = 'online';
      commandOutput += `lmutil - Copyright (c) 1989-2023 Flexera. All Rights Reserved.
Bootstrapping license server main service...
Reading license file configurations...
Server up and listening on ${server.host}:${server.port}.
Successfully launched Vendor Daemon.
Status is ONLINE.`;
    } else if (action === 'lmreread') {
      commandOutput += `lmutil - Copyright (c) 1989-2023 Flexera. All Rights Reserved.
Sending lmreread request to vendor services on host: ${server.host}
Checking status... Daemon responded.
Reading options file rules... Registered user reservations, includes & excludes correctly.
Loaded options file: ${db.optionsFiles[server.id] ? '\n---\n' + db.optionsFiles[server.id] + '\n---' : 'Empty'}
Reread command succeeded. Vendor daemon configurations updated.`;
    } else if (action === 'lmstat') {
      commandOutput += `lmutil - Copyright (c) 1989-2023 Flexera. All Rights Reserved.
Flexible License Manager status report...
License server status: ${server.port}@${server.host}
  License file(s) on ${server.host}: /apps/licenses/${server.type}.lic

${server.name} status: ${server.status.toUpperCase()} (v11.19.0)
Vendor Daemon status: ${server.status.toUpperCase()} (v11.19.0)

Feature usage info:
${server.features.map(f => `  ${f.name}: (Total of ${f.total} licenses available; Total of ${f.used} licenses in use)
    ${f.checkouts.length > 0 ? f.checkouts.map(c => `    -> ${c.username} checked out from ${c.hostname} since ${c.checkoutTime}`).join('\n') : '    No active checkout sessions.'}`).join('\n\n')}`;
    } else {
      return res.status(400).json({ error: 'Unsupported action command' });
    }

    server.lastChecked = loggerTimestamp;
    db.servers[serverIdx] = server;

    // Save console command record logs
    const logId = `log-${Date.now()}`;
    db.commandLogs.push({
      id: logId,
      timestamp: loggerTimestamp,
      serverId: server.id,
      action: action,
      output: commandOutput
    });

    writeDB(db);
    res.json({ server, output: commandOutput });
  });

  // Upload/Update License File + parse features
  app.post('/api/servers/:id/license-file', (req, res) => {
    const caller = (req as any).user;
    if (caller.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized. Admins only.' });
    }
    const { id } = req.params;
    const { content } = req.body;

    if (!content) return res.status(400).json({ error: 'License file content is required' });

    const db = readDB();
    const serverIdx = db.servers.findIndex(s => s.id === id);
    if (serverIdx === -1) return res.status(404).json({ error: 'Server not found' });

    const server = db.servers[serverIdx];
    server.licenseFileContent = content;

    // Simple parsing of features in content e.g., "FEATURE virtuoso_layout cdslmd 1.0 20-nov-2026 50"
    const lines = content.split('\n');
    const parsedFeatures: any[] = [];
    
    lines.forEach((line: string) => {
      const cleanLine = line.trim();
      if (cleanLine.startsWith('FEATURE') || cleanLine.startsWith('INCREMENT')) {
        const parts = cleanLine.split(/\s+/);
        if (parts.length >= 6) {
          const name = parts[1];
          const rawDate = parts[4]; // 20-nov-2026 or 01-jun-2026 or similar
          const rawTotal = parts[5]; // Count
          
          let cleanDate = '2026-12-31';
          if (rawDate) {
            // Check if month abbreviation matches
            const match = rawDate.match(/(\d{1,2})-(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)-(\d{4})/i);
            if (match) {
              const months: Record<string, string> = {
                jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
              };
              const d = match[1].padStart(2, '0');
              const m = months[match[2].toLowerCase()];
              const y = match[3];
              cleanDate = `${y}-${m}-${d}`;
            }
          }

          parsedFeatures.push({
            name,
            total: Number(rawTotal) || 20,
            expiryDate: cleanDate
          });
        }
      }
    });

    if (parsedFeatures.length > 0) {
      server.features = parsedFeatures.map((f, i) => {
        // Keep existing used details if feature name matches, otherwise set 0
        const existing = server.features.find(ef => ef.name === f.name);
        return {
          id: existing ? existing.id : `feat-parsed-${Date.now()}-${i}`,
          name: f.name,
          total: f.total,
          used: existing ? existing.used : 0,
          expiryDate: f.expiryDate,
          checkouts: existing ? existing.checkouts : []
        };
      });
      server.totalLicenses = server.features.reduce((acc, curr) => acc + curr.total, 0);
      server.usedLicenses = server.features.reduce((acc, curr) => acc + curr.used, 0);
    }

    db.servers[serverIdx] = server;
    writeDB(db);

    res.json({ server, parsedFeaturesCount: parsedFeatures.length });
  });

  // Get/Update Options file
  app.get('/api/servers/:id/options-file', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const content = db.optionsFiles[id] || '';
    res.json({ content });
  });

  app.post('/api/servers/:id/options-file', (req, res) => {
    const { id } = req.params;
    const { content } = req.body;

    const db = readDB();
    const serverIdx = db.servers.findIndex(s => s.id === id);
    if (serverIdx === -1) return res.status(404).json({ error: 'Server not found' });

    db.optionsFiles[id] = content;
    db.servers[serverIdx].optionsFileContent = content;
    writeDB(db);

    res.json({ success: true, content });
  });

  // Process / Parse structured options file rules into actual flexlm options block
  app.post('/api/servers/:id/options-rules', (req, res) => {
    const { id } = req.params;
    const { rules, groups } = req.body;
    
    // Construct Options File content programmatically
    let optBuffer = `# Generated FLEXlm Options File\n# Timestamp: ${new Date().toISOString()}\n\n`;
    
    // Add user groups
    if (groups && typeof groups === 'object') {
      Object.entries(groups).forEach(([gName, usersArr]: [string, any]) => {
        if (Array.isArray(usersArr) && usersArr.length > 0) {
          optBuffer += `GROUP ${gName} ${usersArr.join(' ')}\n`;
        }
      });
      optBuffer += '\n';
    }

    // Add RESERVE / EXCLUDE / INCLUDE / PREEMPT / PRIORITY rules
    if (Array.isArray(rules)) {
      rules.forEach((rule: OptionsRule) => {
        if (rule.type === 'RESERVE') {
          optBuffer += `RESERVE ${rule.count || 1} ${rule.feature} ${rule.groupType} ${rule.groupName}\n`;
        } else if (rule.type === 'PRIORITY') {
          const levelStr = rule.count === 3 ? 'HIGH' : rule.count === 2 ? 'MEDIUM' : 'LOW';
          optBuffer += `PRIORITY ${rule.feature} ${rule.groupType} ${rule.groupName} ${levelStr}\n`;
        } else if (rule.type === 'PREEMPT') {
          optBuffer += `PREEMPT ${rule.feature} ${rule.groupType} ${rule.groupName}\n`;
        } else {
          optBuffer += `${rule.type} ${rule.feature} ${rule.groupType} ${rule.groupName}\n`;
        }
      });
    }

    const db = readDB();
    const serverIdx = db.servers.findIndex(s => s.id === id);
    if (serverIdx === -1) return res.status(404).json({ error: 'Server not found' });

    db.optionsFiles[id] = optBuffer;
    db.servers[serverIdx].optionsFileContent = optBuffer;
    writeDB(db);

    res.json({ success: true, content: optBuffer });
  });

  // --- Active Checkouts and Simulations ---

  // Get live active checkouts
  app.get('/api/checkouts', (req, res) => {
    const db = readDB();
    const checkouts: Checkout[] = [];
    db.servers.forEach(srv => {
      srv.features.forEach(feat => {
        feat.checkouts.forEach(chk => {
          checkouts.push({
            ...chk,
            serverId: srv.id,
            serverName: srv.name
          } as any);
        });
      });
    });
    res.json({ checkouts });
  });

  // Simulate license Checkout / Release
  app.post('/api/checkouts/simulate', (req, res) => {
    const { serverId, featureName, username, hostname, project, action } = req.body; // action: 'checkout' or 'release'
    if (!serverId || !featureName || !username || !action) {
      return res.status(400).json({ error: 'serverId, featureName, username, and action are required' });
    }

    const db = readDB();
    const serverIdx = db.servers.findIndex(s => s.id === serverId);
    if (serverIdx === -1) return res.status(404).json({ error: 'Server not found' });
    const server = db.servers[serverIdx];
    
    if (server.status === 'offline') {
      return res.status(400).json({ error: `Cannot perform checkout. Server '${server.name}' is offline.` });
    }

    const feature = server.features.find(f => f.name === featureName);
    if (!feature) return res.status(404).json({ error: 'Feature not found in server' });

    if (action === 'checkout') {
      if (feature.used >= feature.total) {
        return res.status(400).json({ error: `Checkout declined. Licensing limit of '${featureName}' is exhausted (${feature.used}/${feature.total} in use).` });
      }

      // Check options file restrictions
      const optionsTxt = db.optionsFiles[server.id] || '';
      
      // Simple parser for EXCLUDE lines: "EXCLUDE [feat] USER/HOST/PROJECT [name]"
      const optLines = optionsTxt.split('\n');
      let rejected = false;
      let rejectReason = '';
      
      const cleanUser = username.trim().toLowerCase();
      const cleanHost = (hostname || 'temp-workstation').trim().toLowerCase();
      const cleanProj = (project || 'Project_Apollo').trim().toLowerCase();

      optLines.forEach((l: string) => {
        const lineParts = l.trim().split(/\s+/);
        if (lineParts[0] === 'EXCLUDE' && (lineParts[1] === featureName || lineParts[1] === 'ALL')) {
          const type = lineParts[2];
          const value = lineParts[3]?.toLowerCase();
          
          if (type === 'USER' && cleanUser === value) {
            rejected = true;
            rejectReason = `Excluded by options file rule: User EXCLUDE on ${featureName}`;
          } else if (type === 'HOST' && cleanHost === value) {
            rejected = true;
            rejectReason = `Excluded by options file rule: Host EXCLUDE on ${featureName}`;
          } else if (type === 'PROJECT' && cleanProj === value) {
            rejected = true;
            rejectReason = `Excluded by options file rule: Project EXCLUDE on ${featureName}`;
          }
        }
      });

      if (rejected) {
        // Log a compliance blockage
        const blockId = `cmp-${Date.now()}`;
        db.compliance.push({
          id: blockId,
          severity: 'warning',
          type: 'unlicensed_usage',
          message: `Denied checkout block on user '${username}'`,
          details: `User attempts to acquire licensing lock for ${featureName} on ${server.host}. System blocked based on FlexLM options exclusion syntax constraint: ${rejectReason}.`,
          timestamp: new Date().toISOString()
        });
        writeDB(db);
        return res.status(403).json({ error: `Checkout Blocked: ${rejectReason}` });
      }

      const newChk: Checkout = {
        id: `chk-${Date.now()}`,
        username,
        hostname: hostname || 'desktop-client',
        featureName,
        checkoutTime: new Date().toISOString(),
        project: project || 'Project_Apollo'
      };

      feature.checkouts.push(newChk);
      feature.used += 1;
      server.usedLicenses += 1;

      // Also append usage log database
      const usageId = `rec-${Date.now()}`;
      db.usage.push({
        id: usageId,
        username,
        featureName,
        date: new Date().toISOString().split('T')[0],
        durationHours: 1, // simulated base increment unit
        tokensUsed: 10,
        project: project || 'Project_Apollo'
      });

    } else if (action === 'release') {
      const checkoutIdx = feature.checkouts.findIndex(c => c.username === username);
      if (checkoutIdx === -1) return res.status(404).json({ error: `No active checkout logged for user '${username}' on feature '${featureName}'` });
      
      feature.checkouts.splice(checkoutIdx, 1);
      feature.used = Math.max(0, feature.used - 1);
      server.usedLicenses = Math.max(0, server.usedLicenses - 1);
    }

    db.servers[serverIdx] = server;
    writeDB(db);

    res.json({ server, checkoutsCount: feature.used });
  });

  // --- Reports & Exports API ---

  // Aggregate user logs for Custom Time Periods
  app.get('/api/reports/usage', (req, res) => {
    const { startDate, endDate, feature, project, username } = req.query;
    const db = readDB();

    let filteredRecords = db.usage;

    if (startDate) {
      filteredRecords = filteredRecords.filter(r => r.date >= (startDate as string));
    }
    if (endDate) {
      filteredRecords = filteredRecords.filter(r => r.date <= (endDate as string));
    }
    if (feature) {
      filteredRecords = filteredRecords.filter(r => r.featureName === (feature as string));
    }
    if (project) {
      filteredRecords = filteredRecords.filter(r => r.project === (project as string));
    }
    if (username) {
      filteredRecords = filteredRecords.filter(r => r.username.toLowerCase() === (username as string).toLowerCase());
    }

    // Prepare aggregations
    // 1. By Date
    const byDate: Record<string, number> = {};
    // 2. By User
    const byUser: Record<string, number> = {};
    // 3. By Feature
    const byFeature: Record<string, number> = {};
    // 4. By Project
    const byProject: Record<string, number> = {};

    filteredRecords.forEach(r => {
      byDate[r.date] = (byDate[r.date] || 0) + r.durationHours;
      byUser[r.username] = (byUser[r.username] || 0) + r.durationHours;
      byFeature[r.featureName] = (byFeature[r.featureName] || 0) + r.durationHours;
      if (r.project) byProject[r.project] = (byProject[r.project] || 0) + r.durationHours;
    });

    res.json({
      records: filteredRecords,
      aggregations: {
        byDate,
        byUser,
        byFeature,
        byProject
      }
    });
  });

  // CSV Export endpoint
  app.get('/api/reports/export', (req, res) => {
    const { startDate, endDate, feature, project, username } = req.query;
    const db = readDB();

    let filteredRecords = db.usage;
    if (startDate) filteredRecords = filteredRecords.filter(r => r.date >= (startDate as string));
    if (endDate) filteredRecords = filteredRecords.filter(r => r.date <= (endDate as string));
    if (feature) filteredRecords = filteredRecords.filter(r => r.featureName === (feature as string));
    if (project) filteredRecords = filteredRecords.filter(r => r.project === (project as string));
    if (username) filteredRecords = filteredRecords.filter(r => r.username.toLowerCase() === (username as string).toLowerCase().trim());

    let csv = 'ID,User,Feature,Date,Hours Used,Tokens,Project\n';
    filteredRecords.forEach(r => {
      csv += `${r.id},"${r.username}","${r.featureName}",${r.date},${r.durationHours},${r.tokensUsed},"${r.project || 'N/A'}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=license_usage_report.csv');
    res.status(200).send(csv);
  });

  // --- Borrowing and Prior Authorization engine ---

  app.get('/api/borrow', (req, res) => {
    const db = readDB();
    res.json({ borrows: db.borrows });
  });

  app.post('/api/borrow/request', (req, res) => {
    const sender = (req as any).user;
    const { featureName, durationDays, host, reason, project, preemptionPriority } = req.body;

    if (!featureName || !durationDays || !host || !reason) {
      return res.status(400).json({ error: 'featureName, durationDays, host, and reason are required' });
    }

    const db = readDB();
    
    // Add pending borrow request
    const now = new Date();
    const limit = new Date(now.getTime() + durationDays * 24 * 3600000);

    const newBorrow: BorrowRecord = {
      id: `bor-${Date.now()}`,
      username: sender.username,
      featureName,
      host,
      borrowTime: now.toISOString(),
      limitTime: limit.toISOString(),
      durationDays: Number(durationDays),
      status: 'pending',
      preemptionPriority: preemptionPriority || 'medium',
      reason,
      project: project || sender.project
    };

    const prio = preemptionPriority || 'medium';
    let preemptionExecuted = false;
    let oustedUser = '';

    if (prio === 'high') {
      // Check if all slots containing featureName are fully saturated
      const serversWithFeature = db.servers.filter(srv => srv.features.some(f => f.name === featureName));
      const allSaturated = serversWithFeature.length > 0 && serversWithFeature.every(srv => {
        const feat = srv.features.find(f => f.name === featureName);
        return feat ? feat.used >= feat.total : true;
      });

      if (allSaturated) {
        const priorityScores: Record<string, number> = { 'low': 1, 'medium': 2, 'high': 3 };
        const reqPriorityScore = 3; // 'high'

        const getCheckoutPriority = (chk: any) => {
          if (chk.id && chk.id.startsWith('chk-borrow-')) {
            const bId = chk.id.substring(11);
            const originalBorrow = db.borrows.find((b: any) => b.id === bId);
            if (originalBorrow) {
              return originalBorrow.preemptionPriority || 'medium';
            }
          }
          const userObj = db.users.find((u: any) => u.username === chk.username);
          if (userObj) {
            if (userObj.role === 'Admin') return 'high';
            if (userObj.role === 'Manager') return 'medium';
            return 'low';
          }
          return 'low';
        };

        // Gather candidates
        let candidates: any[] = [];
        db.servers.forEach(srv => {
          const feat = srv.features.find(f => f.name === featureName);
          if (feat) {
            feat.checkouts.forEach(chk => {
              if (chk.username !== sender.username) {
                const chkPrio = getCheckoutPriority(chk);
                const score = priorityScores[chkPrio] || 1;
                if (score < reqPriorityScore) {
                  candidates.push({
                    server: srv,
                    feature: feat,
                    checkout: chk,
                    priority: chkPrio,
                    score: score,
                    time: new Date(chk.checkoutTime || 0).getTime()
                  });
                }
              }
            });
          }
        });

        if (candidates.length > 0) {
          // Sort candidates: lowest score first, then earliest check-out first (FIFO)
          candidates.sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            return a.time - b.time;
          });

          const bestTarget = candidates[0];
          const { server: targetServer, feature: targetFeature, checkout: targetCheckout } = bestTarget;
          oustedUser = targetCheckout.username;

          // Remove the ousted checkout
          const chkIdx = targetFeature.checkouts.findIndex((c: any) => c.id === targetCheckout.id);
          if (chkIdx !== -1) {
            targetFeature.checkouts.splice(chkIdx, 1);
          }

          // Mark preempted borrow if the ousted checkout was an offline borrow
          if (targetCheckout.id && targetCheckout.id.startsWith('chk-borrow-')) {
            const preemptedBorrowId = targetCheckout.id.substring(11);
            const preemptedBorrow = db.borrows.find((b: any) => b.id === preemptedBorrowId);
            if (preemptedBorrow) {
              preemptedBorrow.status = 'preempted';
            }
          }

          // Active the new high priority borrow instantly
          newBorrow.status = 'borrowed';
          newBorrow.approvedBy = 'Preemption Engine';

          // Add the checkout to server feature
          targetFeature.checkouts.push({
            id: `chk-borrow-${newBorrow.id}`,
            username: newBorrow.username,
            hostname: newBorrow.host,
            featureName: newBorrow.featureName,
            checkoutTime: new Date().toISOString(),
            project: newBorrow.project
          });

          // Log preemption event
          const preemptId = `pre-borrow-${Date.now()}`;
          db.preemptions.push({
            id: preemptId,
            featureName: newBorrow.featureName,
            preemptedUser: oustedUser,
            targetUser: newBorrow.username,
            serverId: targetServer.id,
            timestamp: new Date().toISOString(),
            status: 'active'
          });

          // Log critical core compliance alert
          db.compliance.push({
            id: `cmp-${Date.now()}`,
            severity: 'critical',
            type: 'unlicensed_usage',
            message: `License Preemption [High-Priority Borrow]: ${newBorrow.featureName}`,
            details: `High-priority offline borrow request satisfied immediately by preempting user '${oustedUser}' (priority: ${bestTarget.priority}) on server ${targetServer.id}.`,
            timestamp: new Date().toISOString()
          });

          preemptionExecuted = true;
        }
      } else {
        // Not fully saturated, find if any server can host it immediately
        let satSrv = null;
        let satFeat = null;
        for (const srv of db.servers) {
          const feat = srv.features.find(f => f.name === featureName);
          if (feat && feat.used < feat.total) {
            satSrv = srv;
            satFeat = feat;
            break;
          }
        }
        if (satSrv && satFeat) {
          satFeat.used += 1;
          satSrv.usedLicenses += 1;
          
          newBorrow.status = 'borrowed';
          newBorrow.approvedBy = 'System Auto-Approval';
          
          satFeat.checkouts.push({
            id: `chk-borrow-${newBorrow.id}`,
            username: newBorrow.username,
            hostname: newBorrow.host,
            featureName: newBorrow.featureName,
            checkoutTime: new Date().toISOString(),
            project: newBorrow.project
          });
          
          preemptionExecuted = false;
        }
      }
    }

    db.borrows.push(newBorrow);

    // Add compliance event indicating validation status
    db.compliance.push({
      id: `cmp-${Date.now()}`,
      severity: preemptionExecuted ? 'critical' : 'info',
      type: 'unauthorized_borrow',
      message: preemptionExecuted ? `Preemptive Auto-Borrow Approved: User ${sender.username}` : `New Borrow Request: User ${sender.username}`,
      details: preemptionExecuted 
        ? `High priority offline borrow request made by ${sender.username} immediately preempted lower-priority user '${oustedUser}' to fulfill checkout licenses.`
        : `User submitted authentication request to borrow checkout licensing for ${featureName} offline on node ${host}. Authorization pending.`,
      timestamp: now.toISOString()
    });

    writeDB(db);
    res.status(201).json({ borrow: newBorrow, preemptionExecuted, oustedUser });
  });

  // Approve / Reject authorization request (Admins and Managers)
  app.post('/api/borrow/:id/authorize', (req, res) => {
    const caller = (req as any).user;
    if (caller.role === 'Engineer') {
      return res.status(403).json({ error: 'Unauthorized. Only managers and admins can approve license borrowing.' });
    }

    const { id } = req.params;
    const { status } = req.body; // 'authorized' or 'rejected'

    if (status !== 'authorized' && status !== 'rejected') {
      return res.status(400).json({ error: 'Invalid state transition' });
    }

    const db = readDB();
    const idx = db.borrows.findIndex(b => b.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Borrow record not found' });

    const borrow = db.borrows[idx];
    borrow.status = status;
    borrow.approvedBy = caller.username;

    if (status === 'authorized') {
      // Transition from authorized to borrowed simulating actual client check-out payload
      borrow.status = 'borrowed';
      
      let checkoutSatisfied = false;

      // First pass: check if any server hosting the feature has an available license slot
      for (const srv of db.servers) {
        const feat = srv.features.find(f => f.name === borrow.featureName);
        if (feat && feat.used < feat.total) {
          feat.used += 1;
          srv.usedLicenses += 1;
          
          // Log active checkout in server specifically as a borrow format
          feat.checkouts.push({
            id: `chk-borrow-${borrow.id}`,
            username: borrow.username,
            hostname: borrow.host,
            featureName: borrow.featureName,
            checkoutTime: new Date().toISOString(),
            project: borrow.project
          });
          checkoutSatisfied = true;
          break; // Satisfied using a free slot
        }
      }

      // Second pass: if fully saturated and request has high/medium priority, attempt preemption of lowest-priority checkout
      if (!checkoutSatisfied && (borrow.preemptionPriority === 'high' || borrow.preemptionPriority === 'medium')) {
        const priorityScores: Record<string, number> = { 'low': 1, 'medium': 2, 'high': 3 };
        const reqPriorityScore = priorityScores[borrow.preemptionPriority] || 2;

        const getCheckoutPriority = (chk: any) => {
          if (chk.id && chk.id.startsWith('chk-borrow-')) {
            const bId = chk.id.substring(11);
            const originalBorrow = db.borrows.find((b: any) => b.id === bId);
            if (originalBorrow) {
              return originalBorrow.preemptionPriority || 'medium';
            }
          }
          const userObj = db.users.find((u: any) => u.username === chk.username);
          if (userObj) {
            if (userObj.role === 'Admin') return 'high';
            if (userObj.role === 'Manager') return 'medium';
            return 'low'; // Engineers default to low
          }
          return 'low';
        };

        // Gather all candidates from other users across all servers
        let candidates: any[] = [];
        db.servers.forEach(srv => {
          const feat = srv.features.find(f => f.name === borrow.featureName);
          if (feat) {
            feat.checkouts.forEach(chk => {
              if (chk.username !== borrow.username) {
                const prio = getCheckoutPriority(chk);
                const score = priorityScores[prio] || 1;
                if (score < reqPriorityScore) {
                  candidates.push({
                    server: srv,
                    feature: feat,
                    checkout: chk,
                    priority: prio,
                    score: score,
                    time: new Date(chk.checkoutTime || 0).getTime()
                  });
                }
              }
            });
          }
        });

        if (candidates.length > 0) {
          // Sort candidates: lowest prioritization score first, then earliest check-out first (FIFO)
          candidates.sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            return a.time - b.time;
          });

          const bestTarget = candidates[0];
          const { server: targetServer, feature: targetFeature, checkout: targetCheckout } = bestTarget;
          const oustedUser = targetCheckout.username;

          // Remove the ousted checkout from server feature checkouts
          const chkIdx = targetFeature.checkouts.findIndex((c: any) => c.id === targetCheckout.id);
          if (chkIdx !== -1) {
            targetFeature.checkouts.splice(chkIdx, 1);
          }

          // Mark preempted borrow if the ousted checkout was an offline borrow
          if (targetCheckout.id && targetCheckout.id.startsWith('chk-borrow-')) {
            const preemptedBorrowId = targetCheckout.id.substring(11);
            const preemptedBorrow = db.borrows.find((b: any) => b.id === preemptedBorrowId);
            if (preemptedBorrow) {
              preemptedBorrow.status = 'preempted';
            }
          }

          // Push the new borrow checkout into the preempted slot space
          targetFeature.checkouts.push({
            id: `chk-borrow-${borrow.id}`,
            username: borrow.username,
            hostname: borrow.host,
            featureName: borrow.featureName,
            checkoutTime: new Date().toISOString(),
            project: borrow.project
          });

          // Log preemption event in db
          const preemptId = `pre-borrow-${Date.now()}`;
          db.preemptions.push({
            id: preemptId,
            featureName: borrow.featureName,
            preemptedUser: oustedUser,
            targetUser: borrow.username,
            serverId: targetServer.id,
            timestamp: new Date().toISOString(),
            status: 'active'
          });

          // Log critical core compliance alert
          db.compliance.push({
            id: `cmp-${Date.now()}`,
            severity: 'critical',
            type: 'unlicensed_usage',
            message: `License Preemption [Offline Borrow]: ${borrow.featureName}`,
            details: `High-priority offline borrow request satisfied by preempting user '${oustedUser}' (priority: ${bestTarget.priority}) on server ${targetServer.id}. Ousted process was revoked.`,
            timestamp: new Date().toISOString()
          });

          checkoutSatisfied = true;
        }
      }
    }

    writeDB(db);
    res.json({ borrow });
  });

  // Return a borrowed license
  app.post('/api/borrow/:id/return', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const idx = db.borrows.findIndex(b => b.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Borrow record not found' });

    const borrow = db.borrows[idx];
    if (borrow.status !== 'borrowed') {
      return res.status(400).json({ error: 'Licensing block is not active inside borrow lock.' });
    }

    borrow.status = 'returned';

    // Release from server pool
    db.servers.forEach(srv => {
      const feat = srv.features.find(f => f.name === borrow.featureName);
      if (feat) {
        const chkIdx = feat.checkouts.findIndex(c => c.username === borrow.username && c.hostname === borrow.host);
        if (chkIdx !== -1) {
          feat.checkouts.splice(chkIdx, 1);
          feat.used = Math.max(0, feat.used - 1);
          srv.usedLicenses = Math.max(0, srv.usedLicenses - 1);
        }
      }
    });

    writeDB(db);
    res.json({ borrow });
  });

  // --- Preemption Engine ---

  app.get('/api/preemption', (req, res) => {
    const db = readDB();
    res.json({ preemptions: db.preemptions });
  });

  // Priority based preemption logic!
  // If high-priority request comes but licenses are fully checked out, preempt (kick out) a low-priority user checkout
  app.post('/api/preempt', (req, res) => {
    const caller = (req as any).user;
    const { serverId, featureName, targetUserPriority } = req.body; // 'high' priority requests virtuoso_layout, kicking out a 'low' priority one if full!
    
    if (!serverId || !featureName) {
      return res.status(400).json({ error: 'serverId and featureName are required' });
    }

    const db = readDB();
    const serverIdx = db.servers.findIndex(s => s.id === serverId);
    if (serverIdx === -1) return res.status(404).json({ error: 'Server not found' });
    
    const server = db.servers[serverIdx];
    const feature = server.features.find(f => f.name === featureName);
    if (!feature) return res.status(404).json({ error: 'Feature not found in server' });

    // Check if there is an active checkout to preempt
    if (feature.checkouts.length === 0) {
      return res.status(400).json({ error: `No active checkouts available to preempt for feature '${featureName}'` });
    }

    // In a real FlexLM environment, preemption is guided by options files or priority parameters.
    // Let's identify the checkout with the lowest priority user. Our pre-loaded "alex_k" is an Engineer.
    // Let's let the caller (Admin/Manager or High Priority user) preempt the checkout.
    const checkoutToPreemptIndex = feature.checkouts.findIndex(c => c.username !== caller.username);
    
    if (checkoutToPreemptIndex === -1) {
      return res.status(400).json({ error: 'No candidate checkouts by other users found to preempt.' });
    }

    const preemptedCheckout = feature.checkouts[checkoutToPreemptIndex];
    const oustedUser = preemptedCheckout.username;
    
    // Perform Preemption!
    // 1. Remove ousted checkout
    feature.checkouts.splice(checkoutToPreemptIndex, 1);
    
    // 2. Add caller's checkout
    const newChk: Checkout = {
      id: `chk-preempted-${Date.now()}`,
      username: caller.username,
      hostname: caller.host || 'admin-console',
      featureName: featureName,
      checkoutTime: new Date().toISOString(),
      project: caller.project || 'Project_Apollo'
    };
    feature.checkouts.push(newChk);

    // Preemption logging state
    const preemptId = `pre-${Date.now()}`;
    db.preemptions.push({
      id: preemptId,
      featureName,
      preemptedUser: oustedUser,
      targetUser: caller.username,
      serverId: server.id,
      timestamp: new Date().toISOString(),
      status: 'active'
    });

    // Add critical compliance alert for early preemption
    db.compliance.push({
      id: `cmp-${Date.now()}`,
      severity: 'critical',
      type: 'unlicensed_usage',
      message: `License Preemption Event Triggered: ${featureName}`,
      details: `User ${caller.username} (Admin/Priority High) automatically preempted and reclaimed index reservation slot from user ${oustedUser} on host ${preemptedCheckout.hostname}. Ousted process was sent SIGSTOP instructions.`,
      timestamp: new Date().toISOString()
    });

    writeDB(db);
    res.json({
      success: true,
      preemptedUser: oustedUser,
      targetUser: caller.username,
      featureName,
      message: `Successfully preempted user '${oustedUser}'. License allocated to user '${caller.username}'.`
    });
  });

  // --- License Compliance, Verification Auditing & Reports page ---

  app.get('/api/compliance', (req, res) => {
    const db = readDB();
    res.json({ compliance: db.compliance });
  });

  // Clear or re-trigger audit sweep
  app.post('/api/compliance/audit', (req, res) => {
    const db = readDB();
    const now = new Date();

    // Re-verify server dates and counts and construct dynamic results list
    const auditResults: LicenseComplianceIssue[] = [];

    db.servers.forEach(srv => {
      // Rule 1: Expiry scan (warning if < 30 days, critical if < 10 days, critical if expired)
      const serverLimitTime = new Date(srv.expiryDate).getTime();
      const differenceDays = (serverLimitTime - now.getTime()) / (24 * 3600000);

      if (srv.status === 'offline') {
        auditResults.push({
          id: `cmp-audit-srv-${srv.id}`,
          severity: 'critical',
          type: 'unlicensed_usage',
          message: `Server Connection Broken: ${srv.name}`,
          details: `Main licensing daemon located at ${srv.host}:${srv.port} is reported as offline. Active compilers or CAD binaries are blocking local compilation tasks.`,
          timestamp: now.toISOString()
        });
      }

      if (differenceDays < 0) {
        auditResults.push({
          id: `cmp-audit-srv-expired-${srv.id}`,
          severity: 'critical',
          type: 'approaching_expiry',
          message: `EXPIRED License file on Server: ${srv.name}`,
          details: `Licensing agreement expired on ${srv.expiryDate}. All vendor daemons are denying authorization checks.`,
          timestamp: now.toISOString()
        });
      } else if (differenceDays < 15) {
        auditResults.push({
          id: `cmp-audit-srv-warn-${srv.id}`,
          severity: 'critical',
          type: 'approaching_expiry',
          message: `CRITICAL LICENSE EXPIRATION: ${srv.name}`,
          details: `Licensing file is expiring in ${Math.ceil(differenceDays)} days on ${srv.expiryDate}. Immediate vendor update required.`,
          timestamp: now.toISOString()
        });
      } else if (differenceDays < 45) {
        auditResults.push({
          id: `cmp-audit-srv-info-${srv.id}`,
          severity: 'warning',
          type: 'approaching_expiry',
          message: `Server Renewal Pending: ${srv.name}`,
          details: `License window is expiring in ${Math.ceil(differenceDays)} days on ${srv.expiryDate}. File purchase requisition is in queue.`,
          timestamp: now.toISOString()
        });
      }

      // Feature specific scans
      srv.features.forEach(feat => {
        // Overcheckout scanning
        const fillPercentage = (feat.used / feat.total) * 100;
        if (fillPercentage >= 95) {
          auditResults.push({
            id: `cmp-audit-feat-exhausted-${feat.id}`,
            severity: 'critical',
            type: 'overcheckout',
            message: `EDA License Exhaustion on ${feat.name}`,
            details: `Feature saturation reached ${feat.used}/${feat.total} (100% capacity). Active developer compilation blocks are in queue, causing potential pipeline starvation.`,
            timestamp: now.toISOString()
          });
        } else if (fillPercentage >= 80) {
          auditResults.push({
            id: `cmp-audit-feat-high-${feat.id}`,
            severity: 'warning',
            type: 'overcheckout',
            message: `High concurrent usage on ${feat.name}`,
            details: `Licensing lockouts near threshold capacity (${feat.used}/${feat.total} checked out). Optimization recommends setting RESERVE rules in options file.`,
            timestamp: now.toISOString()
          });
        }
      });
    });

    // Scan for unreturned borrows that exceeded validity limit dates
    db.borrows.forEach(b => {
      if (b.status === 'borrowed' && new Date(b.limitTime).getTime() < now.getTime()) {
        auditResults.push({
          id: `cmp-audit-borrow-overdue-${b.id}`,
          severity: 'critical',
          type: 'unauthorized_borrow',
          message: `OVERDUE offline borrow: User ${b.username}`,
          details: `Offline FlexLM cell borrow on feature ${b.featureName} on node ${b.host} exceeded return authorization limit: ${b.limitTime}. Please contact user immediately or initiate override revocation.`,
          timestamp: now.toISOString()
        });
      }
    });

    // Merge static historic warnings
    const finalIssues = [...auditResults, ...db.compliance.filter(c => !c.id.startsWith('cmp-audit-'))];
    db.compliance = finalIssues;
    writeDB(db);

    res.json({ compliance: finalIssues });
  });

  // Delete/Clear single compliance issue
  app.delete('/api/compliance/:id', (req, res) => {
    const caller = (req as any).user;
    if (caller.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized. Admins only.' });
    }
    const { id } = req.params;
    const db = readDB();
    db.compliance = db.compliance.filter(c => c.id !== id);
    writeDB(db);
    res.json({ success: true, id });
  });

  // Smart analysis chatbot endpoint using server-side Gemini API (optional but powerful and elegant!)
  app.post('/api/gemini/compliance-optimization', async (req, res) => {
    const { consoleLogs, optionContent } = req.body;
    const ai = getGeminiSDK();
    
    if (!ai) {
      return res.json({
        advice: `### 🤖 Gemini Compliance Assistant (API Key Not Set)
Your Google Gemini API key is not currently active in the workspace settings. Here is static expert heuristics audit for your options config:

1. **Include/Exclude Optimization**: You currently have an exclude block: \`EXCLUDE spectre_simulator HOST rogue-node\`. Ensure the DNS can resolve \`rogue-node\` correctly to prevent loading errors in FlexLM.
2. **Reservation Strategy**: Your rule: \`RESERVE 5 virtuoso_layout GROUP IC_DESIGN_LEAD\` is good practice to ensure core engineers are not starved when density peaks.
3. **Approaching Expiry Alerts**: Set up cron notifications on Synopsys Cluster server to prevent 35 concurrent compilers from falling out on \`2026-06-01\`.`
      });
    }

    try {
      const prompt = `You are a professional FlexLM, licensing, and Electronic Design Automation (EDA) compliance auditor.
A client is running licensing servers (Cadence, Synopsys, Mentor).
Review the current server logs and active options rules. Provide a structured, scannable, expert, 3-point advice summary recommending optimizations to avoid licenses exhaustion, resolve borrowing limit gaps, and structure rules for reservation, exclude, and include.

Current active options rules & configuration:
${optionContent || 'None'}

Active licensing warnings & alerts:
${JSON.stringify(consoleLogs || [])}

Provide your advice formatted in pure clean markdown with short concise blocks.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction: 'You are a warm, clean, technical systems administrator assisting an EDA license expert.'
        }
      });

      res.json({ advice: response.text });
    } catch (err: any) {
      console.error('Error invoking Gemini SDK helper on server', err);
      res.json({
        advice: `### 🤖 Gemini Compliance Assistant (Heuristics Fallback)
An error occurred when querying Gemini: ${err.message || 'Unknown network error'}.

Heuristics Recommendations:
- Double check FlexLM license headers syntax lines.
- Set up automated preemption priority guidelines for virtuoso compiler licenses.`
      });
    }
  });

  // GET SMTP Settings
  app.get('/api/config/smtp', (req, res) => {
    const db = readDB();
    res.json({ smtpSettings: db.smtpSettings });
  });

  // POST SMTP Settings
  app.post('/api/config/smtp', (req, res) => {
    const caller = (req as any).user;
    if (caller.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized. Admins only.' });
    }
    const { host, port, username, senderName, senderEmail, recipients, tlsEnabled, alertsEnabled } = req.body;
    
    const db = readDB();
    db.smtpSettings = {
      ...db.smtpSettings,
      host: host || 'smtp.office365.com',
      port: Number(port) || 587,
      username: username || '',
      senderName: senderName || '',
      senderEmail: senderEmail || '',
      recipients: recipients || '',
      tlsEnabled: !!tlsEnabled,
      alertsEnabled: !!alertsEnabled,
      testStatus: 'idle',
      testLog: 'SMTP Settings saved successfully.'
    };
    writeDB(db);
    res.json({ smtpSettings: db.smtpSettings });
  });

  // POST SMTP TEST
  app.post('/api/config/smtp/test', (req, res) => {
    const caller = (req as any).user;
    if (caller.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized. Admins only.' });
    }

    const db = readDB();
    const smtp = db.smtpSettings;
    
    // Simulate SMTP delivery logs
    const timestampStr = new Date().toISOString();
    const mockSendingLog = `[${timestampStr}] [SMTP CONTROL] Initiating Office365 email channel testing via SMTP host: ${smtp.host} on port ${smtp.port}
[${timestampStr}] [SMTP CONTROL] Establishing socket stream link (security: TLS explicitly ${smtp.tlsEnabled ? 'enabled' : 'disabled'})...
[${timestampStr}] [SMTP CONTROL] Connection handshake succeeded. Banner text: 220 BY3PR05CA0101.outlook.office365.com
[${timestampStr}] [SMTP CONTROL] EHLO command response: 250-BY3PR05CA0101.outlook.office365.com Hello [13.111.4.2]...
[${timestampStr}] [SMTP CONTROL] STARTTLS active - tunnel established.
[${timestampStr}] [SMTP CONTROL] Authenticating account user: ${smtp.username} ...
[${timestampStr}] [SMTP CONTROL] Authentication completed (exit code 235: successfully logged in)
[${timestampStr}] [SMTP CONTROL] MAIL FROM: <${smtp.senderEmail}> - validated.
[${timestampStr}] [SMTP CONTROL] RCPT TO: <${smtp.recipients}> - accepted.
[${timestampStr}] [SMTP CONTROL] Sending email DATA stream payload...
[${timestampStr}] [SMTP CONTROL] Payload Transmission completed. Response code: 250 2.0.0 OK [Message-ID: <eda-${Date.now()}@flow.pro>]
[${timestampStr}] [SMTP CONTROL] Test email sent successfully! Recipient list [${smtp.recipients}] has been dispatched.`;

    db.smtpSettings.testStatus = 'success';
    db.smtpSettings.testLog = mockSendingLog;
    writeDB(db);

    res.json({ success: true, smtpSettings: db.smtpSettings });
  });

  // Console terminal command Logs
  app.get('/api/logs', (req, res) => {
    const db = readDB();
    res.json({ logs: db.commandLogs });
  });

  // Vite Integration in Development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production Assets serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EDA License System listening server running on port ${PORT}`);
  });
}

startServer();
