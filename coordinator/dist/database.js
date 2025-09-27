"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
class DatabaseManager {
    constructor(dbPath) {
        this.db = new better_sqlite3_1.default(dbPath);
        this.initTables();
    }
    initTables() {
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
    createJob(job) {
        const stmt = this.db.prepare(`
      INSERT INTO jobs (job_id, requester_addr, price_eth, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(job.job_id, job.requester_addr, job.price_eth, job.status, job.created_at, job.updated_at);
    }
    updateJobStatus(jobId, status) {
        const stmt = this.db.prepare(`
      UPDATE jobs SET status = ?, updated_at = ? WHERE job_id = ?
    `);
        stmt.run(status, Date.now(), jobId);
    }
    getJob(jobId) {
        const stmt = this.db.prepare('SELECT * FROM jobs WHERE job_id = ?');
        return stmt.get(jobId);
    }
    getJobsByStatus(status) {
        const stmt = this.db.prepare('SELECT * FROM jobs WHERE status = ?');
        return stmt.all(status);
    }
    getAllJobs() {
        const stmt = this.db.prepare('SELECT * FROM jobs ORDER BY created_at DESC');
        return stmt.all();
    }
    // Assignment operations
    createAssignment(assignment) {
        const stmt = this.db.prepare(`
      INSERT INTO assignments (job_id, provider_addr, assigned_at, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(assignment.job_id, assignment.provider_addr, assignment.assigned_at, assignment.started_at, assignment.ended_at);
    }
    getAssignment(jobId) {
        const stmt = this.db.prepare('SELECT * FROM assignments WHERE job_id = ?');
        return stmt.get(jobId);
    }
    // Result operations
    createResult(result) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO results (job_id, result_json, artifact_hash, runtime_sec, exit_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(result.job_id, result.result_json, result.artifact_hash, result.runtime_sec, result.exit_code, result.created_at);
    }
    getResult(jobId) {
        const stmt = this.db.prepare('SELECT * FROM results WHERE job_id = ?');
        return stmt.get(jobId);
    }
    close() {
        this.db.close();
    }
}
exports.DatabaseManager = DatabaseManager;
//# sourceMappingURL=database.js.map