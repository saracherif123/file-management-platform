package io.backend.fileservice;

import java.util.List;

public class S3Request {
    private String accessKey;
    private String secretKey;
    private String bucket;
    private String path;
    private List<String> files;

    public String getAccessKey() { return accessKey; }
    public void setAccessKey(String accessKey) { this.accessKey = accessKey; }
    public String getSecretKey() { return secretKey; }
    public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
    public String getBucket() { return bucket; }
    public void setBucket(String bucket) { this.bucket = bucket; }
    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }
    public List<String> getFiles() { return files; }
    public void setFiles(List<String> files) { this.files = files; }
} 