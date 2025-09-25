import Database from 'better-sqlite3';
import { Job, Assignment, Result } from './types';

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables() {
    // Jobs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        job_id TEXT PRIMARY KEY,
        requester_addr TEXT NOT NULL,
        price_eth TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Assignments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assignments (
        job_id TEXT PRIMARY KEY REFERENCES jobs(job_id) ON DELETE CASCADE,
        provider_addr TEXT NOT NULL,
        assigned_at INTEGER NOT NULL,
        started_at INTEGER,
        ended_at INTEGER
      )
    `);

    // Results table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS results (
        job_id TEXT PRIMARY KEY REFERENCES jobs(job_id) ON DELETE CASCADE,
        result_json TEXT NOT NULL,
        artifact_hash TEXT,
        runtime_sec INTEGER,
        exit_code INTEGER,
        created_at INTEGER NOT NULL
      )
    `);
  }

  // Job operations
  createJob(job: Job) {
    const stmt = this.db.prepare(`
      INSERT INTO jobs (job_id, requester_addr, price_eth, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(job.job_id, job.requester_addr, job.price_eth, job.status, job.created_at, job.updated_at);
  }

  updateJobStatus(jobId: string, status: string) {
    const stmt = this.db.prepare(`
      UPDATE jobs SET status = ?, updated_at = ? WHERE job_id = ?
    `);
    stmt.run(status, Date.now(), jobId);
  }

  getJob(jobId: string): Job | undefined {
    const stmt = this.db.prepare('SELECT * FROM jobs WHERE job_id = ?');
    return stmt.get(jobId) as Job | undefined;
  }

  getJobsByStatus(status: string): Job[] {
    const stmt = this.db.prepare('SELECT * FROM jobs WHERE status = ?');
    return stmt.all(status) as Job[];
  }

  // Assignment operations
  createAssignment(assignment: Assignment) {
    const stmt = this.db.prepare(`
      INSERT INTO assignments (job_id, provider_addr, assigned_at, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(assignment.job_id, assignment.provider_addr, assignment.assigned_at, assignment.started_at, assignment.ended_at);
  }

  getAssignment(jobId: string): Assignment | undefined {
    const stmt = this.db.prepare('SELECT * FROM assignments WHERE job_id = ?');
    return stmt.get(jobId) as Assignment | undefined;
  }

  // Result operations
  createResult(result: Result) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO results (job_id, result_json, artifact_hash, runtime_sec, exit_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(result.job_id, result.result_json, result.artifact_hash, result.runtime_sec, result.exit_code, result.created_at);
  }

  getResult(jobId: string): Result | undefined {
    const stmt = this.db.prepare('SELECT * FROM results WHERE job_id = ?');
    return stmt.get(jobId) as Result | undefined;
  }

  close() {
    this.db.close();
  }
}
