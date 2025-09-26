export declare class BlockchainManager {
    private provider;
    private wallet;
    private escrowContract;
    constructor(rpcUrl: string, privateKey: string, escrowAddress: string);
    release(jobId: string, providerAddress: string): Promise<string>;
    cancel(jobId: string): Promise<string>;
    getEscrowAmount(jobId: string): Promise<bigint>;
    getRequester(jobId: string): Promise<string>;
}
//# sourceMappingURL=blockchain.d.ts.map