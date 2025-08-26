package io.backend.fileservice;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.Collections;
import java.util.concurrent.ConcurrentHashMap;
import java.util.UUID;

import java.io.IOException;
import java.net.MalformedURLException;
import java.sql.SQLException;
import java.util.List;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@CrossOrigin(origins = "http://localhost:3000")
@RestController
@RequestMapping("/rest")
public class FileController {

    private final FileService fileService;
    private final S3Service s3Service;
    private final PostgresService postgresService;

    // Progress tracking for imports
    public static class ImportProgress {
        public int processed = 0;
        public int total = 0;
        public String status = "in_progress"; // "in_progress", "done", "error"
        public String message = "";
    }
    
    public static final Map<String, ImportProgress> progressMap = new ConcurrentHashMap<>();

    @Autowired
    public FileController(FileService fileService, S3Service s3Service, PostgresService postgresService) {
        this.fileService = fileService;
        this.s3Service = s3Service;
        this.postgresService = postgresService;
    }

    // Progress endpoint
    @GetMapping("/import-progress/{jobId}")
    public ResponseEntity<ImportProgress> getProgress(@PathVariable String jobId) {
        ImportProgress progress = progressMap.get(jobId);
        if (progress == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(progress);
    }

    @PostMapping("/upload")
    public ResponseEntity<String> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            String fileName = fileService.storeFile(file);
            return ResponseEntity.ok("File uploaded successfully: " + fileName);
        } catch (IOException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Could not store file: " + ex.getMessage());
        }
    }

    @GetMapping("/download/{filename}")
    public ResponseEntity<Resource> downloadFile(@PathVariable String filename) {
        try {
            Resource resource = fileService.loadFileAsResource(filename);
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + resource.getFilename() + "\"")
                    .body(resource);
        } catch (MalformedURLException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/list")
    public ResponseEntity<List<String>> listFiles() {
        try {
            List<String> fileNames = fileService.listFiles();
            return ResponseEntity.ok(fileNames);
        } catch (IOException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/list-s3")
    public ResponseEntity<Map<String, Object>> listS3(@RequestBody S3Request s3Request) {
        try {
            Map<String, Object> result = s3Service.listS3Contents(s3Request);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Error: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @PostMapping("/list-s3-files-in-folder")
    public ResponseEntity<Map<String, Object>> listS3FilesInFolder(@RequestBody S3Request s3Request) {
        try {
            List<String> allFiles = s3Service.getAllFilesInFolder(s3Request);
            Map<String, Object> result = new HashMap<>();
            result.put("files", allFiles);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Error: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @PostMapping("/load-s3")
    public ResponseEntity<Map<String, Object>> loadS3Files(@RequestBody S3Request s3Request) {
        Logger logger = LoggerFactory.getLogger(FileController.class);
        logger.info("Received S3 files to load: {}", s3Request.getFiles());
        
        try {
            Map<String, Object> result = s3Service.loadS3Files(s3Request);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Error loading S3 files: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    // S3 import with progress tracking
    @PostMapping("/load-s3-progress")
    public ResponseEntity<Map<String, Object>> loadS3FilesWithProgress(@RequestBody S3Request s3Request) {
        String jobId = s3Request.getJobId();
        List<String> files = s3Request.getFiles();
        
        if (jobId == null || jobId.isEmpty()) {
            jobId = UUID.randomUUID().toString();
        }
        
        ImportProgress progress = new ImportProgress();
        progress.total = files.size();
        progress.status = "in_progress";
        progress.message = "Starting S3 import...";
        progressMap.put(jobId, progress);
        
        Map<String, Object> result = new HashMap<>();
        result.put("jobId", jobId);
        
        // Start processing in background thread
        new Thread(() -> {
            try {
                List<String> processedFiles = new java.util.ArrayList<>();
                List<String> failedFiles = new java.util.ArrayList<>();
                
                for (int i = 0; i < files.size(); i++) {
                    String fileKey = files.get(i);
                    try {
                        progress.message = "Processing " + fileKey + "...";
                        // Simulate processing time - increased for better visibility
                        Thread.sleep(800);
                        processedFiles.add(fileKey);
                        progress.processed++;
                    } catch (Exception e) {
                        failedFiles.add(fileKey + " (Error: " + e.getMessage() + ")");
                        progress.processed++;
                    }
                }
                
                progress.status = "done";
                progress.message = "Import completed. Processed: " + processedFiles.size() + ", Failed: " + failedFiles.size();
                
            } catch (Exception e) {
                progress.status = "error";
                progress.message = "Import failed: " + e.getMessage();
            }
        }).start();
        
        return ResponseEntity.ok(result);
    }

    // Local import with progress tracking
    @PostMapping("/load-local-progress")
    public ResponseEntity<Map<String, Object>> loadLocalFilesWithProgress(@RequestBody Map<String, Object> request) {
        List<String> files = (List<String>) request.get("files");
        String jobId = (String) request.get("jobId");
        
        if (jobId == null || jobId.isEmpty()) {
            jobId = UUID.randomUUID().toString();
        }
        
        ImportProgress progress = new ImportProgress();
        progress.total = files.size();
        progress.status = "in_progress";
        progress.message = "Starting local import...";
        progressMap.put(jobId, progress);
        
        Map<String, Object> result = new HashMap<>();
        result.put("jobId", jobId);
        
        // Start processing in background thread
        new Thread(() -> {
            try {
                List<String> processedFiles = new java.util.ArrayList<>();
                List<String> failedFiles = new java.util.ArrayList<>();
                
                for (int i = 0; i < files.size(); i++) {
                    String file = files.get(i);
                    try {
                        progress.message = "Processing " + file + "...";
                        // Simulate processing time - increased to 500ms to match S3
                        Thread.sleep(500);
                        processedFiles.add(file);
                        progress.processed++;
                    } catch (Exception e) {
                        failedFiles.add(file + " (Error: " + e.getMessage() + ")");
                        progress.processed++;
                    }
                }
                
                progress.status = "done";
                progress.message = "Import completed. Processed: " + processedFiles.size() + ", Failed: " + failedFiles.size();
                
            } catch (Exception e) {
                progress.status = "error";
                progress.message = "Import failed: " + e.getMessage();
            }
        }).start();
        
        return ResponseEntity.ok(result);
    }

    @PostMapping("/s3-metadata")
    public ResponseEntity<Map<String, Object>> getS3FileMetadata(@RequestBody S3Request s3Request) {
        try {
            Map<String, Object> metadata = s3Service.getS3FileMetadata(s3Request);
            return ResponseEntity.ok(metadata);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Error getting file metadata: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @PostMapping("/list-s3-all-files")
    public ResponseEntity<Map<String, Object>> listS3AllFiles(@RequestBody S3Request s3Request) {
        try {
            List<String> allFiles = s3Service.getAllFilesInFolder(s3Request);
            Map<String, Object> result = new HashMap<>();
            result.put("files", allFiles);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Error: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @DeleteMapping("/delete/{filename}")
    public ResponseEntity<String> deleteFile(@PathVariable String filename) {
        try {
            boolean deleted = fileService.deleteFile(filename);
            if (deleted) {
                return ResponseEntity.ok("File deleted: " + filename);
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("File not found: " + filename);
            }
        } catch (IOException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Could not delete file: " + ex.getMessage());
        }
    }

    // PostgreSQL endpoints
    @PostMapping("/list-postgres")
    public ResponseEntity<Map<String, Object>> listPostgres(@RequestBody PostgresRequest postgresRequest) {
        try {
            Map<String, Object> result = postgresService.listPostgresContents(postgresRequest);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Error: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @PostMapping("/list-postgres-all-objects")
    public ResponseEntity<Map<String, Object>> listPostgresAllObjects(@RequestBody PostgresRequest postgresRequest) {
        try {
            List<String> allObjects = postgresService.getAllDatabaseObjects(postgresRequest);
            Map<String, Object> result = new HashMap<>();
            result.put("files", allObjects);
            return ResponseEntity.ok(result);
        } catch (SQLException e) {
            Map<String, Object> error = new HashMap<>();
            String errorMessage = e.getMessage();
            
            // Handle specific PostgreSQL error codes
            if (errorMessage.contains("FATAL: password authentication failed")) {
                error.put("error", "Authentication failed: Wrong username or password");
                return ResponseEntity.status(401).body(error);
            } else if (errorMessage.contains("FATAL: role") && errorMessage.contains("does not exist")) {
                error.put("error", "User not found: The specified username does not exist");
                return ResponseEntity.status(401).body(error);
            } else if (errorMessage.contains("FATAL: database") && errorMessage.contains("does not exist")) {
                error.put("error", "Database not found: The specified database does not exist");
                return ResponseEntity.status(404).body(error);
            } else if (errorMessage.contains("Connection refused") || errorMessage.contains("Connection timed out")) {
                error.put("error", "Connection failed: Cannot connect to the database server. Please check if PostgreSQL is running and the host/port is correct");
                return ResponseEntity.status(503).body(error);
            } else if (errorMessage.contains("permission denied")) {
                error.put("error", "Access denied: Insufficient permissions to access the database");
                return ResponseEntity.status(403).body(error);
            } else {
                error.put("error", "Database error: " + errorMessage);
                return ResponseEntity.status(500).body(error);
            }
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Unexpected error: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @PostMapping("/postgres-table-preview")
    public ResponseEntity<Map<String, Object>> getPostgresTablePreview(@RequestBody PostgresRequest postgresRequest) {
        try {
            String tableName = postgresRequest.getTable();
            if (tableName == null || tableName.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Table name is required");
                return ResponseEntity.badRequest().body(error);
            }

            // Extract table name from schema.table format if present
            String actualTableName = tableName;
            if (tableName.contains(".")) {
                String[] parts = tableName.split("\\.");
                if (parts.length == 2) {
                    postgresRequest.setSchema(parts[0]);
                    actualTableName = parts[1];
                }
            }

            Map<String, Object> schema = postgresService.getTableSchema(postgresRequest, actualTableName);
            Map<String, Object> sample = postgresService.getTableSample(postgresRequest, actualTableName, 5);
            
            Map<String, Object> result = new HashMap<>();
            result.put("schema", schema);
            result.put("sample", sample);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to get table preview: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }
} 