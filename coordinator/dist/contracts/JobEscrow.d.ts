import { ethers } from 'ethers';
export declare class JobEscrow {
    private contract;
    constructor(address: string, signer: ethers.Signer);
    releaseJob(jobId: string, provider: string): Promise<ethers.ContractTransactionResponse>;
    cancelJob(jobId: string): Promise<ethers.ContractTransactionResponse>;
    getEscrowAmount(jobId: string): Promise<bigint>;
    getRequester(jobId: string): Promise<string>;
}
//# sourceMappingURL=JobEscrow.d.ts.map