# Security Hardening Guide

## System Security

### Operating System Hardening

#### User Management
1. Restrict root access:
   ```bash
   # Disable root login
   sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
   
   # Enforce key-based authentication
   sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
   ```

2. Configure user permissions:
   ```bash
   # Create service user
   useradd -r -s /bin/false chain138
   
   # Set directory permissions
   chown -R chain138:chain138 /opt/chain138
   chmod 700 /opt/chain138/keys
   ```

#### Network Security
1. Configure firewall:
   ```bash
   # Allow essential ports
   ufw allow 22/tcp
   ufw allow 8545/tcp
   ufw allow 30303/tcp
   
   # Enable firewall
   ufw enable
   ```

2. Setup fail2ban:
   ```bash
   # Install fail2ban
   apt-get install fail2ban
   
   # Configure jail
   cat > /etc/fail2ban/jail.local << EOF
   [sshd]
   enabled = true
   bantime = 3600
   findtime = 600
   maxretry = 3
   EOF
   ```

### Docker Security

#### Container Hardening
1. Secure daemon:
   ```json
   # /etc/docker/daemon.json
   {
     "userns-remap": "default",
     "live-restore": true,
     "userland-proxy": false,
     "no-new-privileges": true
   }
   ```

2. Container limits:
   ```yaml
   # docker-compose.yml security additions
   services:
     besu-node:
       security_opt:
         - no-new-privileges:true
       read_only: true
       tmpfs:
         - /tmp
       ulimits:
         nofile:
           soft: 65536
           hard: 65536
   ```

### Network Security

#### TLS Configuration
1. Generate certificates:
   ```bash
   # Generate CA
   openssl req -x509 -new -newkey rsa:4096 -keyout ca.key -out ca.crt -days 365 -nodes
   
   # Generate node certificate
   openssl req -new -newkey rsa:4096 -keyout node.key -out node.csr -nodes
   openssl x509 -req -in node.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out node.crt
   ```

2. Configure TLS:
   ```toml
   # config.toml
   tls-keystore-file="/path/to/keystore.jks"
   tls-keystore-password-file="/path/to/keystore.password"
   tls-trust-store-file="/path/to/truststore.jks"
   tls-trust-store-password-file="/path/to/truststore.password"
   ```

#### Network Isolation
1. Configure VLANs:
   ```bash
   # Create VLAN interface
   ip link add link eth0 name eth0.100 type vlan id 100
   
   # Configure IP
   ip addr add 10.0.0.1/24 dev eth0.100
   ```

2. Setup network policies:
   ```yaml
   # network-policy.yaml
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: restrict-access
   spec:
     podSelector:
       matchLabels:
         app: chain138
     ingress:
     - from:
       - podSelector:
           matchLabels:
             role: validator
   ```

## Blockchain Security

### Node Security

#### Key Management
1. Generate secure keys:
   ```bash
   # Generate node key
   besu operator generate-blockchain-config \
     --config-file=config.toml \
     --to=networkFiles \
     --private-key-file-name=key
   
   # Secure key storage
   chmod 600 networkFiles/key
   ```

2. Configure HSM:
   ```yaml
   # hsm-config.yaml
   provider: "pkcs11"
   library: "/usr/local/lib/softhsm/libsofthsm2.so"
   slot: "0"
   pin: "1234"
   ```

#### Access Control
1. Configure permissions:
   ```json
   # permissions-config.json
   {
     "nodes": {
       "permissioningMode": "strict",
       "allowlist": []
     },
     "accounts": {
       "permissioningMode": "strict",
       "allowlist": []
     }
   }
   ```

2. Setup role-based access:
   ```solidity
   // RoleManager.sol
   contract RoleManager {
     bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
     bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
     
     function grantValidatorRole(address account) external onlyAdmin {
       _grantRole(VALIDATOR_ROLE, account);
     }
   }
   ```

### Smart Contract Security

#### Contract Hardening
1. Implement security patterns:
   ```solidity
   // Secure contract pattern
   contract SecureContract {
     using SafeMath for uint256;
     using Address for address;
     
     // Reentrancy guard
     modifier nonReentrant() {
       require(_notEntered, "ReentrancyGuard: reentrant call");
       _notEntered = false;
       _;
       _notEntered = true;
     }
     
     // Pausable
     modifier whenNotPaused() {
       require(!paused(), "Pausable: paused");
       _;
     }
   }
   ```

2. Access control implementation:
   ```solidity
   // Access control
   contract AccessControlled {
     mapping(bytes32 => mapping(address => bool)) private _roles;
     
     modifier onlyRole(bytes32 role) {
       require(hasRole(role, msg.sender), "AccessControl: unauthorized");
       _;
     }
     
     function hasRole(bytes32 role, address account) public view returns (bool) {
       return _roles[role][account];
     }
   }
   ```

#### Audit Procedures
1. Static analysis:
   ```bash
   # Run Slither
   slither contracts/ --detect reentrancy,uninitialized-state
   
   # Run Mythril
   myth analyze contracts/Contract.sol
   ```

2. Test coverage:
   ```bash
   # Run coverage
   npx hardhat coverage
   
   # Generate report
   npx hardhat coverage --report html
   ```

## Privacy Security

### Privacy Group Security

#### Group Management
1. Secure creation:
   ```typescript
   async function createSecurePrivacyGroup(members: string[]) {
     // Validate members
     members.forEach(validateMember);
     
     // Create group with encryption
     const group = await privacyManager.createGroup({
       members,
       encryption: "AES-256-GCM"
     });
     
     return group;
   }
   ```

2. Access control:
   ```solidity
   // PrivacyGroupManager.sol
   contract PrivacyGroupManager {
     mapping(bytes32 => mapping(address => bool)) private groupMembers;
     
     modifier onlyGroupMember(bytes32 groupId) {
       require(groupMembers[groupId][msg.sender], "Not a group member");
       _;
     }
   }
   ```

#### Data Protection
1. Encryption configuration:
   ```json
   // privacy-config.json
   {
     "encryption": {
       "mode": "AES-256-GCM",
       "keyLength": 256,
       "provider": "native"
     },
     "storage": {
       "type": "encrypted",
       "path": "/secure/privacy/data"
     }
   }
   ```

2. Key rotation:
   ```typescript
   async function rotateGroupKeys(groupId: string) {
     // Generate new keys
     const newKeys = await cryptoService.generateKeys();
     
     // Update group
     await privacyManager.updateGroupKeys(groupId, newKeys);
     
     // Notify members
     await notifyKeyRotation(groupId, newKeys.publicKey);
   }
   ```

## Monitoring Security

### Metrics Security

#### Secure Collection
1. Configure authentication:
   ```yaml
   # prometheus.yml
   basic_auth_users:
     admin: $2y$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5yoK3HHHxZz2
   ```

2. TLS configuration:
   ```yaml
   # prometheus-tls.yml
   tls_config:
     cert_file: /etc/prometheus/cert.pem
     key_file: /etc/prometheus/key.pem
     client_ca_file: /etc/prometheus/ca.pem
   ```

#### Alert Security
1. Secure notifications:
   ```yaml
   # alertmanager.yml
   receivers:
     - name: 'secure-slack'
       slack_configs:
         - api_url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX'
           send_resolved: true
           http_config:
             tls_config:
               cert_file: /etc/alertmanager/cert.pem
               key_file: /etc/alertmanager/key.pem
   ```

### Log Security

#### Secure Logging
1. Configure log encryption:
   ```yaml
   # logging-config.yml
   logging:
     encryption:
       enabled: true
       key_file: /etc/chain138/log-encryption-key
     rotation:
       max_size: 100M
       max_files: 10
   ```

2. Log shipping:
   ```yaml
   # filebeat.yml
   filebeat.inputs:
   - type: log
     paths:
       - /var/log/chain138/*.log
     fields_under_root: true
     fields:
       environment: production
   output.elasticsearch:
     hosts: ["elasticsearch:9200"]
     protocol: "https"
     ssl.certificate_authorities: ["ca.pem"]
     ssl.certificate: "client.pem"
     ssl.key: "client.key"
   ```

## Emergency Response

### Incident Response

#### Response Procedures
1. Detection:
   ```bash
   # Check for anomalies
   ./scripts/detect-anomalies.sh
   
   # Monitor critical metrics
   curl -s localhost:9090/api/v1/query?query=critical_alerts
   ```

2. Containment:
   ```bash
   # Isolate affected components
   ./scripts/isolate-component.sh COMPONENT_ID
   
   # Enable enhanced logging
   ./scripts/enable-debug-logging.sh
   ```

#### Recovery Procedures
1. System recovery:
   ```bash
   # Verify system integrity
   ./scripts/verify-integrity.sh
   
   # Restore from secure backup
   ./scripts/restore-secure-backup.sh
   ```

2. Post-incident:
   ```bash
   # Generate incident report
   ./scripts/generate-incident-report.sh
   
   # Update security measures
   ./scripts/update-security.sh
   ```

## Compliance

### Audit Requirements

#### Audit Logging
1. Configure audit logs:
   ```yaml
   # audit-config.yml
   audit:
     enabled: true
     log_path: /var/log/chain138/audit.log
     fields:
       - timestamp
       - user
       - action
       - resource
       - result
   ```

2. Log rotation:
   ```bash
   # /etc/logrotate.d/chain138-audit
   /var/log/chain138/audit.log {
     daily
     rotate 90
     compress
     delaycompress
     notifempty
     create 0640 chain138 chain138
   }
   ```

#### Compliance Reporting
1. Generate reports:
   ```bash
   # Generate compliance report
   ./scripts/generate-compliance-report.sh
   
   # Verify compliance status
   ./scripts/verify-compliance.sh
   ```

2. Maintain evidence:
   ```bash
   # Collect compliance evidence
   ./scripts/collect-evidence.sh
   
   # Archive compliance data
   ./scripts/archive-compliance-data.sh
   ``` 