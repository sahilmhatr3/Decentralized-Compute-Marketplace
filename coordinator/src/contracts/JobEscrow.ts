import { ethers } from 'ethers';

const ABI = [
  'function deposit(bytes32 jobId) external payable',
  'function release(bytes32 jobId, address provider) external',
  'function cancel(bytes32 jobId) external',
  'function escrowOf(bytes32 jobId) external view returns (uint256)',
  'function requesterOf(bytes32 jobId) external view returns (address)',
  'event JobFunded(bytes32 indexed jobId, address indexed requester, uint256 amount)',
  'event JobReleased(bytes32 indexed jobId, address indexed provider, uint256 amount)',
  'event JobCanceled(bytes32 indexed jobId, address indexed requester, uint256 amount)'
];

export class JobEscrow {
  private contract: ethers.Contract;

  constructor(address: string, signer: ethers.Signer) {
    this.contract = new ethers.Contract(address, ABI, signer);
  }

  async releaseJob(jobId: string, provider: string): Promise<ethers.ContractTransactionResponse> {
    return this.contract.release(jobId, provider);
  }

  async cancelJob(jobId: string): Promise<ethers.ContractTransactionResponse> {
    return this.contract.cancel(jobId);
  }

  async getEscrowAmount(jobId: string): Promise<bigint> {
    return this.contract.escrowOf(jobId);
  }

  async getRequester(jobId: string): Promise<string> {
    return this.contract.requesterOf(jobId);
  }
}
