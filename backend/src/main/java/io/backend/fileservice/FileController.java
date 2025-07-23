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

import java.io.IOException;
import java.net.MalformedURLException;
import java.util.List;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.s3.model.CommonPrefix;
import java.util.HashMap;
import java.util.Map;

@CrossOrigin(origins = "http://localhost:3000")
@RestController
@RequestMapping("/rest")
public class FileController {

    private final FileService fileService;

    @Autowired
    public FileController(FileService fileService) {
        this.fileService = fileService;
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
            AwsBasicCredentials awsCreds = AwsBasicCredentials.create(
                s3Request.getAccessKey(), s3Request.getSecretKey()
            );
            S3Client s3 = S3Client.builder()
                .region(Region.EU_CENTRAL_1) // Change to your region if needed
                .credentialsProvider(StaticCredentialsProvider.create(awsCreds))
                .build();

            ListObjectsV2Request listReq = ListObjectsV2Request.builder()
                .bucket(s3Request.getBucket())
                .prefix(s3Request.getPath() != null ? s3Request.getPath() : "")
                .delimiter("/")
                .build();

            ListObjectsV2Response listRes = s3.listObjectsV2(listReq);

            List<String> fileNames = listRes.contents().stream()
                .map(S3Object::key)
                .filter(key -> !key.equals(s3Request.getPath())) // Exclude the folder itself
                .collect(Collectors.toList());
            List<String> folders = listRes.commonPrefixes().stream()
                .map(CommonPrefix::prefix)
                .collect(Collectors.toList());

            // New: For each folder, count the number of files recursively (all files under the prefix)
            Map<String, Integer> folderFileCounts = new HashMap<>();
            for (String folderPrefix : folders) {
                int count = 0;
                String continuationToken = null;
                do {
                    ListObjectsV2Request.Builder folderReqBuilder = ListObjectsV2Request.builder()
                        .bucket(s3Request.getBucket())
                        .prefix(folderPrefix);
                    if (continuationToken != null) {
                        folderReqBuilder.continuationToken(continuationToken);
                    }
                    ListObjectsV2Request folderReq = folderReqBuilder.build();
                    ListObjectsV2Response folderRes = s3.listObjectsV2(folderReq);
                    // Exclude the folder itself from the count
                    count += folderRes.contents().stream()
                        .map(S3Object::key)
                        .filter(key -> !key.equals(folderPrefix))
                        .count();
                    continuationToken = folderRes.nextContinuationToken();
                } while (continuationToken != null);
                folderFileCounts.put(folderPrefix, count);
            }

            // New: Count all files recursively under the current path
            int recursiveFileCount = 0;
            String continuationToken = null;
            do {
                ListObjectsV2Request.Builder reqBuilder = ListObjectsV2Request.builder()
                    .bucket(s3Request.getBucket())
                    .prefix(s3Request.getPath() != null ? s3Request.getPath() : "");
                if (continuationToken != null) {
                    reqBuilder.continuationToken(continuationToken);
                }
                ListObjectsV2Request req = reqBuilder.build();
                ListObjectsV2Response res = s3.listObjectsV2(req);
                recursiveFileCount += res.contents().stream()
                    .map(S3Object::key)
                    .filter(key -> !(s3Request.getPath() != null && key.equals(s3Request.getPath())))
                    .count();
                continuationToken = res.nextContinuationToken();
            } while (continuationToken != null);

            Map<String, Object> result = new HashMap<>();
            result.put("files", fileNames);
            result.put("folders", folders);
            result.put("folderFileCounts", folderFileCounts); // New field
            result.put("recursiveFileCount", recursiveFileCount); // New field
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Error: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @PostMapping("/load-s3")
    public ResponseEntity<String> loadS3Files(@RequestBody S3Request s3Request) {
        Logger logger = LoggerFactory.getLogger(FileController.class);
        logger.info("Received S3 files to load: {}", s3Request.getFiles());
        // Here you can process the files as needed
        return ResponseEntity.ok("S3 files received for processing.");
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
} 