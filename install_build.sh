#!/bin/bash

# ==============================================================================
# EDA License Manager - RHEL 10 Enterprise Automation Installation & Build Tool
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# Visual formatting helper colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}             EDA License Manager - Enterprise Installer                 ${NC}"
echo -e "${CYAN}                  Platform Scope: Red Hat Enterprise Linux 10           ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# 1. Root Privilege Escalation Validation
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] This installer requires root privileges to configure Systemd and firewalls.${NC}"
  echo -e "Please execute the script using sudo or command elevation:"
  echo -e "  ${YELLOW}sudo bash install_build.sh${NC}"
  exit 1
fi

# Detect actual user (when run under sudo)
REAL_USER=${SUDO_USER:-$USER}
REAL_USER_HOME=$(eval echo ~$REAL_USER)
CURRENT_DIR=$(pwd)

echo -e "${BLUE}[INFO] System directories parsed:${NC}"
echo -e "  - Installation Target Path: ${YELLOW}$CURRENT_DIR${NC}"
echo -e "  - Service Execution Owner : ${YELLOW}$REAL_USER${NC}"
echo -e "  - Home Storage Directory  : ${YELLOW}$REAL_USER_HOME${NC}"
echo -e ""

# 2. Check System compatibility
echo -e "${BLUE}[1/6] Validating RHEL 10 distribution compatibility...${NC}"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  echo -e "  - Detected OS : ${GREEN}$NAME${NC}"
  echo -e "  - Version ID  : ${GREEN}$VERSION_ID${NC}"
  
  if [[ "$ID" != "rhel" && "$ID" != "centos" && "$ID" != "rocky" && "$ID" != "almalinux" ]]; then
    echo -e "${YELLOW}[WARNING] System is not verified as a Red Hat derivative. Attempting agnostic fit...${NC}"
  fi
else
  echo -e "${YELLOW}[WARNING] Could not parse /etc/os-release. Continuing installation...${NC}"
fi

# 3. Installing Prerequisites
echo -e "\n${BLUE}[2/6] Syncing dnf repositories & installing pre-requisites...${NC}"
# Packages required: nodejs (v18+ for Vite capabilities), git, tar
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  echo -e "  - Node.js already present: ${GREEN}$NODE_VER${NC}"
else
  echo -e "  - Installing Node.js & NPM via DNF AppStream modules..."
  dnf install -y nodejs npm git
fi

# Confirm Node version is suitable (Vite requires Node 18+)
NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo -e "${RED}[ERROR] Modern React frameworks require Node.js >= 18. Detected: v$NODE_MAJOR.${NC}"
  echo -e "Please upgrade your Node.js engine and try again."
  exit 1
fi

# 4. Restoring Dependencies & Building App
echo -e "\n${BLUE}[3/6] Restoring workspace package tree & compiling application assets...${NC}"
# Ensure ownership of directories is preserved
chown -R $REAL_USER:$REAL_USER "$CURRENT_DIR"

# Switch to real user to run safe npm installs/compiles
echo -e "  - Running clean NPM build cycle..."
sudo -u $REAL_USER npm install --log-level=warn

echo -e "  - Transpiling React components & creating static bundles..."
sudo -u $REAL_USER npm run build

# Verify build output
if [ ! -d "dist" ] || [ ! -f "dist/server.cjs" ]; then
  echo -e "${RED}[ERROR] Build output directory or 'dist/server.cjs' was not compiled successfully.${NC}"
  exit 1
fi
echo -e "  - Asset bundling complete: ${GREEN}dist/server.cjs successfully verified.${NC}"

# Ensure correct file permissions
chown -R $REAL_USER:$REAL_USER "$CURRENT_DIR"

# 5. Enterprise Systemd Service Provisioning
echo -e "\n${BLUE}[4/6] Provisioning RHEL Systemd Service for EDA License Manager...${NC}"
SERVICE_FILE="/etc/systemd/system/eda-license-manager.service"

cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=EDA License Manager Dashboard Service
After=network.target

[Service]
Type=simple
User=$REAL_USER
WorkingDirectory=$CURRENT_DIR
ExecStart=$(command -v node) dist/server.cjs
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=eda-license-manager
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo -e "  - Systemd service configuration created at: ${YELLOW}$SERVICE_FILE${NC}"
echo -e "  - Registering service and reloading daemon profiles..."
systemctl daemon-reload
systemctl enable eda-license-manager.service

# 6. Local Firewall Rules Configuration
echo -e "\n${BLUE}[5/6] Opening network ingress ports via firewalld (Port 3000)...${NC}"
if systemctl is-active --quiet firewalld; then
  echo -e "  - Firewalld active. Requesting permanent ingress allowance for TCP port 3000..."
  firewall-cmd --permanent --add-port=3000/tcp
  firewall-cmd --reload
  echo -e "  - Ingress port updated: ${GREEN}TCP 3000 opened.${NC}"
else
  echo -e "  - Firewalld is inactive. Skipping firewall configuration. (Please ensure Port 3000 is open in your local network security groups)${NC}"
fi

# 7. Start the Service
echo -e "\n${BLUE}[6/6] Starting EDA License Manager background workers...${NC}"
systemctl restart eda-license-manager.service

# Verification check
sleep 2
if systemctl is-active --quiet eda-license-manager; then
  echo -e "  - Engine running: ${GREEN}Active (running) verified successfully!${NC}"
else
  echo -e "  - ${YELLOW}[WARNING] Service started, but could not immediately verify active state. Run 'journalctl -u eda-license-manager' to diagnose.${NC}"
fi

# Clear visual boundary output
IP_ADDRESSES=$(hostname -I | awk '{print $1}')
if [ -z "$IP_ADDRESSES" ]; then
  IP_ADDRESSES="YOUR_RHEL_IP"
fi

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN}             SUCCESS! EDA LICENSE MANAGER INSTALLED SUCCESSFULLY       ${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo -e "The EDA License Manager service is now fully registered and running on your RHEL 10 host."
echo -e ""
echo -e "${CYAN}1. NETWORK ACCESS CHANNELS:${NC}"
echo -e "   - Web Client Address  : ${YELLOW}http://${IP_ADDRESSES}:3000${NC}"
echo -e "   - Intranet / Host Link: ${YELLOW}http://localhost:3000${NC}"
echo -e ""
echo -e "${CYAN}2. PROCESS MANAGEMENT COMMANDS:${NC}"
echo -e "   - Start Service       : ${GREEN}sudo systemctl start eda-license-manager${NC}"
echo -e "   - Stop Service        : ${RED}sudo systemctl stop eda-license-manager${NC}"
echo -e "   - Restart / Reload    : ${YELLOW}sudo systemctl restart eda-license-manager${NC}"
echo -e "   - Status Check        : ${CYAN}sudo systemctl status eda-license-manager${NC}"
echo -e "   - Live Stream Logs    : ${CYAN}sudo journalctl -u eda-license-manager -f${NC}"
echo -e ""
echo -e "${CYAN}3. HOW TO APPLY FUTURE UPDATES OR CHANGES:${NC}"
echo -e "   When you pull new modifications from your git repository, run these exact command routines:"
echo -e "   ${YELLOW}cd $CURRENT_DIR${NC}"
echo -e "   ${YELLOW}git pull${NC}"
echo -e "   ${YELLOW}sudo npm install${NC}"
echo -e "   ${YELLOW}sudo npm run build${NC}"
echo -e "   ${YELLOW}sudo systemctl restart eda-license-manager${NC}"
echo -e ""
echo -e "Database State File is stored at : ${YELLOW}$CURRENT_DIR/db.json${NC} (Backup this file to save server histories)."
echo -e "${GREEN}======================================================================${NC}"
