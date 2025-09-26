import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import axios from 'axios';

const COORD = process.env.COORD_URL || 'http://localhost:8080';
const REQUESTER_ADDR = process.env.REQUESTER_ADDR || '';

async function postJob(argv: any) {
  const requesterAddr = (argv.requester as string) || REQUESTER_ADDR;
  if (!requesterAddr) throw new Error('Missing requester address. Pass --requester or set REQUESTER_ADDR');

  const spec = {
    image: argv.image as string,
    cmd: (argv.cmd as string).split(' '),
    resources: { cpu: Number(argv.cpu||1), ramGB: Number(argv.ram||1), gpu: Number(argv.gpu||0), storageGB: Number(argv.storage||1) },
    inputs: [],
    maxPriceEth: String(argv.price),
    timeoutSec: Number(argv.timeout||600),
    verifier: 'hash-only',
    outputs: [{ path: '/out/hello.txt' }]
  };

  const r = await axios.post(`${COORD}/jobs`, spec, { headers: { 'x-requester-addr': requesterAddr }});
  console.log(r.data);
}

async function fund(argv: any) {
  const r = await axios.post(`${COORD}/jobs/${argv.job}/fund`, { tx: argv.tx });
  console.log(r.data);
}

async function matchCmd(argv: any) {
  const r = await axios.post(`${COORD}/match`, { jobId: argv.job, providerAddr: argv.provider });
  console.log(r.data);
}

async function submitResult(argv: any) {
  const payload = {
    jobId: argv.job,
    artifacts: [{ path: '/out/hello.txt', sha256: argv.sha256 || 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', size: 12, localUri: `/outputs/${argv.job}/hello.txt` }],
    stdoutTail: 'ok',
    stderrTail: '',
    runtimeSec: 2,
    exitCode: 0
  };
  const r = await axios.post(`${COORD}/results`, payload);
  console.log(r.data);
}

async function status(argv: any) {
  const r = await axios.get(`${COORD}/jobs/${argv.job}`);
  console.log(r.data);
}

async function accept(argv: any) {
  const r = await axios.post(`${COORD}/jobs/${argv.job}/accept`, { provider: argv.provider });
  console.log(r.data);
}

yargs(hideBin(process.argv))
  .command('post-job', 'Create a job', (y) => y
    .option('image', { type: 'string', demandOption: true })
    .option('cmd', { type: 'string', demandOption: true })
    .option('price', { type: 'number', demandOption: true })
    .option('requester', { type: 'string' })
    .option('cpu', { type: 'number' })
    .option('ram', { type: 'number' })
    .option('gpu', { type: 'number' })
    .option('storage', { type: 'number' })
    .option('timeout', { type: 'number' })
  , (argv) => postJob(argv))
  .command('fund', 'Notify funding', (y) => y
    .option('job', { type: 'string', demandOption: true })
    .option('tx', { type: 'string', demandOption: true })
  , (argv) => fund(argv))
  .command('match', 'Assign provider', (y) => y
    .option('job', { type: 'string', demandOption: true })
    .option('provider', { type: 'string', demandOption: true })
  , (argv) => matchCmd(argv))
  .command('submit-result', 'Submit result (manual)', (y) => y
    .option('job', { type: 'string', demandOption: true })
    .option('sha256', { type: 'string' })
  , (argv) => submitResult(argv))
  .command('status', 'Job status', (y) => y
    .option('job', { type: 'string', demandOption: true })
  , (argv) => status(argv))
  .command('accept', 'Accept & release', (y) => y
    .option('job', { type: 'string', demandOption: true })
    .option('provider', { type: 'string', demandOption: true })
  , (argv) => accept(argv))
  .demandCommand()
  .help()
  .strict()
  .parse();
