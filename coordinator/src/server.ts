import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import { z } from 'zod';
import { DatabaseManager } from './database';
import { BlockchainManager } from './blockchain';
import { JobSpec, ResultMetadata, JobStatus } from './types';
import { ethers } from 'ethers';

const app = express();
app.use(bodyParser.json({ limit: '2mb' }));

// Initialize database and blockchain
const db = new DatabaseManager('./data/coord.db');
let blockchain: BlockchainManager | null = null;

try {
  blockchain = new BlockchainManager(
    process.env.CHAIN_RPC!,
    process.env.REQUESTER_PRIVKEY!,
    process.env.ESCROW_ADDRESS!
  );
  console.log('✅ Blockchain manager initialized');
} catch (error) {
  console.error('❌ Blockchain initialization failed:', error);
  console.log('⚠️  Server will run without blockchain functionality');
}

// Validation schemas
const JobSpecSchema = z.object({
  image: z.string(),
  cmd: z.array(z.string()),
  resources: z.object({
    cpu: z.number(),
    ramGB: z.number(),
    gpu: z.number(),
    storageGB: z.number()
  }),
  inputs: z.array(z.object({ path: z.string() })),
  maxPriceEth: z.string(),
  timeoutSec: z.number(),
  verifier: z.string(),
  outputs: z.array(z.object({ path: z.string() }))
});

const ResultMetadataSchema = z.object({
  jobId: z.string(),
  artifacts: z.array(z.object({
    path: z.string(),
    sha256: z.string(),
    size: z.number(),
    localUri: z.string()
  })),
  stdoutTail: z.string(),
  stderrTail: z.string(),
  runtimeSec: z.number(),
  exitCode: z.number()
});

// Helper function to generate job ID
function generateJobId(requesterAddr: string): string {
  const nonce = Date.now().toString();
  return ethers.keccak256(ethers.solidityPacked(['address', 'string'], [requesterAddr, nonce]));
}

// POST /jobs - Create a job
app.post('/jobs', (req, res) => {
  try {
    const validatedData = JobSpecSchema.parse(req.body);
    const requesterAddr = req.headers['x-requester-addr'] as string;
    
    if (!requesterAddr) {
      return res.status(400).json({ error: 'Missing requester address' });
    }

    const jobId = generateJobId(requesterAddr);
    const now = Date.now();

    const job = {
      job_id: jobId,
      requester_addr: requesterAddr,
      price_eth: validatedData.maxPriceEth,
      status: 'CREATED' as JobStatus,
      created_at: now,
      updated_at: now
    };

    db.createJob(job);

    res.json({
      jobId,
      expectedEscrowEth: validatedData.maxPriceEth,
      status: 'CREATED'
    });
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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

    const response: any = {
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
  } catch (error) {
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
      jobs = db.getJobsByStatus(status as string);
    } else {
      // For MVP, return all jobs (could be paginated later)
      jobs = db.getJobsByStatus(''); // This would need a getAllJobs method
    }

    res.json({ jobs });
  } catch (error) {
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
