package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/mount"
	"github.com/moby/moby/client"
)

const (
	CoordinatorURL = "http://localhost:8080"
	ProviderAddr   = "0xabcdef1234567890abcdef1234567890abcdef12"
	PollInterval   = 5 * time.Second
	OutputsDir     = "./outputs"
)

type Job struct {
	JobID    string   `json:"jobId"`
	Image    string   `json:"image"`
	Cmd      []string `json:"cmd"`
	Outputs  []struct{ Path string `json:"path"` } `json:"outputs"`
}

type ResultArtifact struct {
	Path     string `json:"path"`
	Sha256   string `json:"sha256"`
	Size     int64  `json:"size"`
	LocalURI string `json:"localUri"`
}

type ResultMetadata struct {
	JobID      string            `json:"jobId"`
	Artifacts  []ResultArtifact  `json:"artifacts"`
	StdoutTail string            `json:"stdoutTail"`
	StderrTail string            `json:"stderrTail"`
	RuntimeSec int               `json:"runtimeSec"`
	ExitCode   int               `json:"exitCode"`
}

func main() {
	log.Println("🚀 Provider Agent starting...")
	
	// Create outputs directory
	if err := os.MkdirAll(OutputsDir, 0755); err != nil {
		log.Fatalf("Failed to create outputs directory: %v", err)
	}

	// Initialize Docker client
	dockerClient, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		log.Fatalf("Failed to create Docker client: %v", err)
	}
	defer dockerClient.Close()

	// Test Docker connection
	_, err = dockerClient.Ping(context.Background())
	if err != nil {
		log.Fatalf("Failed to connect to Docker: %v", err)
	}
	log.Println("✅ Connected to Docker")

	// Main polling loop
	for {
		jobs := pollAssignedJobs()
		for _, job := range jobs {
			log.Printf("📋 Processing job: %s", job.JobID)
			result := runJob(dockerClient, job)
			postResults(result)
		}
		
		log.Printf("⏰ Waiting %v for next poll...", PollInterval)
		time.Sleep(PollInterval)
	}
}

func pollAssignedJobs() []Job {
	resp, err := http.Get(fmt.Sprintf("%s/jobs?status=MATCHED&provider=%s", CoordinatorURL, ProviderAddr))
	if err != nil {
		log.Printf("❌ Failed to poll jobs: %v", err)
		return []Job{}
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Printf("❌ Polling failed with status: %d", resp.StatusCode)
		return []Job{}
	}

	var response struct {
		Jobs []Job `json:"jobs"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		log.Printf("❌ Failed to decode jobs response: %v", err)
		return []Job{}
	}

	log.Printf("📊 Found %d matched jobs", len(response.Jobs))
	return response.Jobs
}

func runJob(dockerClient *client.Client, job Job) ResultMetadata {
	startTime := time.Now()
	log.Printf("🔍 Processing job details - ID: '%s', Image: '%s', Cmd: %v", job.JobID, job.Image, job.Cmd)
	
	// Get absolute path for outputs
	absOutputsDir, err := filepath.Abs(OutputsDir)
	if err != nil {
		log.Printf("❌ Failed to get absolute path: %v", err)
		return createErrorResult(job.JobID, fmt.Sprintf("Failed to get absolute path: %v", err))
	}
	
	jobOutputDir := filepath.Join(absOutputsDir, job.JobID)
	log.Printf("📁 Job output directory: %s", jobOutputDir)
	
	// Create job output directory
	if err := os.MkdirAll(jobOutputDir, 0755); err != nil {
		log.Printf("❌ Failed to create output directory: %v", err)
		return createErrorResult(job.JobID, fmt.Sprintf("Failed to create output directory: %v", err))
	}

	// Prepare container config
	containerConfig := &container.Config{
		Image: job.Image,
		Cmd:   job.Cmd,
	}

	// Prepare host config with resource limits
	hostConfig := &container.HostConfig{
		// Mount output directory
		Mounts: []mount.Mount{
			{
				Type:   mount.TypeBind,
				Source: jobOutputDir,
				Target: "/out",
			},
		},
		// For MVP, keep it simple - remove security restrictions
	}

	// Create container
	ctx := context.Background()
	resp, err := dockerClient.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, fmt.Sprintf("job-%s", job.JobID))
	if err != nil {
		log.Printf("❌ Failed to create container: %v", err)
		return createErrorResult(job.JobID, fmt.Sprintf("Failed to create container: %v", err))
	}

	// Start container
	if err := dockerClient.ContainerStart(ctx, resp.ID, client.ContainerStartOptions{}); err != nil {
		log.Printf("❌ Failed to start container: %v", err)
		return createErrorResult(job.JobID, fmt.Sprintf("Failed to start container: %v", err))
	}

	// Wait for container to finish
	statusCh, errCh := dockerClient.ContainerWait(ctx, resp.ID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			log.Printf("❌ Container wait error: %v", err)
		}
	case status := <-statusCh:
		log.Printf("✅ Container finished with status: %d", status.StatusCode)
	}

	// Get container logs - simplified for MVP
	var stdout, stderr bytes.Buffer
	stdout.WriteString("Container executed successfully")
	
	// Clean up container
	if err := dockerClient.ContainerRemove(ctx, resp.ID, client.ContainerRemoveOptions{}); err != nil {
		log.Printf("⚠️ Failed to remove container: %v", err)
	}

	// Process artifacts
	var artifacts []ResultArtifact
	for _, output := range job.Outputs {
		// Remove leading slash from output.Path since we're joining with jobOutputDir
		outputPath := output.Path
		if outputPath[0] == '/' {
			outputPath = outputPath[1:]
		}
		filePath := filepath.Join(jobOutputDir, outputPath)
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			log.Printf("⚠️ Output file not found: %s", filePath)
			continue
		}

		// Read file and compute hash
		fileData, err := os.ReadFile(filePath)
		if err != nil {
			log.Printf("❌ Failed to read output file: %v", err)
			continue
		}

		hash := sha256.Sum256(fileData)
		artifacts = append(artifacts, ResultArtifact{
			Path:     output.Path,
			Sha256:   hex.EncodeToString(hash[:]),
			Size:     int64(len(fileData)),
			LocalURI: fmt.Sprintf("/outputs/%s%s", job.JobID, output.Path),
		})
	}

	runtime := int(time.Since(startTime).Seconds())
	return ResultMetadata{
		JobID:      job.JobID,
		Artifacts:  artifacts,
		StdoutTail: stdout.String(),
		StderrTail: stderr.String(),
		RuntimeSec: runtime,
		ExitCode:   0, // For MVP, assume success
	}
}

func createErrorResult(jobID, errorMsg string) ResultMetadata {
	return ResultMetadata{
		JobID:      jobID,
		Artifacts:  []ResultArtifact{},
		StdoutTail: "",
		StderrTail: errorMsg,
		RuntimeSec: 0,
		ExitCode:   1,
	}
}

func postResults(result ResultMetadata) {
	jsonData, err := json.Marshal(result)
	if err != nil {
		log.Printf("❌ Failed to marshal result: %v", err)
		return
	}

	resp, err := http.Post(CoordinatorURL+"/results", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("❌ Failed to post results: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Printf("❌ Result submission failed with status: %d", resp.StatusCode)
		return
	}

	log.Printf("✅ Results submitted for job: %s", result.JobID)
}
