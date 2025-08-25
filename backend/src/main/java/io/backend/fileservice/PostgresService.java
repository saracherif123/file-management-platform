package io.backend.fileservice;

import org.springframework.stereotype.Service;
import java.sql.*;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PostgresService {

    /**
     * List all schemas, tables, and views in PostgreSQL
     */
    public Map<String, Object> listPostgresContents(PostgresRequest request) {
        Map<String, Object> result = new HashMap<>();
        
        try (Connection connection = createConnection(request)) {
            // Get all schemas
            List<String> schemas = getSchemas(connection);
            
            // Get all tables and views
            List<String> databaseObjects = getDatabaseObjects(connection, schemas);
            
            result.put("schemas", schemas);
            result.put("files", databaseObjects); // Tables and views as "files"
            result.put("totalObjects", databaseObjects.size());
            
        } catch (Exception e) {
            result.put("error", "Failed to connect to PostgreSQL: " + e.getMessage());
        }
        
        return result;
    }

    /**
     * Get all database objects (tables, views) recursively
     */
    public List<String> getAllDatabaseObjects(PostgresRequest request) {
        List<String> allObjects = new ArrayList<>();
        
        try (Connection connection = createConnection(request)) {
            // Get all schemas
            List<String> schemas = getSchemas(connection);
            
            // Get all tables and views from all schemas
            for (String schema : schemas) {
                List<String> tables = getTablesInSchema(connection, schema);
                List<String> views = getViewsInSchema(connection, schema);
                
                // Add tables with schema prefix
                allObjects.addAll(tables.stream()
                    .map(table -> schema + "." + table)
                    .collect(Collectors.toList()));
                
                // Add views with schema prefix
                allObjects.addAll(views.stream()
                    .map(view -> schema + "." + view)
                    .collect(Collectors.toList()));
            }
            
        } catch (Exception e) {
            System.err.println("Error getting database objects: " + e.getMessage());
        }
        
        return allObjects;
    }


    /**
     * Create database connection
     */
    private Connection createConnection(PostgresRequest request) throws SQLException {

        System.out.println("Connecting to PostgreSQL at " + request.getHost() + ":" + request.getPort() + "/"
                + request.getDatabase());
        System.out.println("Using user: " + request.getUsername());
        System.out.println("Using password: " + request.getPassword());

        String url = String.format("jdbc:postgresql://%s:%d/%s",
                request.getHost(), request.getPort(), request.getDatabase());

        return DriverManager.getConnection(url, request.getUsername(), request.getPassword());
    }


 

    /**
     * Get all schemas
     */
    private List<String> getSchemas(Connection connection) throws SQLException {
        List<String> schemas = new ArrayList<>();
        
        try (Statement stmt = connection.createStatement();
             ResultSet rs = stmt.executeQuery(
                 "SELECT schema_name FROM information_schema.schemata " +
                 "WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast') " +
                 "ORDER BY schema_name")) {
            
            while (rs.next()) {
                schemas.add(rs.getString("schema_name"));
            }
        }
        
        return schemas;
    }

    /**
     * Get all tables in a schema
     */
    private List<String> getTablesInSchema(Connection connection, String schema) throws SQLException {
        List<String> tables = new ArrayList<>();
        
        try (PreparedStatement stmt = connection.prepareStatement(
                "SELECT table_name FROM information_schema.tables " +
                "WHERE table_schema = ? AND table_type = 'BASE TABLE' " +
                "ORDER BY table_name")) {
            
            stmt.setString(1, schema);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    tables.add(rs.getString("table_name"));
                }
            }
        }
        
        return tables;
    }

    /**
     * Get all views in a schema
     */
    private List<String> getViewsInSchema(Connection connection, String schema) throws SQLException {
        List<String> views = new ArrayList<>();
        
        try (PreparedStatement stmt = connection.prepareStatement(
                "SELECT table_name FROM information_schema.views " +
                "WHERE table_schema = ? ORDER BY table_name")) {
            
            stmt.setString(1, schema);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    views.add(rs.getString("table_name"));
                }
            }
        }
        
        return views;
    }

    /**
     * Get database objects for the main listing
     */
    private List<String> getDatabaseObjects(Connection connection, List<String> schemas) throws SQLException {
        List<String> objects = new ArrayList<>();
        
        for (String schema : schemas) {
            List<String> tables = getTablesInSchema(connection, schema);
            List<String> views = getViewsInSchema(connection, schema);
            
            // Add tables with schema prefix
            objects.addAll(tables.stream()
                .map(table -> schema + "." + table)
                .collect(Collectors.toList()));
            
            // Add views with schema prefix
            objects.addAll(views.stream()
                .map(view -> schema + "." + view)
                .collect(Collectors.toList()));
        }
        
        return objects;
    }
}
