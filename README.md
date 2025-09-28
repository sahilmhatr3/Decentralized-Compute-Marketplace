# Decentralized Compute Marketplace MVP

A decentralized marketplace for compute resources where requesters can submit jobs and providers can execute them using Docker containers, with payments handled through Ethereum smart contracts.

## Architecture Overview

The platform consists of four main components:

1. **Smart Contract** (`/escrow-contract`) - Ethereum escrow contract for secure payments
2. **Coordinator** (`/coordinator`) - Centralized job management and matching service
3. **CLI** (`/cli`) - Command-line interface for requesters
4. **Provider Agent** (`/provider-agent`) - Automated job execution service for providers

## Job Lifecycle

```
CREATED → FUNDED → MATCHED → RUNNING → RESULT_SUBMITTED → ACCEPTED/CANCELED
```

1. **CREATED**: Job submitted via CLI
2. **FUNDED**: Requester deposits ETH into escrow contract
3. **MATCHED**: Coordinator assigns job to a provider
4. **RUNNING**: Provider agent executes job in Docker container
5. **RESULT_SUBMITTED**: Provider submits results and artifacts
6. **ACCEPTED/CANCELED**: Requester accepts results (releases payment) or cancels

## Prerequisites

- **Node.js** (v18+)
- **Go** (v1.21+)
- **Docker** (for container execution)
- **Foundry** (for smart contract development)
- **Ethereum wallet** with Sepolia testnet ETH

## Quick Start

### 1. Smart Contract Setup

```bash
cd escrow-contract
forge install
forge build
forge test
```

Deploy to Sepolia:
```bash
forge create src/JobEscrow.sol:JobEscrow --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY
```

### 2. Coordinator Setup

```bash
cd coordinator
npm install
cp env.template .env
# Edit .env with your configuration
npm run dev
```

Required environment variables in `.env`:
```
PORT=8080
CHAIN_RPC=https://sepolia.infura.io/v3/YOUR_KEY
ESCROW_ADDRESS=0x... # Deployed contract address
REQUESTER_PRIVKEY=0x... # Private key for blockchain operations
```

### 3. CLI Setup

```bash
cd cli
npm install
npm run build
cp env.template .env
# Edit .env with coordinator URL
```

Required environment variables in `.env`:
```
COORD_URL=http://localhost:8080
REQUESTER_ADDR=0x... # Your Ethereum address
```

### 4. Provider Agent Setup

```bash
cd provider-agent
go mod tidy
go build -o bin/agent cmd/agent/main.go
```

## Usage

### For Requesters (Using CLI)

#### 1. Create a Job

```bash
cd cli
node dist/cli.js post-job \
  --image alpine \
  --cmd "echo 'Hello World' > /out/output.txt" \
  --price 0.01 \
  --requester 0x742d35cc6634c0532925a3b8d4c9db96c4b4d8b6
```

This returns a `jobId` that you'll use for subsequent operations.

#### 2. Fund the Job

After creating a job, deposit ETH into the escrow contract (this step requires actual blockchain interaction):

```bash
# First, deposit ETH to the escrow contract using your wallet or a script
# Then notify the coordinator:
node dist/cli.js fund --job <jobId> --tx <transactionHash>
```

#### 3. Match with a Provider

```bash
node dist/cli.js match \
  --job <jobId> \
  --provider 0xabcdef1234567890abcdef1234567890abcdef12
```

#### 4. Check Job Status

```bash
node dist/cli.js status --job <jobId>
```

#### 5. Accept Results (Release Payment)

```bash
node dist/cli.js accept \
  --job <jobId> \
  --provider 0xabcdef1234567890abcdef1234567890abcdef12
```

### For Providers (Using Agent)

#### 1. Start the Provider Agent

```bash
cd provider-agent
./bin/agent
```

The agent will:
- Poll the coordinator every 5 seconds for `MATCHED` jobs
- Execute jobs in Docker containers
- Compute SHA-256 hashes of output files
- Submit results back to the coordinator

#### 2. Monitor Agent Logs

The agent provides detailed logging:
```
Provider Agent starting...
Connected to Docker
Found 1 matched jobs
Processing job: 0x1fc6057e4e2918fa3e3eee91237e6af86939f131be3e786e59d2d85c6a9ed09f
Processing job details - ID: '0x1fc6057e4e2918fa3e3eee91237e6af86939f131be3e786e59d2d85c6a9ed09f', Image: 'alpine', Cmd: [sh -c echo "Job executed successfully" > /out/output.txt]
Job output directory: /home/user/projects/Decentralized-Compute-Marketplace/provider-agent/outputs/0x1fc6057e4e2918fa3e3eee91237e6af86939f131be3e786e59d2d85c6a9ed09f
Container finished with status: 0
Results submitted for job: 0x1fc6057e4e2918fa3e3eee91237e6af86939f131be3e786e59d2d85c6a9ed09f
```

## API Reference

### Coordinator REST API

#### POST /jobs
Create a new job.

**Headers:**
- `x-requester-addr`: Ethereum address of the requester

**Body:**
```json
{
  "image": "alpine",
  "cmd": ["echo", "hello"],
  "resources": {
    "cpu": 1,
    "ramGB": 1,
    "gpu": 0,
    "storageGB": 1
  },
  "inputs": [],
  "maxPriceEth": "0.01",
  "timeoutSec": 600,
  "verifier": "hash-only",
  "outputs": [{"path": "/out/output.txt"}]
}
```

#### POST /jobs/:jobId/fund
Notify that a job has been funded.

**Body:**
```json
{
  "txHash": "0x..."
}
```

#### POST /match
Assign a provider to a job.

**Body:**
```json
{
  "jobId": "0x...",
  "providerAddr": "0x..."
}
```

#### POST /results
Submit job results (used by provider agents).

**Body:**
```json
{
  "jobId": "0x...",
  "artifacts": [
    {
      "path": "/out/output.txt",
      "sha256": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
      "size": 12,
      "localUri": "/outputs/0x.../output.txt"
    }
  ],
  "stdoutTail": "Job completed successfully",
  "stderrTail": "",
  "runtimeSec": 2,
  "exitCode": 0
}
```

#### GET /jobs/:jobId
Get job status and details.

#### POST /jobs/:jobId/accept
Accept job results and release payment.

**Body:**
```json
{
  "providerAddr": "0x..."
}
```

### Smart Contract Interface

#### JobEscrow.sol

```solidity
function depositJob(string memory jobId) external payable;
function releaseJob(string memory jobId, address provider) external;
function cancelJob(string memory jobId) external;
function getJobBalance(string memory jobId) external view returns (uint256);
```

## Security Considerations

### MVP Limitations

This is an MVP with several security limitations:

1. **Centralized Coordinator**: Single point of failure
2. **No Input Validation**: Job specifications are not validated
3. **Basic Docker Security**: Containers run with minimal restrictions
4. **No Result Verification**: Results are not cryptographically verified
5. **Manual Provider Matching**: No automated provider selection

### Production Considerations

For production deployment, consider:

1. **Decentralized Coordination**: Use blockchain-based job matching
2. **Input Validation**: Validate job specifications and resource requirements
3. **Enhanced Docker Security**: Use read-only filesystems, capability dropping, resource limits
4. **Result Verification**: Implement cryptographic proof of execution
5. **Automated Matching**: Algorithm-based provider selection
6. **Reputation System**: Track provider performance and reliability

## Development

### Project Structure

```
Decentralized-Compute-Marketplace/
├── escrow-contract/          # Solidity smart contract
│   ├── src/JobEscrow.sol
│   ├── test/JobEscrow.t.sol
│   └── foundry.toml
├── coordinator/              # Node.js/TypeScript REST API
│   ├── src/
│   │   ├── server.ts
│   │   ├── database.ts
│   │   ├── blockchain.ts
│   │   └── types.ts
│   └── package.json
├── cli/                     # Node.js/TypeScript CLI
│   ├── src/cli.ts
│   └── package.json
├── provider-agent/           # Go Docker execution agent
│   ├── cmd/agent/main.go
│   └── go.mod
└── README.md
```

### Testing

#### Smart Contract Tests
```bash
cd escrow-contract
forge test
```

#### End-to-End Test
```bash
# Terminal 1: Start coordinator
cd coordinator && npm run dev

# Terminal 2: Create and fund job
cd cli && node dist/cli.js post-job --image alpine --cmd "echo test" --price 0.01

# Terminal 3: Run provider agent
cd provider-agent && ./bin/agent
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions or issues:
1. Check the existing issues
2. Create a new issue with detailed description
3. Include logs and error messages

## Roadmap

### Phase 1 (Current MVP)
- [x] Basic job lifecycle
- [x] Docker execution
- [x] Payment escrow
- [x] CLI interface

### Phase 2 (Enhanced Security)
- [ ] Input validation
- [ ] Enhanced Docker security
- [ ] Result verification
- [ ] Provider reputation

### Phase 3 (Decentralization)
- [ ] Decentralized coordination
- [ ] Automated matching
- [ ] Multi-chain support
- [ ] Governance token

### Phase 4 (Production)
- [ ] Monitoring and alerting
- [ ] Performance optimization
- [ ] Enterprise features
- [ ] API rate limiting