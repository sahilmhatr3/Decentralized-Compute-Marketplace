import { ethers } from 'ethers';
import { JobEscrow } from './contracts/JobEscrow';

export class BlockchainManager {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private escrowContract: JobEscrow;

  constructor(rpcUrl: string, privateKey: string, escrowAddress: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.escrowContract = new JobEscrow(escrowAddress, this.wallet);
  }

  async release(jobId: string, providerAddress: string): Promise<string> {
    const tx = await this.escrowContract.releaseJob(jobId, providerAddress);
    await tx.wait();
    return tx.hash;
  }

  async cancel(jobId: string): Promise<string> {
    const tx = await this.escrowContract.cancelJob(jobId);
    await tx.wait();
    return tx.hash;
  }

  async getEscrowAmount(jobId: string): Promise<bigint> {
    return await this.escrowContract.getEscrowAmount(jobId);
  }

  async getRequester(jobId: string): Promise<string> {
    return await this.escrowContract.getRequester(jobId);
  }

  
}
