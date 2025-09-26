import { Job, Assignment, Result } from './types';
export declare class DatabaseManager {
    private db;
    constructor(dbPath: string);
    private initTables;
    createJob(job: Job): void;
    updateJobStatus(jobId: string, status: string): void;
    getJob(jobId: string): Job | undefined;
    getJobsByStatus(status: string): Job[];
    createAssignment(assignment: Assignment): void;
    getAssignment(jobId: string): Assignment | undefined;
    createResult(result: Result): void;
    getResult(jobId: string): Result | undefined;
    close(): void;
}
//# sourceMappingURL=database.d.ts.map