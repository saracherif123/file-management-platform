package io.backend.fileservice;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class FileService {
    private final Path fileStorageLocation;

    public FileService(@Value("${file.upload-dir:uploads}") String uploadDir) throws IOException {
        this.fileStorageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(this.fileStorageLocation);
    }

    public String storeFile(MultipartFile file) throws IOException {
        String fileName = StringUtils.cleanPath(file.getOriginalFilename());
        
        // Validate filename for path traversal attacks
        if (!isValidFileName(fileName)) {
            throw new IOException("Invalid file path: " + fileName);
        }
        
        Path targetLocation = this.fileStorageLocation.resolve(fileName).normalize();
        
        // Additional security check: ensure the resolved path is within the upload directory
        if (!targetLocation.startsWith(this.fileStorageLocation)) {
            throw new IOException("Path traversal attack detected: " + fileName);
        }
        
        // Ensure parent directories exist
        Files.createDirectories(targetLocation.getParent());
        file.transferTo(targetLocation);
        return fileName;
    }
    
    /**
     * Validates filename for path traversal attacks and other security issues
     */
    private boolean isValidFileName(String fileName) {
        if (fileName == null || fileName.isEmpty()) {
            return false;
        }
        
        // Normalize the filename for consistent checking
        String normalized = fileName.replace("\\", "/").toLowerCase();
        
        // Check for common path traversal patterns
        String[] dangerousPatterns = {
            "..",           // Basic directory traversal
            "....",         // Double encoded
            "%2e%2e",       // URL encoded
            "%252e%252e",   // Double URL encoded
            "..%2f",        // Mixed encoding
            "%2e%2e%2f",    // URL encoded traversal
            "..%5c",        // Backslash encoding
            "%2e%2e%5c",    // URL encoded backslash
            "..\\",         // Backslash traversal
            "..%c0%af",     // UTF-8 encoding bypass
            "..%c1%9c",     // UTF-8 encoding bypass
            "..%ef%bc%8f",  // Full-width slash
            "..%c0%2f",     // Null byte injection
            "..%c0%5c",     // Null byte injection
            "..%00",        // Null byte
            "..%0d",        // Carriage return
            "..%0a",        // Line feed
            "..%09",        // Tab
            "..%20",        // Space
            "..%7f",        // Delete
            "..%ff"         // Extended ASCII
        };
        
        for (String pattern : dangerousPatterns) {
            if (normalized.contains(pattern)) {
                return false;
            }
        }
        
        // Check for absolute paths
        if (fileName.startsWith("/") || fileName.startsWith("\\") || 
            (fileName.length() > 2 && fileName.charAt(1) == ':')) {
            return false;
        }
        
        // Check for control characters
        for (char c : fileName.toCharArray()) {
            if (Character.isISOControl(c)) {
                return false;
            }
        }
        
        // Check for reserved characters in Windows
        String[] reservedChars = {"<", ">", ":", "\"", "|", "?", "*"};
        for (String reserved : reservedChars) {
            if (fileName.contains(reserved)) {
                return false;
            }
        }
        
        // Check for reserved names in Windows
        String[] reservedNames = {
            "CON", "PRN", "AUX", "NUL",
            "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
            "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
        };
        
        String nameWithoutExtension = fileName;
        int lastDot = fileName.lastIndexOf('.');
        if (lastDot > 0) {
            nameWithoutExtension = fileName.substring(0, lastDot);
        }
        
        for (String reserved : reservedNames) {
            if (nameWithoutExtension.equalsIgnoreCase(reserved)) {
                return false;
            }
        }
        
        return true;
    }

    public Resource loadFileAsResource(String filename) throws MalformedURLException {
        // Validate filename for path traversal attacks
        if (!isValidFileName(filename)) {
            throw new MalformedURLException("Invalid file path: " + filename);
        }
        
        Path filePath = this.fileStorageLocation.resolve(filename).normalize();
        
        // Additional security check: ensure the resolved path is within the upload directory
        if (!filePath.startsWith(this.fileStorageLocation)) {
            throw new MalformedURLException("Path traversal attack detected: " + filename);
        }
        
        Resource resource = new UrlResource(filePath.toUri());
        if (resource.exists()) {
            return resource;
        } else {
            throw new MalformedURLException("File not found: " + filename);
        }
    }

    public List<String> listFiles() throws IOException {
        try (Stream<Path> stream = Files.walk(this.fileStorageLocation)) {
            return stream
                    .filter(Files::isRegularFile)
                    .map(path -> this.fileStorageLocation.relativize(path).toString().replace("\\", "/"))
                    .collect(Collectors.toList());
        }
    }

    public boolean deleteFile(String filename) throws IOException {
        // Validate filename for path traversal attacks
        if (!isValidFileName(filename)) {
            throw new IOException("Invalid file path: " + filename);
        }
        
        Path filePath = this.fileStorageLocation.resolve(filename).normalize();
        
        // Additional security check: ensure the resolved path is within the upload directory
        if (!filePath.startsWith(this.fileStorageLocation)) {
            throw new IOException("Path traversal attack detected: " + filename);
        }
        
        return Files.deleteIfExists(filePath);
    }
} 