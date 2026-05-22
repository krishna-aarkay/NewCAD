import { LicenseServer, UserProfile, Checkout, UsageRecord, BorrowRecord, LicenseComplianceIssue, PreemptionTask, SmtpSettings } from '../types';

export interface DatabaseSchema {
  users: UserProfile[];
  servers: LicenseServer[];
  checkouts: Checkout[];
  usage: UsageRecord[];
  borrows: BorrowRecord[];
  preemptions: PreemptionTask[];
  compliance: LicenseComplianceIssue[];
  optionsFiles: Record<string, string>; // serverId -> content
  commandLogs: { id: string; timestamp: string; serverId: string; action: string; output: string }[];
  smtpSettings: SmtpSettings;
  defaultLoginsDisabled?: boolean;
}

export function generateInitialData(): DatabaseSchema {
  const nowStr = new Date().toISOString();
  
  // 1. Initial Users (empty list or placeholder, but wait - first login creation means the list starts empty,
  // or with a few demo accounts so the system has multiple roles straight away!)
  const users: UserProfile[] = [
    {
      id: 'usr-1',
      username: 'admin',
      email: 'sowjanyanarava541@gmail.com',
      role: 'Admin',
      notifications: {
        emailAlerts: true,
        expiryDaysThreshold: 30,
        checkoutAlerts: true,
        preemptionAlerts: true
      },
      group: 'IC_DESIGN_LEAD',
      host: 'headnode-01',
      project: 'Project_Apollo',
      password: 'admin'
    },
    {
      id: 'usr-2',
      username: 'alex_k',
      email: 'alex.k@company.corp',
      role: 'Engineer',
      notifications: {
        emailAlerts: true,
        expiryDaysThreshold: 15,
        checkoutAlerts: false,
        preemptionAlerts: true
      },
      group: 'PHYSICAL_DV',
      host: 'node-405',
      project: 'Project_Apollo',
      password: 'alex'
    },
    {
      id: 'usr-3',
      username: 'meera_s',
      email: 'meera.s@company.corp',
      role: 'Manager',
      notifications: {
        emailAlerts: true,
        expiryDaysThreshold: 45,
        checkoutAlerts: true,
        preemptionAlerts: false
      },
      group: 'DFT_TEAM',
      host: 'workstation-12',
      project: 'Project_Zephyr',
      password: 'meera'
    },
    {
      id: 'usr-4',
      username: 'chen_w',
      email: 'chen.w@company.corp',
      role: 'Engineer',
      notifications: {
        emailAlerts: false,
        expiryDaysThreshold: 15,
        checkoutAlerts: false,
        preemptionAlerts: true
      },
      group: 'IC_DESIGN_LEAD',
      host: 'node-110',
      project: 'Project_Apollo',
      password: 'chen'
    }
  ];

  // 2. Initial License Servers
  const servers: LicenseServer[] = [
    {
      id: 'srv-cadence',
      name: 'Cadence License Master',
      type: 'cadence',
      host: 'cadence-lic.corp.local',
      port: 5280,
      status: 'online',
      lastChecked: nowStr,
      totalLicenses: 150,
      usedLicenses: 82,
      expiryDate: '2026-11-20',
      features: [
        {
          id: 'feat-virtuoso',
          name: 'virtuoso_layout',
          total: 50,
          used: 35,
          expiryDate: '2026-11-20',
          checkouts: [
            { id: 'chk-1', username: 'admin', hostname: 'headnode-01', featureName: 'virtuoso_layout', checkoutTime: new Date(Date.now() - 3.5 * 3600000).toISOString(), project: 'Project_Apollo' },
            { id: 'chk-2', username: 'alex_k', hostname: 'node-405', featureName: 'virtuoso_layout', checkoutTime: new Date(Date.now() - 7.2 * 3600000).toISOString(), project: 'Project_Apollo' },
            { id: 'chk-3', username: 'chen_w', hostname: 'node-110', featureName: 'virtuoso_layout', checkoutTime: new Date(Date.now() - 1.1 * 3600000).toISOString(), project: 'Project_Apollo' }
          ]
        },
        {
          id: 'feat-innovus',
          name: 'innovus_place_route',
          total: 30,
          used: 18,
          expiryDate: '2026-08-15',
          checkouts: [
            { id: 'chk-4', username: 'alex_k', hostname: 'node-405', featureName: 'innovus_place_route', checkoutTime: new Date(Date.now() - 12 * 3600000).toISOString(), project: 'Project_Apollo' }
          ]
        },
        {
          id: 'feat-spectre',
          name: 'spectre_simulator',
          total: 70,
          used: 29,
          expiryDate: '2027-02-10',
          checkouts: []
        }
      ],
      licenseFileContent: `# FlexLM License File for Cadence
SERVER cadence-lic.corp.local ANY 5280
VENDOR cdslmd /apps/cadence/bin/cdslmd
FEATURE virtuoso_layout cdslmd 1.0 20-nov-2026 50 SIGN="A0F1"
FEATURE innovus_place_route cdslmd 1.0 15-aug-2026 30 SIGN="B2C5"
FEATURE spectre_simulator cdslmd 1.0 10-feb-2027 70 SIGN="DF8F"`,
      optionsFileContent: `# Cadence Options File
GROUP IC_DESIGN_LEAD admin chen_w
GROUP PHYSICAL_DV alex_k

# Reserve 5 virtuoso licenses for IC design lead group
RESERVE 5 virtuoso_layout GROUP IC_DESIGN_LEAD

# Exclude rogue hosts
EXCLUDE spectre_simulator HOST rogue-node`
    },
    {
      id: 'srv-synopsys',
      name: 'Synopsys Compiler Cluster',
      type: 'synopsys',
      host: 'synopsys-lic.corp.local',
      port: 27000,
      status: 'online',
      lastChecked: nowStr,
      totalLicenses: 100,
      usedLicenses: 43,
      expiryDate: '2026-06-01', // Approaching expiry! (Current time is June 2026?? Actually, local time is May 21st, 2026. This expires in 11 days!)
      features: [
        {
          id: 'feat-vcs',
          name: 'vcs_compiler',
          total: 50,
          used: 35,
          expiryDate: '2026-06-01',
          checkouts: [
            { id: 'chk-5', username: 'chen_w', hostname: 'node-110', featureName: 'vcs_compiler', checkoutTime: new Date(Date.now() - 4 * 3600000).toISOString(), project: 'Project_Apollo' },
            { id: 'chk-6', username: 'meera_s', hostname: 'workstation-12', featureName: 'vcs_compiler', checkoutTime: new Date(Date.now() - 15.5 * 3600000).toISOString(), project: 'Project_Zephyr' }
          ]
        },
        {
          id: 'feat-dc',
          name: 'design_compiler',
          total: 30,
          used: 6,
          expiryDate: '2026-09-30',
          checkouts: []
        },
        {
          id: 'feat-pt',
          name: 'prime_time_px',
          total: 20,
          used: 2,
          expiryDate: '2026-06-01',
          checkouts: []
        }
      ],
      licenseFileContent: `# FlexLM License File for Synopsys
SERVER synopsys-lic.corp.local ANY 27000
VENDOR snpslmd /apps/synopsys/bin/snpslmd
FEATURE vcs_compiler snpslmd 2026.06 01-jun-2026 50 SIGN="9BC0"
FEATURE design_compiler snpslmd 2026.09 30-sep-2026 30 SIGN="BC31"
FEATURE prime_time_px snpslmd 2026.06 01-jun-2026 20 SIGN="CC02"`,
      optionsFileContent: `# Synopsys Options File
GROUP DFT_TEAM meera_s

# Exclude old subnet
EXCLUDE vcs_compiler INTERNET 192.168.20.*`
    },
    {
      id: 'srv-mentor',
      name: 'Mentor Graphics Pool',
      type: 'mentor',
      host: 'mentor-lic.corp.local',
      port: 1717,
      status: 'offline', // Starts offline so users can trigger things!
      lastChecked: nowStr,
      totalLicenses: 60,
      usedLicenses: 0,
      expiryDate: '2026-12-31',
      features: [
        {
          id: 'feat-calibre-drc',
          name: 'calibre_drc',
          total: 40,
          used: 0,
          expiryDate: '2026-12-31',
          checkouts: []
        },
        {
          id: 'feat-calibre-lvs',
          name: 'calibre_lvs',
          total: 20,
          used: 0,
          expiryDate: '2026-12-31',
          checkouts: []
        }
      ],
      licenseFileContent: `# FlexLM License File for Mentor
SERVER mentor-lic.corp.local ANY 1717
VENDOR mgcld /apps/mentor/bin/mgcld
FEATURE calibre_drc mgcld 2026.12 31-dec-2026 40 SIGN="DF49"
FEATURE calibre_lvs mgcld 2026.12 31-dec-2026 20 SIGN="E2F1"`,
      optionsFileContent: `# Mentor Options File
# All default config`
    }
  ];

  // 3. Extracted live checkouts
  const checkouts: Checkout[] = [];
  servers.forEach(srv => {
    srv.features.forEach(feat => {
      feat.checkouts.forEach(chk => {
        checkouts.push(chk);
      });
    });
  });

  // 4. Usage Records for weekly/monthly analytics over the past 30 days
  const usage: UsageRecord[] = [];
  const startDay = new Date(Date.now() - 30 * 24 * 3600000);
  const featureNames = ['virtuoso_layout', 'innovus_place_route', 'spectre_simulator', 'vcs_compiler', 'design_compiler', 'prime_time_px', 'calibre_drc'];
  const testUsers = ['admin', 'alex_k', 'meera_s', 'chen_w', 'tom_phys', 'lucy_dft', 'brian_ana'];
  const projects = ['Project_Apollo', 'Project_Zephyr', 'Project_Titan', 'Internal_Core'];

  // Stably seed usage numbers
  let chkId = 1000;
  for (let d = 0; d < 30; d++) {
    const recordDate = new Date(startDay.getTime() + d * 24 * 3600000);
    const dateStr = recordDate.toISOString().split('T')[0];
    
    // Create random-like but stable records
    const recordsCount = Math.floor(4 + (d % 5) * 2); // 4, 6, 8, 10, 12...
    for (let r = 0; r < recordsCount; r++) {
      const idxUser = (d + r) % testUsers.length;
      const idxFeat = (d * 2 + r * 3) % featureNames.length;
      const idxProj = (d + r * 2) % projects.length;
      const hours = Math.floor(2 + (r % 7) * 2); 
      
      usage.push({
        id: `rec-${chkId++}`,
        username: testUsers[idxUser],
        featureName: featureNames[idxFeat],
        date: dateStr,
        durationHours: hours,
        tokensUsed: hours * 10,
        project: projects[idxProj]
      });
    }
  }

  // 5. Borrowing Records
  const borrows: BorrowRecord[] = [
    {
      id: 'bor-1',
      username: 'alex_k',
      featureName: 'virtuoso_layout',
      host: 'node-405-b',
      borrowTime: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
      limitTime: new Date(Date.now() + 5 * 24 * 3600000).toISOString(),
      durationDays: 7,
      status: 'borrowed',
      preemptionPriority: 'medium',
      reason: 'Field testing layouts offline at client hub.',
      approvedBy: 'admin',
      project: 'Project_Apollo'
    },
    {
      id: 'bor-2',
      username: 'chen_w',
      featureName: 'vcs_compiler',
      host: 'workstation-offline',
      borrowTime: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
      limitTime: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
      durationDays: 4,
      status: 'returned',
      preemptionPriority: 'low',
      reason: 'Home compilation testing with reduced bandwidth.',
      approvedBy: 'meera_s',
      project: 'Project_Apollo'
    },
    {
      id: 'bor-3',
      username: 'tom_phys',
      featureName: 'innovus_place_route',
      host: 'field-tablet-2',
      borrowTime: new Date().toISOString(),
      limitTime: new Date(Date.now() + 14 * 24 * 3600000).toISOString(),
      durationDays: 14,
      status: 'pending',
      preemptionPriority: 'medium',
      reason: 'On-site optimization on private testbed network.',
      project: 'Project_Titan'
    }
  ];

  // 6. Preemption Tasks
  const preemptions: PreemptionTask[] = [
    {
      id: 'pre-1',
      featureName: 'virtuoso_layout',
      preemptedUser: 'alex_k',
      targetUser: 'admin',
      serverId: 'srv-cadence',
      timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
      status: 'resolved'
    }
  ];

  // 7. Compliance Issues
  const compliance: LicenseComplianceIssue[] = [
    {
      id: 'cmp-1',
      severity: 'critical',
      type: 'unlicensed_usage',
      message: 'Unlicensed block attempts logged by user "alex_k"',
      details: 'User attempt on caliber_drc on offline Mentor master server (srv-mentor). Block rate occurred 14 times.',
      timestamp: new Date(Date.now() - 1.2 * 3600000).toISOString()
    },
    {
      id: 'cmp-2',
      severity: 'critical',
      type: 'approaching_expiry',
      message: 'Server License Expiration Warning: Synopsys Cluster',
      details: 'The license pool for synopsys-lic.corp.local (synopsys_compiler and prime_time_px) expires in 11 days (2026-06-01). Update license file to prevent downtime.',
      timestamp: new Date(Date.now() - 4 * 3600000).toISOString()
    },
    {
      id: 'cmp-3',
      severity: 'warning',
      type: 'overcheckout',
      message: 'High usage density on Cadence Virtuoso layout features',
      details: 'Feature virtuoso_layout index limit has reached 70% of total pool (35/50). Triggering priority alerts on queue levels.',
      timestamp: new Date(Date.now() - 8 * 3600000).toISOString()
    },
    {
      id: 'cmp-4',
      severity: 'info',
      type: 'unauthorized_borrow',
      message: 'Pending Borrow authorization alert limit',
      details: 'User tom_phys requested a 14-day borrow on innovus_place_route on server srv-cadence. Host verification pending.',
      timestamp: nowStr
    }
  ];

  const commandLogs = [
    {
      id: 'log-1',
      timestamp: nowStr,
      serverId: 'srv-cadence',
      action: 'lmreread',
      output: `lmutil - Copyright (c) 1989-2023 Flexera. All Rights Reserved.
Sending lmreread to cdslmd vendor daemon...
Rereading options file (/var/flexlm/options/cdslmd.opt)...
Successfully reregistered user groups and reservation lines.
Reread complete.`
    }
  ];

  return {
    users,
    servers,
    checkouts,
    usage,
    borrows,
    preemptions,
    compliance,
    optionsFiles: {
      'srv-cadence': servers[0].optionsFileContent || '',
      'srv-synopsys': servers[1].optionsFileContent || '',
      'srv-mentor': servers[2].optionsFileContent || '',
    },
    commandLogs,
    smtpSettings: {
      host: 'smtp.office365.com',
      port: 587,
      username: 'licensing@office365.corp',
      senderName: 'LicenseFlow Core Notifications',
      senderEmail: 'licensing@office365.corp',
      recipients: 'sowjanyanarava541@gmail.com',
      tlsEnabled: true,
      alertsEnabled: true,
      testStatus: 'idle',
      testLog: 'SMTP system initialized. Configure to test outgoing Office365 emails.'
    },
    defaultLoginsDisabled: false
  };
}
