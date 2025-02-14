# Governance Guide

## Overview

### Governance Model
1. Token-Based Governance
   - Voting power based on token holdings
   - Delegation mechanism
   - Time-lock for execution
2. Multi-Signature Governance
   - Admin operations
   - Emergency actions
   - Parameter updates

## Governance Implementation

### Token Configuration
```solidity
// GovernanceToken.sol
contract GovernanceToken is
    ERC20Votes,
    ERC20Permit
{
    constructor()
        ERC20("Chain138 Governance", "C138")
        ERC20Permit("Chain138 Governance")
    {
        _mint(msg.sender, 1000000000 * 10**18);
    }
    
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._afterTokenTransfer(from, to, amount);
    }
    
    function _mint(
        address to,
        uint256 amount
    ) internal override {
        super._mint(to, amount);
    }
    
    function _burn(
        address from,
        uint256 amount
    ) internal override {
        super._burn(from, amount);
    }
}
```

### Proposal System
```solidity
// Governance.sol
contract Governance is
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorTimelockControlUpgradeable,
    GovernorVotesUpgradeable,
    GovernorVotesQuorumFractionUpgradeable
{
    function initialize(
        IVotes _token,
        TimelockController _timelock
    ) public initializer {
        __Governor_init("Chain138 Governance");
        __GovernorSettings_init(
            1 days, // Voting delay
            1 weeks, // Voting period
            100000 * 10**18 // Proposal threshold
        );
        __GovernorTimelockControl_init(_timelock);
        __GovernorVotes_init(_token);
        __GovernorVotesQuorumFraction_init(4); // 4% quorum
    }
    
    function proposalThreshold()
        public
        view
        override
        returns (uint256)
    {
        return super.proposalThreshold();
    }
    
    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override {
        super._execute(
            proposalId,
            targets,
            values,
            calldatas,
            descriptionHash
        );
    }
}
```

## Proposal Creation

### Proposal Types
```typescript
// proposal-types.ts
interface Proposal {
  id: string;
  title: string;
  description: string;
  targets: string[];
  values: string[];
  signatures: string[];
  calldatas: string[];
  startBlock: number;
  endBlock: number;
  proposer: string;
}

enum ProposalState {
  Pending,
  Active,
  Canceled,
  Defeated,
  Succeeded,
  Queued,
  Expired,
  Executed
}
```

### Proposal Creation
```typescript
// create-proposal.ts
async function createProposal(
  proposal: Proposal
): Promise<string> {
  // Validate proposal
  await validateProposal(proposal);
  
  // Create proposal
  const tx = await governance.propose(
    proposal.targets,
    proposal.values,
    proposal.signatures,
    proposal.calldatas,
    proposal.description
  );
  
  // Wait for confirmation
  const receipt = await tx.wait();
  
  // Get proposal ID
  const event = receipt.events?.find(
    e => e.event === 'ProposalCreated'
  );
  
  return event?.args?.proposalId;
}
```

## Voting System

### Vote Configuration
```solidity
// VotingConfig.sol
contract VotingConfig {
    struct VotingParams {
        uint256 delay;
        uint256 period;
        uint256 threshold;
        uint256 quorum;
    }
    
    VotingParams public params;
    
    event VotingParamsUpdated(VotingParams params);
    
    function setVotingParams(
        VotingParams memory _params
    ) external onlyGovernance {
        params = _params;
        emit VotingParamsUpdated(_params);
    }
}
```

### Vote Casting
```solidity
// Voting.sol
contract Voting {
    enum VoteType {
        Against,
        For,
        Abstain
    }
    
    function castVote(
        uint256 proposalId,
        uint8 support
    ) public virtual returns (uint256) {
        address voter = msg.sender;
        return _castVote(
            proposalId,
            voter,
            support,
            ""
        );
    }
    
    function castVoteWithReason(
        uint256 proposalId,
        uint8 support,
        string calldata reason
    ) public virtual returns (uint256) {
        address voter = msg.sender;
        return _castVote(
            proposalId,
            voter,
            support,
            reason
        );
    }
}
```

## Timelock System

### Timelock Configuration
```solidity
// Timelock.sol
contract Timelock is TimelockController {
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(
        minDelay,
        proposers,
        executors,
        admin
    ) {}
    
    function schedule(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) public virtual override {
        super.schedule(
            target,
            value,
            data,
            predecessor,
            salt,
            delay
        );
    }
}
```

### Operation Management
```typescript
// timelock-operations.ts
interface TimelockOperation {
  target: string;
  value: string;
  data: string;
  predecessor: string;
  salt: string;
  delay: number;
}

async function scheduleOperation(
  operation: TimelockOperation
): Promise<void> {
  // Hash operation
  const operationId = await timelock.hashOperation(
    operation.target,
    operation.value,
    operation.data,
    operation.predecessor,
    operation.salt
  );
  
  // Schedule operation
  await timelock.schedule(
    operation.target,
    operation.value,
    operation.data,
    operation.predecessor,
    operation.salt,
    operation.delay
  );
  
  // Monitor status
  await monitorOperation(operationId);
}
```

## Parameter Management

### System Parameters
```solidity
// ParameterManager.sol
contract ParameterManager {
    struct SystemParams {
        uint256 minDelay;
        uint256 quorumNumerator;
        uint256 proposalThreshold;
        uint256 votingPeriod;
    }
    
    SystemParams public params;
    
    event ParametersUpdated(SystemParams params);
    
    function updateParameters(
        SystemParams calldata newParams
    ) external onlyGovernance {
        require(
            validateParams(newParams),
            "Invalid parameters"
        );
        
        params = newParams;
        emit ParametersUpdated(newParams);
    }
}
```

### Parameter Updates
```typescript
// parameter-updates.ts
interface ParameterUpdate {
  parameter: string;
  currentValue: string;
  newValue: string;
  justification: string;
}

async function proposeParameterUpdate(
  update: ParameterUpdate
): Promise<string> {
  // Create parameter update proposal
  const proposal = {
    targets: [PARAMETER_MANAGER],
    values: ['0'],
    signatures: ['updateParameter(string,uint256)'],
    calldatas: [
      encodeParameters(
        ['string', 'uint256'],
        [update.parameter, update.newValue]
      )
    ],
    description: `Update ${update.parameter} from ${update.currentValue} to ${update.newValue}: ${update.justification}`
  };
  
  // Submit proposal
  return createProposal(proposal);
}
```

## Monitoring & Analytics

### Governance Metrics
```typescript
// governance-metrics.ts
const governanceMetrics = {
  proposals: new Counter({
    name: 'governance_proposals_total',
    help: 'Total number of proposals'
  }),
  
  votes: new Counter({
    name: 'governance_votes_total',
    help: 'Total number of votes cast'
  }),
  
  quorum: new Gauge({
    name: 'governance_quorum_percentage',
    help: 'Current quorum percentage'
  })
};

async function collectMetrics(): Promise<void> {
  // Collect proposal metrics
  const proposalCount = await governance.proposalCount();
  governanceMetrics.proposals.inc(proposalCount);
  
  // Collect voting metrics
  const totalVotes = await governance.getTotalVotes();
  governanceMetrics.votes.inc(totalVotes);
  
  // Collect quorum metrics
  const quorum = await governance.quorumNumerator();
  governanceMetrics.quorum.set(quorum);
}
```

### Event Monitoring
```typescript
// governance-events.ts
interface GovernanceEvent {
  type: string;
  proposalId: string;
  data: any;
  timestamp: number;
}

async function monitorEvents(): Promise<void> {
  // Monitor proposal creation
  governance.on('ProposalCreated', async (
    proposalId,
    proposer,
    targets,
    values,
    signatures,
    calldatas,
    startBlock,
    endBlock,
    description
  ) => {
    await handleProposalCreated({
      proposalId,
      proposer,
      targets,
      values,
      signatures,
      calldatas,
      startBlock,
      endBlock,
      description
    });
  });
  
  // Monitor vote casting
  governance.on('VoteCast', async (
    voter,
    proposalId,
    support,
    weight,
    reason
  ) => {
    await handleVoteCast({
      voter,
      proposalId,
      support,
      weight,
      reason
    });
  });
}
```

## Documentation

### Proposal Documentation
```markdown
# Proposal Template

## Overview
- Title: [Proposal Title]
- Author: [Author Name/Address]
- Forum Discussion: [Link to Forum Discussion]
- Created: [Date]

## Abstract
Brief description of the proposal.

## Motivation
Why this proposal is necessary.

## Specification
Detailed specification of the changes.

## Technical Implementation
```solidity
// Implementation details
contract Example {
    function update() external {
        // Implementation
    }
}
```

## Security Considerations
Security implications and mitigations.

## Copyright
Copyright and License Notice.
```

### Voting Documentation
```markdown
# Voting Guide

## How to Vote
1. Connect wallet to governance portal
2. Select active proposal
3. Review proposal details
4. Cast vote (For/Against/Abstain)
5. Sign transaction
6. Wait for confirmation

## Delegation
1. Connect wallet
2. Navigate to delegation page
3. Enter delegate address
4. Confirm delegation
5. Sign transaction

## Vote Weight Calculation
- Base voting power = token balance
- Delegated power = sum of delegations
- Total power = base + delegated
```
``` 