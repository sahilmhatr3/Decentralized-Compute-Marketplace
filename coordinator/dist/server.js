"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const zod_1 = require("zod");
const database_1 = require("./database");
const blockchain_1 = require("./blockchain");
const ethers_1 = require("ethers");
const app = (0, express_1.default)();
app.use(body_parser_1.default.json({ limit: '2mb' }));
// Initialize database and blockchain
const db = new database_1.DatabaseManager('./data/coord.db');
let blockchain = null;
try {
    blockchain = new blockchain_1.BlockchainManager(process.env.CHAIN_RPC, process.env.REQUESTER_PRIVKEY, process.env.ESCROW_ADDRESS);
    console.log('✅ Blockchain manager initialized');
}
catch (error) {
    console.error('❌ Blockchain initialization failed:', error);
    console.log('⚠️  Server will run without blockchain functionality');
}
// Validation schemas
const JobSpecSchema = zod_1.z.object({
    image: zod_1.z.string(),
    cmd: zod_1.z.array(zod_1.z.string()),
    resources: zod_1.z.object({
        cpu: zod_1.z.number(),
        ramGB: zod_1.z.number(),
        gpu: zod_1.z.number(),
        storageGB: zod_1.z.number()
    }),
    inputs: zod_1.z.array(zod_1.z.object({ path: zod_1.z.string() })),
    maxPriceEth: zod_1.z.string(),
    timeoutSec: zod_1.z.number(),
    verifier: zod_1.z.string(),
    outputs: zod_1.z.array(zod_1.z.object({ path: zod_1.z.string() }))
});
const ResultMetadataSchema = zod_1.z.object({
    jobId: zod_1.z.string(),
    artifacts: zod_1.z.array(zod_1.z.object({
        path: zod_1.z.string(),
        sha256: zod_1.z.string(),
        size: zod_1.z.number(),
        localUri: zod_1.z.string()
    })),
    stdoutTail: zod_1.z.string(),
    stderrTail: zod_1.z.string(),
    runtimeSec: zod_1.z.number(),
    exitCode: zod_1.z.number()
});
// Helper function to generate job ID
function generateJobId(requesterAddr) {
    const nonce = Date.now().toString();
    return ethers_1.ethers.keccak256(ethers_1.ethers.solidityPacked(['address', 'string'], [requesterAddr, nonce]));
}
// POST /jobs - Create a job
app.post('/jobs', (req, res) => {
    try {
        const validatedData = JobSpecSchema.parse(req.body);
        const requesterAddr = req.headers['x-requester-addr'];
        if (!requesterAddr) {
            return res.status(400).json({ error: 'Missing requester address' });
        }
        const jobId = generateJobId(requesterAddr);
        const now = Date.now();
        const job = {
            job_id: jobId,
            requester_addr: requesterAddr,
            price_eth: validatedData.maxPriceEth,
            status: 'CREATED',
            created_at: now,
            updated_at: now
        };
        db.createJob(job);
        res.json({
            jobId,
            expectedEscrowEth: validatedData.maxPriceEth,
            status: 'CREATED'
        });
    }
    catch (error) {
        console.error('Error creating job:', error);
        res.status(400).json({ error: 'Invalid job specification' });
    }
});
// POST /jobs/:jobId/fund - Notify funding
app.post('/jobs/:jobId/fund', (req, res) => {
    try {
        const { jobId } = req.params;
        const { tx } = req.body;
        const job = db.getJob(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (job.status !== 'CREATED') {
            return res.status(400).json({ error: 'Job already funded or in progress' });
        }
        db.updateJobStatus(jobId, 'FUNDED');
        res.json({ ok: true, status: 'FUNDED' });
    }
    catch (error) {
        console.error('Error funding job:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /match - Assign provider to job
app.post('/match', (req, res) => {
    try {
        const { jobId, providerAddr } = req.body;
        const job = db.getJob(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (job.status !== 'FUNDED') {
            return res.status(400).json({ error: 'Job not funded' });
        }
        const assignment = {
            job_id: jobId,
            provider_addr: providerAddr,
            assigned_at: Date.now(),
            started_at: undefined,
            ended_at: undefined
        };
        db.createAssignment(assignment);
        db.updateJobStatus(jobId, 'MATCHED');
        res.json({ ok: true, status: 'MATCHED' });
    }
    catch (error) {
        console.error('Error matching job:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /results - Provider submits results
app.post('/results', (req, res) => {
    try {
        const validatedData = ResultMetadataSchema.parse(req.body);
        const { jobId } = validatedData;
        const job = db.getJob(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (job.status !== 'MATCHED' && job.status !== 'RUNNING') {
            return res.status(400).json({ error: 'Job not in correct state for results' });
        }
        const result = {
            job_id: jobId,
            result_json: JSON.stringify(validatedData),
            artifact_hash: validatedData.artifacts.map(a => a.sha256).join(','),
            runtime_sec: validatedData.runtimeSec,
            exit_code: validatedData.exitCode,
            created_at: Date.now()
        };
        db.createResult(result);
        db.updateJobStatus(jobId, 'RESULT_SUBMITTED');
        res.json({ ok: true, status: 'RESULT_SUBMITTED' });
    }
    catch (error) {
        console.error('Error submitting results:', error);
        res.status(400).json({ error: 'Invalid result data' });
    }
});
// POST /jobs/:jobId/accept - Accept results and release payment
app.post('/jobs/:jobId/accept', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { provider } = req.body;
        const job = db.getJob(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (job.status !== 'RESULT_SUBMITTED') {
            return res.status(400).json({ error: 'Job not ready for acceptance' });
        }
        if (!blockchain) {
            return res.status(500).json({ error: 'Blockchain not available' });
        }
        const txHash = await blockchain.release(jobId, provider);
        db.updateJobStatus(jobId, 'ACCEPTED');
        res.json({ ok: true, status: 'ACCEPTED', txHash });
    }
    catch (error) {
        console.error('Error accepting job:', error);
        res.status(500).json({ error: 'Failed to release payment' });
    }
});
// POST /jobs/:jobId/cancel - Cancel job and refund
app.post('/jobs/:jobId/cancel', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = db.getJob(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (job.status === 'ACCEPTED' || job.status === 'CANCELED') {
            return res.status(400).json({ error: 'Job already finalized' });
        }
        if (!blockchain) {
            return res.status(500).json({ error: 'Blockchain not available' });
        }
        const txHash = await blockchain.cancel(jobId);
        db.updateJobStatus(jobId, 'CANCELED');
        res.json({ ok: true, status: 'CANCELED', txHash });
    }
    catch (error) {
        console.error('Error canceling job:', error);
        res.status(500).json({ error: 'Failed to cancel job' });
    }
});
// GET /jobs/:jobId - Get job status and details
app.get('/jobs/:jobId', (req, res) => {
    try {
        const { jobId } = req.params;
        const job = db.getJob(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        const assignment = db.getAssignment(jobId);
        const result = db.getResult(jobId);
        const response = {
            jobId: job.job_id,
            status: job.status,
            requesterAddr: job.requester_addr,
            priceEth: job.price_eth,
            createdAt: job.created_at,
            updatedAt: job.updated_at
        };
        if (assignment) {
            response.providerAddr = assignment.provider_addr;
            response.assignedAt = assignment.assigned_at;
        }
        if (result) {
            response.result = JSON.parse(result.result_json);
        }
        res.json(response);
    }
    catch (error) {
        console.error('Error getting job:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /jobs - List jobs with optional status filter
app.get('/jobs', (req, res) => {
    try {
        const { status } = req.query;
        let jobs;
        if (status) {
            jobs = db.getJobsByStatus(status);
        }
        else {
            // For MVP, return all jobs (could be paginated later)
            jobs = db.getJobsByStatus(''); // This would need a getAllJobs method
        }
        res.json({ jobs });
    }
    catch (error) {
        console.error('Error listing jobs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Coordinator server running on port ${PORT}`);
});
// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down coordinator...');
    db.close();
    process.exit(0);
});
//# sourceMappingURL=server.js.map