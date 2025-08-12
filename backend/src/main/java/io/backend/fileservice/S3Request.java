package io.backend.fileservice;

import lombok.Data;
import java.util.List;

@Data
public class S3Request {
    private String accessKey;
    private String secretKey;
    private String bucket;
    private String path;
    private List<String> files;
    private String region;
    private String jobId;
} 