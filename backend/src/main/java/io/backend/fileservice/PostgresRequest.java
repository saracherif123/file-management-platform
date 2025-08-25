package io.backend.fileservice;

import lombok.Data;
import java.util.List;

@Data
public class PostgresRequest {
    private String host;
    private int port;
    private String database;
    private String username;
    private String password;
    private String schema;
    private String table;
    private List<String> tables;
    private String jobId;
}
