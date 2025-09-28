"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const axios_1 = __importDefault(require("axios"));
const COORD = process.env.COORD_URL || 'http://localhost:8080';
const REQUESTER_ADDR = process.env.REQUESTER_ADDR || '';
async function postJob(argv) {
    const requesterAddr = argv.requester || REQUESTER_ADDR;
    if (!requesterAddr)
        throw new Error('Missing requester address. Pass --requester or set REQUESTER_ADDR');
    const spec = {
        image: argv.image,
        cmd: argv.cmd.split(' '),
        resources: { cpu: Number(argv.cpu || 1), ramGB: Number(argv.ram || 1), gpu: Number(argv.gpu || 0), storageGB: Number(argv.storage || 1) },
        inputs: [],
        maxPriceEth: String(argv.price),
        timeoutSec: Number(argv.timeout || 600),
        verifier: 'hash-only',
        outputs: [{ path: '/out/output.txt' }]
    };
    const r = await axios_1.default.post(`${COORD}/jobs`, spec, { headers: { 'x-requester-addr': requesterAddr } });
    console.log(r.data);
}
async function fund(argv) {
    const r = await axios_1.default.post(`${COORD}/jobs/${argv.job}/fund`, { tx: argv.tx });
    console.log(r.data);
}
async function matchCmd(argv) {
    const r = await axios_1.default.post(`${COORD}/match`, { jobId: argv.job, providerAddr: argv.provider });
    console.log(r.data);
}
async function submitResult(argv) {
    const payload = {
        jobId: argv.job,
        artifacts: [{ path: '/out/output.txt', sha256: argv.sha256 || 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', size: 12, localUri: `/outputs/${argv.job}/output.txt` }],
        stdoutTail: 'Job completed successfully',
        stderrTail: '',
        runtimeSec: 2,
        exitCode: 0
    };
    const r = await axios_1.default.post(`${COORD}/results`, payload);
    console.log(r.data);
}
async function status(argv) {
    const r = await axios_1.default.get(`${COORD}/jobs/${argv.job}`);
    console.log(r.data);
}
async function accept(argv) {
    const r = await axios_1.default.post(`${COORD}/jobs/${argv.job}/accept`, { provider: argv.provider });
    console.log(r.data);
}
(0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .command('post-job', 'Create a job', (y) => y
    .option('image', { type: 'string', demandOption: true })
    .option('cmd', { type: 'string', demandOption: true })
    .option('price', { type: 'number', demandOption: true })
    .option('requester', { type: 'string' })
    .option('cpu', { type: 'number' })
    .option('ram', { type: 'number' })
    .option('gpu', { type: 'number' })
    .option('storage', { type: 'number' })
    .option('timeout', { type: 'number' }), (argv) => postJob(argv))
    .command('fund', 'Notify funding', (y) => y
    .option('job', { type: 'string', demandOption: true })
    .option('tx', { type: 'string', demandOption: true }), (argv) => fund(argv))
    .command('match', 'Assign provider', (y) => y
    .option('job', { type: 'string', demandOption: true })
    .option('provider', { type: 'string', demandOption: true }), (argv) => matchCmd(argv))
    .command('submit-result', 'Submit result (manual)', (y) => y
    .option('job', { type: 'string', demandOption: true })
    .option('sha256', { type: 'string' }), (argv) => submitResult(argv))
    .command('status', 'Job status', (y) => y
    .option('job', { type: 'string', demandOption: true }), (argv) => status(argv))
    .command('accept', 'Accept & release', (y) => y
    .option('job', { type: 'string', demandOption: true })
    .option('provider', { type: 'string', demandOption: true }), (argv) => accept(argv))
    .demandCommand()
    .help()
    .strict()
    .parse();
