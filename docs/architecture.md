# Chain 138 Architecture

## System Architecture

```mermaid
graph TB
    subgraph Blockchain Layer
        BESU[Besu Node]
        TESS[Tessera Privacy Manager]
        PERM[Permissioning Service]
    end

    subgraph Cross-Chain Layer
        CCIP[Chainlink CCIP]
        AMB[Arbitrary Message Bridge]
        ORACLE[Oracle Network]
    end

    subgraph DeFi Layer
        AAVE[Aave v3]
        DODO[Dodoex]
        LIDO[Lido]
        MAKER[MakerDAO]
        METH[mETH]
    end

    subgraph Monitoring Layer
        PROM[Prometheus]
        GRAF[Grafana]
        ALERT[AlertManager]
        NODE[Node Exporter]
    end

    BESU --> TESS
    BESU --> PERM
    BESU --> CCIP
    BESU --> AMB
    ORACLE --> CCIP
    ORACLE --> AMB
    
    AAVE --> BESU
    DODO --> BESU
    LIDO --> BESU
    MAKER --> BESU
    METH --> BESU

    PROM --> BESU
    PROM --> TESS
    PROM --> NODE
    GRAF --> PROM
    ALERT --> PROM
```

## Component Interactions

### 1. Blockchain Core
- **Besu Node**: Primary blockchain node running IBFT 2.0 consensus
- **Tessera**: Handles private transactions and privacy group management
- **Permissioning**: Manages node and account access control

### 2. Cross-Chain Infrastructure
- **CCIP**: Handles cross-chain token transfers and message passing
- **AMB**: Manages arbitrary message bridging between chains
- **Oracle Network**: Provides external data and cross-chain validation

### 3. DeFi Protocols
- **Aave v3**: Lending and borrowing protocol
- **Dodoex**: Decentralized exchange with PMM
- **Lido**: Liquid staking protocol
- **MakerDAO**: Stablecoin and CDP system
- **mETH**: Managed ETH staking solution

### 4. Monitoring Stack
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notification
- **Node Exporter**: System metrics collection

## Network Architecture

```mermaid
graph LR
    subgraph Public Network
        VAL1[Validator 1]
        VAL2[Validator 2]
        VAL3[Validator 3]
        VAL4[Validator 4]
    end

    subgraph Private Network
        PRIV1[Private Node 1]
        PRIV2[Private Node 2]
        TESS1[Tessera 1]
        TESS2[Tessera 2]
    end

    subgraph Infrastructure
        IPFS[IPFS Node]
        GRAPH[Graph Node]
        PG[PostgreSQL]
    end

    VAL1 <--> VAL2
    VAL2 <--> VAL3
    VAL3 <--> VAL4
    VAL4 <--> VAL1

    PRIV1 <--> TESS1
    PRIV2 <--> TESS2
    TESS1 <--> TESS2

    PRIV1 --> IPFS
    PRIV1 --> GRAPH
    GRAPH --> PG
```

## Data Flow

### Transaction Flow
1. Public Transactions
   - Submitted to Besu nodes
   - Validated by permissioning service
   - Processed by IBFT consensus
   - Included in blocks

2. Private Transactions
   - Submitted to Tessera
   - Encrypted and distributed to privacy group
   - Private state updated
   - Public hash recorded on chain

### Cross-Chain Operations
1. CCIP Flow
   - Source chain locks tokens
   - CCIP relayers validate
   - Destination chain mints tokens
   - Events emitted and monitored

2. AMB Flow
   - Source chain emits message
   - AMB relayers validate
   - Destination chain executes
   - Status tracked and monitored

## Security Architecture

### Network Security
- TLS encryption for all communications
- Node authentication via certificates
- Private network isolation
- Rate limiting on public endpoints

### Privacy Security
- Zero-knowledge privacy groups
- Private state isolation
- Encrypted P2P communication
- Key rotation policies

### Monitoring Security
- Secure metric collection
- Encrypted alert notifications
- Access control for dashboards
- Audit logging

## Scaling Considerations

### Horizontal Scaling
- Additional validator nodes
- Read replica nodes
- Multiple privacy managers
- Load balanced endpoints

### Vertical Scaling
- Resource allocation
- Database optimization
- Cache configuration
- Network capacity

## Deployment Architecture

```mermaid
graph TB
    subgraph Production
        PROD_LB[Load Balancer]
        PROD_N1[Node 1]
        PROD_N2[Node 2]
        PROD_MON[Monitoring]
    end

    subgraph Staging
        STAGE_N[Node]
        STAGE_MON[Monitoring]
    end

    subgraph Development
        DEV_N[Node]
        DEV_MON[Monitoring]
    end

    PROD_LB --> PROD_N1
    PROD_LB --> PROD_N2
    PROD_N1 --> PROD_MON
    PROD_N2 --> PROD_MON

    STAGE_N --> STAGE_MON
    DEV_N --> DEV_MON
``` 