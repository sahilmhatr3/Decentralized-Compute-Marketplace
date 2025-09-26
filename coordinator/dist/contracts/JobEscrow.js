"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobEscrow = void 0;
const ethers_1 = require("ethers");
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
class JobEscrow {
    constructor(address, signer) {
        this.contract = new ethers_1.ethers.Contract(address, ABI, signer);
    }
    async releaseJob(jobId, provider) {
        return this.contract.release(jobId, provider);
    }
    async cancelJob(jobId) {
        return this.contract.cancel(jobId);
    }
    async getEscrowAmount(jobId) {
        return this.contract.escrowOf(jobId);
    }
    async getRequester(jobId) {
        return this.contract.requesterOf(jobId);
    }
}
exports.JobEscrow = JobEscrow;
//# sourceMappingURL=JobEscrow.js.map