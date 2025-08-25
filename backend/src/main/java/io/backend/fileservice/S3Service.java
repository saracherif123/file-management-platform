package io.backend.fileservice;

import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;
import software.amazon.awssdk.services.s3.model.CommonPrefix;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class S3Service {

    /**
     * List files and folders in S3 with optional recursive file counting
     */
    public Map<String, Object> listS3Contents(S3Request s3Request) {
        S3Client s3 = createS3Client(s3Request);
        
        ListObjectsV2Request listReq = ListObjectsV2Request.builder()
            .bucket(s3Request.getBucket())
            .prefix(s3Request.getPath() != null ? s3Request.getPath() : "")
            .delimiter("/")
            .build();

        ListObjectsV2Response listRes = s3.listObjectsV2(listReq);

        List<String> fileNames = listRes.contents().stream()
            .map(S3Object::key)
            .filter(key -> !key.equals(s3Request.getPath()))
            .collect(Collectors.toList());
            
        List<String> folders = listRes.commonPrefixes().stream()
            .map(CommonPrefix::prefix)
            .collect(Collectors.toList());

        // Get file sizes for current path files
        Map<String, Long> fileSizes = getFileSizes(listRes.contents(), s3Request.getPath());

        Map<String, Object> result = new HashMap<>();
        result.put("files", fileNames);
        result.put("folders", folders);
        result.put("fileSizes", fileSizes);

        // Add file counts (with safety limits)
        Map<String, Integer> folderFileCounts = getFolderFileCounts(s3, s3Request, folders);
        result.put("folderFileCounts", folderFileCounts);
        
        // Calculate total recursive count efficiently
        int recursiveFileCount = calculateRecursiveFileCount(fileNames, folderFileCounts);
        result.put("recursiveFileCount", recursiveFileCount);

        return result;
    }

    /**
     * Get all files recursively under a folder prefix
     */
    public List<String> getAllFilesInFolder(S3Request s3Request) {
        S3Client s3 = createS3Client(s3Request);
        
        List<String> allFiles = new java.util.ArrayList<>();
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
            
            for (S3Object obj : res.contents()) {
                if (!(s3Request.getPath() != null && obj.key().equals(s3Request.getPath()))) {
                    allFiles.add(obj.key());
                }
            }
            continuationToken = res.nextContinuationToken();
        } while (continuationToken != null);

        return allFiles;
    }

    /**
     * Download and prepare S3 files for processing
     */
    public Map<String, Object> loadS3Files(S3Request s3Request) {
        Map<String, Object> result = new HashMap<>();
        List<String> processedFiles = new java.util.ArrayList<>();
        List<String> failedFiles = new java.util.ArrayList<>();
        
        if (s3Request.getFiles() == null || s3Request.getFiles().isEmpty()) {
            result.put("error", "No files specified for loading");
            return result;
        }
        
        try {
            System.out.println("Creating S3 client with region: " + s3Request.getRegion());
            S3Client s3 = createS3Client(s3Request);
            System.out.println("S3 client created successfully");
            
            for (String fileKey : s3Request.getFiles()) {
                try {
                    System.out.println("Downloading file: " + fileKey + " from bucket: " + s3Request.getBucket());
                    // Download file from S3
                    String localFilePath = downloadS3File(s3, s3Request.getBucket(), fileKey);
                    processedFiles.add(localFilePath);
                    System.out.println("Successfully downloaded: " + localFilePath);
                    
                    // Here you would typically:
                    // 1. Validate the file format (CSV, JSON, Parquet, etc.)
                    // 2. Process the data
                    // 3. Store metadata about the loaded file
                    
                } catch (Exception e) {
                    System.err.println("Error downloading file " + fileKey + ": " + e.getMessage());
                    e.printStackTrace();
                    failedFiles.add(fileKey + " (Error: " + e.getMessage() + ")");
                }
            }
        } catch (Exception e) {
            System.err.println("Error creating S3 client: " + e.getMessage());
            e.printStackTrace();
            result.put("error", "Failed to create S3 client: " + e.getMessage());
            return result;
        }
        
        result.put("processedFiles", processedFiles);
        result.put("failedFiles", failedFiles);
        result.put("totalProcessed", processedFiles.size());
        result.put("totalFailed", failedFiles.size());
        
        return result;
    }
    
    /**
     * Download a single file from S3 to local storage
     */
    private String downloadS3File(S3Client s3, String bucket, String fileKey) throws Exception {
        // Create a unique local filename
        String fileName;
        int lastSlashIndex = fileKey.lastIndexOf('/');
        if (lastSlashIndex >= 0 && lastSlashIndex < fileKey.length() - 1) {
            fileName = fileKey.substring(lastSlashIndex + 1);
        } else {
            fileName = fileKey; // Use the full key if no slash or slash is at the end
        }
        
        // Sanitize filename to remove any invalid characters
        fileName = fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
        
        // Preserve folder structure and original filename
        String localFilePath = "uploads/" + fileKey;
        
        // Ensure uploads directory and all parent directories exist
        java.io.File localFile = new java.io.File(localFilePath);
        if (!localFile.getParentFile().exists()) {
            localFile.getParentFile().mkdirs();
        }
        
        // Download the file
        s3.getObject(builder -> builder
            .bucket(bucket)
            .key(fileKey)
            .build(), 
            java.nio.file.Paths.get(localFilePath)
        );
        
        return localFilePath;
    }

    /**
     * Get file metadata from S3 (size, last modified, etc.)
     */
    public Map<String, Object> getS3FileMetadata(S3Request s3Request) {
        S3Client s3 = createS3Client(s3Request);
        Map<String, Object> metadata = new HashMap<>();
        
        if (s3Request.getFiles() == null || s3Request.getFiles().isEmpty()) {
            metadata.put("error", "No files specified");
            return metadata;
        }
        
        for (String fileKey : s3Request.getFiles()) {
            try {
                var response = s3.headObject(builder -> builder
                    .bucket(s3Request.getBucket())
                    .key(fileKey)
                    .build()
                );
                
                Map<String, Object> fileInfo = new HashMap<>();
                fileInfo.put("size", response.contentLength());
                fileInfo.put("lastModified", response.lastModified());
                fileInfo.put("contentType", response.contentType());
                fileInfo.put("etag", response.eTag());
                
                metadata.put(fileKey, fileInfo);
                
            } catch (Exception e) {
                metadata.put(fileKey, "Error: " + e.getMessage());
            }
        }
        
        return metadata;
    }

    private S3Client createS3Client(S3Request s3Request) {
        System.out.println("Creating S3 client with access key: " + s3Request.getAccessKey().substring(0, 4) + "...");
        System.out.println("Secret key length: " + s3Request.getSecretKey().length());
        
        AwsBasicCredentials awsCreds = AwsBasicCredentials.create(
            s3Request.getAccessKey(), s3Request.getSecretKey()
        );
        
        // Handle region more safely
        String region = s3Request.getRegion();
        if (region == null || region.trim().isEmpty()) {
            region = "eu-central-1"; // Default region (Frankfurt)
        }
        
        System.out.println("Using region: " + region);
        
        try {
            Region awsRegion = Region.of(region.trim());
            System.out.println("AWS Region object created: " + awsRegion);
            
            S3Client client = S3Client.builder()
                .region(awsRegion)
                .credentialsProvider(StaticCredentialsProvider.create(awsCreds))
                .build();
            
            System.out.println("S3Client built successfully");
            return client;
        } catch (Exception e) {
            System.err.println("Error creating S3 client: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Invalid AWS region: " + region + ". Error: " + e.getMessage());
        }
    }

    private Map<String, Long> getFileSizes(List<S3Object> contents, String currentPath) {
        Map<String, Long> fileSizes = new HashMap<>();
        for (S3Object obj : contents) {
            if (!obj.key().equals(currentPath)) {
                fileSizes.put(obj.key(), obj.size());
            }
        }
        return fileSizes;
    }

    /**
     * Get file counts for folders with safety limits to avoid expensive operations
     */
    private Map<String, Integer> getFolderFileCounts(S3Client s3, S3Request s3Request, List<String> folders) {
        Map<String, Integer> folderFileCounts = new HashMap<>();
        
        for (String folderPrefix : folders) {
            int count = countFilesInFolder(s3, s3Request.getBucket(), folderPrefix);
            folderFileCounts.put(folderPrefix, count);
        }
        
        return folderFileCounts;
    }

    /**
     * Count files in a folder with safety limits
     */
    private int countFilesInFolder(S3Client s3, String bucket, String folderPrefix) {
        int count = 0;
        int maxCount = 1000; // Safety limit to avoid expensive operations
        String continuationToken = null;
        
        do {
            ListObjectsV2Request.Builder folderReqBuilder = ListObjectsV2Request.builder()
                .bucket(bucket)
                .prefix(folderPrefix);
            if (continuationToken != null) {
                folderReqBuilder.continuationToken(continuationToken);
            }
            ListObjectsV2Request folderReq = folderReqBuilder.build();
            ListObjectsV2Response folderRes = s3.listObjectsV2(folderReq);
            
            long newFiles = folderRes.contents().stream()
                .map(S3Object::key)
                .filter(key -> !key.equals(folderPrefix))
                .count();
            
            count += newFiles;
            
            // Safety check: if we're approaching the limit, stop counting
            if (count >= maxCount) {
                return maxCount; // Return max to indicate "many files"
            }
            
            continuationToken = folderRes.nextContinuationToken();
        } while (continuationToken != null);
        
        return count;
    }

    /**
     * Calculate total recursive file count efficiently
     */
    private int calculateRecursiveFileCount(List<String> currentFiles, Map<String, Integer> folderFileCounts) {
        int total = currentFiles.size();
        
        for (Integer folderCount : folderFileCounts.values()) {
            total += folderCount;
        }
        
        return total;
    }
} 