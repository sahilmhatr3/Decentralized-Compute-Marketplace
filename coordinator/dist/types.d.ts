export interface JobSpec {
    jobId: string;
    image: string;
    cmd: string[];
    resources: {
        cpu: number;
        ramGB: number;
        gpu: number;
        storageGB: number;
    };
    inputs: Array<{
        path: string;
    }>;
    maxPriceEth: string;
    timeoutSec: number;
    verifier: string;
    outputs: Array<{
        path: string;
    }>;
}
export interface ResultArtifact {
    path: string;
    sha256: string;
    size: number;
    localUri: string;
}
export interface ResultMetadata {
    jobId: string;
    artifacts: ResultArtifact[];
    stdoutTail: string;
    stderrTail: string;
    runtimeSec: number;
    exitCode: number;
}
export type JobStatus = 'CREATED' | 'FUNDED' | 'MATCHED' | 'RUNNING' | 'RESULT_SUBMITTED' | 'ACCEPTED' | 'CANCELED';
export interface Job {
    job_id: string;
    requester_addr: string;
    price_eth: string;
    status: JobStatus;
    created_at: number;
    updated_at: number;
}
export interface Assignment {
    job_id: string;
    provider_addr: string;
    assigned_at: number;
    started_at?: number;
    ended_at?: number;
}
export interface Result {
    job_id: string;
    result_json: string;
    artifact_hash?: string;
    runtime_sec?: number;
    exit_code?: number;
    created_at: number;
}
//# sourceMappingURL=types.d.ts.map