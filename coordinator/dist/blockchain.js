"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainManager = void 0;
const ethers_1 = require("ethers");
const JobEscrow_1 = require("./contracts/JobEscrow");
class BlockchainManager {
    constructor(rpcUrl, privateKey, escrowAddress) {
        this.provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers_1.ethers.Wallet(privateKey, this.provider);
        this.escrowContract = new JobEscrow_1.JobEscrow(escrowAddress, this.wallet);
    }
    async release(jobId, providerAddress) {
        const tx = await this.escrowContract.releaseJob(jobId, providerAddress);
        await tx.wait();
        return tx.hash;
    }
    async cancel(jobId) {
        const tx = await this.escrowContract.cancelJob(jobId);
        await tx.wait();
        return tx.hash;
    }
    async getEscrowAmount(jobId) {
        return await this.escrowContract.getEscrowAmount(jobId);
    }
    async getRequester(jobId) {
        return await this.escrowContract.getRequester(jobId);
    }
}
exports.BlockchainManager = BlockchainManager;
//# sourceMappingURL=blockchain.js.map