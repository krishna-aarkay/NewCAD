export type ServerType = 'cadence' | 'synopsys' | 'mentor' | 'other';

export interface Checkout {
  id: string;
  username: string;
  hostname: string;
  featureName: string;
  checkoutTime: string;
  durationMinutes?: number;
  project?: string;
}

export interface Feature {
  id: string;
  name: string;
  total: number;
  used: number;
  expiryDate: string;
  checkouts: Checkout[];
}

export interface LicenseServer {
  id: string;
  name: string;
  type: ServerType;
  host: string;
  port: number;
  status: 'online' | 'offline';
  lastChecked: string;
  totalLicenses: number;
  usedLicenses: number;
  expiryDate: string;
  features: Feature[];
  licenseFileContent?: string;
  optionsFileContent?: string;
  sshEnabled?: boolean;
  sshHost?: string;
  sshPort?: number;
  sshUsername?: string;
  sshPassword?: string;
}

export type UserRole = 'Admin' | 'Manager' | 'Engineer';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  notifications: {
    emailAlerts: boolean;
    expiryDaysThreshold: number;
    checkoutAlerts: boolean;
    preemptionAlerts: boolean;
  };
  group?: string;
  host?: string;
  project?: string;
}

export interface UsageRecord {
  id: string;
  username: string;
  featureName: string;
  date: string; // YYYY-MM-DD
  durationHours: number;
  tokensUsed: number;
  project?: string;
}

export interface OptionsRule {
  id: string;
  type: 'RESERVE' | 'EXCLUDE' | 'INCLUDE' | 'PREEMPT' | 'PRIORITY';
  count?: number; // count for RESERVE or level for PRIORITY
  feature: string;
  groupType: 'USER' | 'HOST' | 'INTERNET' | 'PROJECT' | 'GROUP' | 'HOST_GROUP';
  groupName: string;
}

export interface BorrowRecord {
  id: string;
  username: string;
  featureName: string;
  host: string;
  borrowTime: string;
  limitTime: string;
  durationDays: number;
  status: 'pending' | 'authorized' | 'borrowed' | 'returned' | 'rejected' | 'preempted';
  preemptionPriority: 'high' | 'medium' | 'low';
  reason: string;
  approvedBy?: string;
  project?: string;
}

export interface PreemptionTask {
  id: string;
  featureName: string;
  preemptedUser: string;
  targetUser: string;
  serverId: string;
  timestamp: string;
  status: 'active' | 'resolved';
}

export interface LicenseComplianceIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'unlicensed_usage' | 'approaching_expiry' | 'overcheckout' | 'unauthorized_borrow';
  message: string;
  details: string;
  timestamp: string;
}

export interface SmtpSettings {
  host: string;
  port: number;
  username: string;
  senderName: string;
  senderEmail: string;
  recipients: string;
  tlsEnabled: boolean;
  alertsEnabled: boolean;
  testStatus?: 'idle' | 'success' | 'failure' | 'sending';
  testLog?: string;
}
