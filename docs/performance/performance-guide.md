# Performance Tuning Guide

## System Performance

### Hardware Optimization

#### CPU Configuration
```bash
# Check current CPU governor
cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Set performance governor
for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
    echo performance > $cpu
done

# Disable CPU throttling
echo 0 > /sys/devices/system/cpu/intel_pstate/no_turbo
```

#### Memory Configuration
```bash
# Update system memory limits
cat >> /etc/sysctl.conf << EOF
vm.swappiness = 10
vm.dirty_ratio = 60
vm.dirty_background_ratio = 2
EOF

# Apply changes
sysctl -p

# Configure huge pages
echo 1024 > /proc/sys/vm/nr_hugepages
```

#### Disk Configuration
```bash
# Set I/O scheduler
echo deadline > /sys/block/sda/queue/scheduler

# Increase read-ahead buffer
blockdev --setra 16384 /dev/sda

# Configure disk mount options
# /etc/fstab
/dev/sda1 /data ext4 defaults,noatime,nodiratime,discard 0 0
```

### Network Optimization

#### TCP Configuration
```bash
# Update TCP settings
cat >> /etc/sysctl.conf << EOF
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 10
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15
EOF

# Apply changes
sysctl -p
```

#### Network Interface Configuration
```bash
# Configure network interface
cat > /etc/network/interfaces.d/eth0 << EOF
auto eth0
iface eth0 inet static
    address 10.0.0.1
    netmask 255.255.255.0
    mtu 9000
    txqueuelen 10000
EOF

# Apply changes
ifdown eth0 && ifup eth0
```

## Node Performance

### Besu Optimization

#### JVM Configuration
```bash
# Update JVM options in docker-compose.yml
services:
  besu:
    environment:
      BESU_OPTS: >-
        -Xms4g
        -Xmx8g
        -XX:+UseG1GC
        -XX:MaxGCPauseMillis=100
        -XX:+ParallelRefProcEnabled
        -XX:+HeapDumpOnOutOfMemoryError
```

#### Node Configuration
```toml
# config.toml
min-gas-price=1000000000
tx-pool-max-size=20000
tx-pool-retention-hours=999

cache-maximum-size=4096
cache-layers-maximum-size=256

metrics-enabled=true
metrics-host="0.0.0.0"
metrics-port=9545

rpc-http-max-active-connections=100
rpc-ws-max-active-connections=100
```

### Database Optimization

#### PostgreSQL Configuration
```bash
# Update postgresql.conf
cat >> /etc/postgresql/13/main/postgresql.conf << EOF
max_connections = 200
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 10485kB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 8
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
EOF

# Restart PostgreSQL
systemctl restart postgresql
```

#### Index Optimization
```sql
-- Create optimized indexes
CREATE INDEX CONCURRENTLY idx_transactions_hash ON transactions USING hash (hash);
CREATE INDEX CONCURRENTLY idx_blocks_number ON blocks USING btree (number);
CREATE INDEX CONCURRENTLY idx_logs_address ON logs USING hash (address);

-- Analyze tables
ANALYZE transactions;
ANALYZE blocks;
ANALYZE logs;
```

## Protocol Performance

### Smart Contract Optimization

#### Gas Optimization
```solidity
// Use packed storage
contract OptimizedStorage {
    // Pack variables into single storage slot
    struct UserInfo {
        uint128 balance;    // 16 bytes
        uint64 lastUpdate;  // 8 bytes
        uint64 flags;       // 8 bytes
    }
    
    // Use mapping for sparse data
    mapping(address => UserInfo) private userInfo;
    
    // Batch operations
    function batchUpdate(
        address[] calldata users,
        uint128[] calldata balances
    ) external {
        uint256 length = users.length;
        for (uint256 i = 0; i < length;) {
            UserInfo storage info = userInfo[users[i]];
            info.balance = balances[i];
            info.lastUpdate = uint64(block.timestamp);
            unchecked { ++i; }
        }
    }
}
```

#### Memory Management
```solidity
contract MemoryOptimized {
    // Use memory for large arrays
    function processLargeArray(uint256[] memory data) external {
        uint256 length = data.length;
        uint256[] memory results = new uint256[](length);
        
        // Process in memory
        for (uint256 i = 0; i < length;) {
            results[i] = process(data[i]);
            unchecked { ++i; }
        }
        
        // Batch storage updates
        updateStorage(results);
    }
    
    // Cache frequently accessed storage
    function complexCalculation() external {
        uint256 cachedValue = storageValue;
        
        for (uint256 i = 0; i < 100;) {
            cachedValue = calculate(cachedValue);
            unchecked { ++i; }
        }
        
        storageValue = cachedValue;
    }
}
```

### Protocol Parameters

#### Lending Protocol
```solidity
contract OptimizedLending {
    // Optimize utilization curve
    function calculateInterestRate(
        uint256 utilization
    ) public pure returns (uint256) {
        if (utilization < OPTIMAL_UTILIZATION) {
            return baseRate + (utilization * slope1) / PRECISION;
        }
        return baseRate + slope1 + 
            ((utilization - OPTIMAL_UTILIZATION) * slope2) / PRECISION;
    }
    
    // Batch liquidations
    function batchLiquidate(
        address[] calldata users,
        uint256[] calldata amounts
    ) external {
        uint256 length = users.length;
        for (uint256 i = 0; i < length;) {
            liquidatePosition(users[i], amounts[i]);
            unchecked { ++i; }
        }
    }
}
```

#### DEX Protocol
```solidity
contract OptimizedDEX {
    // Optimize price calculation
    function calculatePrice(
        uint256 baseReserve,
        uint256 quoteReserve
    ) public pure returns (uint256) {
        // Use binary approximation
        uint256 price = baseReserve;
        price = price * PRECISION / quoteReserve;
        return price;
    }
    
    // Batch swaps
    function batchSwap(
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external {
        uint256 length = tokens.length;
        for (uint256 i = 0; i < length - 1;) {
            swap(tokens[i], tokens[i + 1], amounts[i]);
            unchecked { ++i; }
        }
    }
}
```

## Monitoring Performance

### Prometheus Optimization

#### Storage Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

storage:
  tsdb:
    retention.time: 15d
    retention.size: 500GB
    wal-compression: true
    min-block-duration: 2h
    max-block-duration: 24h
```

#### Query Optimization
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'chain138'
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: '/metrics'
    scheme: 'http'
    static_configs:
      - targets: ['localhost:9545']
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        replacement: 'chain138-node'
```

### Grafana Optimization

#### Dashboard Optimization
```json
{
  "dashboard": {
    "refresh": "1m",
    "panels": [
      {
        "type": "graph",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "rate(ethereum_blockchain_height[5m])",
            "interval": "1m"
          }
        ],
        "options": {
          "dataLinks": []
        }
      }
    ]
  }
}
```

#### Query Optimization
```typescript
// Use efficient queries
const queries = {
  blockRate: 'rate(ethereum_blockchain_height[5m])',
  txPool: 'ethereum_transaction_pool_transactions',
  gasUsage: 'rate(ethereum_gas_used[5m])',
  peerCount: 'ethereum_peer_count'
};

// Batch queries
async function fetchMetrics() {
  const results = await Promise.all(
    Object.values(queries).map(query =>
      prometheusAPI.query({
        query,
        time: Date.now() / 1000
      })
    )
  );
  return results;
}
```

## Caching Strategy

### Application Cache

#### Redis Configuration
```yaml
# redis.conf
maxmemory 4gb
maxmemory-policy allkeys-lru
activerehashing yes
appendonly yes
appendfsync everysec
```

#### Cache Implementation
```typescript
import Redis from 'ioredis';

class CacheManager {
  private redis: Redis;
  private readonly TTL = 3600; // 1 hour
  
  constructor() {
    this.redis = new Redis({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: 3
    });
  }
  
  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set<T>(
    key: string,
    value: T,
    ttl: number = this.TTL
  ): Promise<void> {
    await this.redis.set(
      key,
      JSON.stringify(value),
      'EX',
      ttl
    );
  }
}
```

### Smart Contract Cache

#### Contract Storage Cache
```solidity
contract CacheOptimized {
    // Cache frequently accessed data
    struct Cache {
        uint256 lastUpdate;
        uint256 value;
        bool valid;
    }
    
    mapping(bytes32 => Cache) private cache;
    
    function getValue(bytes32 key) public view returns (uint256) {
        Cache memory cached = cache[key];
        if (cached.valid && 
            block.timestamp - cached.lastUpdate < CACHE_DURATION) {
            return cached.value;
        }
        
        uint256 value = computeExpensiveValue(key);
        cache[key] = Cache({
            lastUpdate: block.timestamp,
            value: value,
            valid: true
        });
        return value;
    }
}
```

#### Event Cache
```solidity
contract EventCache {
    // Cache event data
    event DataUpdated(
        bytes32 indexed key,
        uint256 value,
        uint256 timestamp
    );
    
    function updateData(bytes32 key, uint256 value) external {
        // Update storage
        data[key] = value;
        
        // Emit event for off-chain caching
        emit DataUpdated(key, value, block.timestamp);
    }
}
```

## Load Testing

### Performance Testing

#### Load Test Script
```typescript
import { ethers } from 'hardhat';
import { performance } from 'perf_hooks';

async function loadTest() {
  const contract = await ethers.getContract('TestContract');
  const iterations = 1000;
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await contract.testFunction();
    const end = performance.now();
    results.push(end - start);
  }
  
  console.log('Average time:', 
    results.reduce((a, b) => a + b) / results.length
  );
}
```

#### Stress Test Script
```typescript
async function stressTest() {
  const contract = await ethers.getContract('TestContract');
  const concurrency = 100;
  const iterations = 1000;
  
  const tasks = Array(concurrency).fill(0).map(async () => {
    for (let i = 0; i < iterations; i++) {
      await contract.testFunction();
    }
  });
  
  await Promise.all(tasks);
}
```

### Benchmarking

#### Contract Benchmarks
```solidity
contract Benchmark {
    uint256 public gasUsed;
    uint256 public executionTime;
    
    function benchmarkFunction() external {
        uint256 startGas = gasleft();
        uint256 startTime = block.timestamp;
        
        // Function to benchmark
        complexOperation();
        
        executionTime = block.timestamp - startTime;
        gasUsed = startGas - gasleft();
    }
}
```

#### API Benchmarks
```typescript
import { performance } from 'perf_hooks';

async function benchmarkAPI() {
  const endpoints = [
    '/api/v1/blocks',
    '/api/v1/transactions',
    '/api/v1/status'
  ];
  
  for (const endpoint of endpoints) {
    const start = performance.now();
    await fetch(`http://localhost:3000${endpoint}`);
    const end = performance.now();
    
    console.log(`${endpoint}: ${end - start}ms`);
  }
}
``` 