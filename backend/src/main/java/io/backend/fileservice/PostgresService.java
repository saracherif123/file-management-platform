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
    public List<String> getAllDatabaseObjects(PostgresRequest request) throws SQLException {
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
            
        } catch (SQLException e) {
            // Re-throw SQL exceptions to be handled by the controller
            throw e;
        } catch (Exception e) {
            // Wrap other exceptions
            throw new SQLException("Database error: " + e.getMessage(), e);
        }
        
        return allObjects;
    }


    /**
     * Create database connection
     */
    private Connection createConnection(PostgresRequest request) throws SQLException {

        String url = String.format("jdbc:postgresql://%s:%d/%s",
                request.getHost(), request.getPort(), request.getDatabase());

        return DriverManager.getConnection(url, request.getUsername(), request.getPassword());
    }


 

    /**
     * Get all user-defined schemas (exclude system and analytics schemas)
     */
    private List<String> getSchemas(Connection connection) throws SQLException {
        List<String> schemas = new ArrayList<>();
        
        try (Statement stmt = connection.createStatement();
             ResultSet rs = stmt.executeQuery(
                 "SELECT schema_name FROM information_schema.schemata " +
                 "WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast') " +
                 "AND schema_name NOT LIKE 'pg_%' " +
                 "AND schema_name NOT LIKE 'temp%' " +
                 "AND schema_name NOT LIKE 'tmp%' " +
                 "AND schema_name NOT LIKE 'pgagent%' " +
                 "AND schema_name NOT LIKE 'pg_stat%' " +
                 "AND schema_name NOT LIKE 'pg_temp%' " +
                 "AND schema_name NOT LIKE 'pg_toast%' " +
                 "AND schema_name NOT LIKE 'information_schema%' " +
                 "AND schema_name NOT LIKE 'cron%' " +
                 "AND schema_name NOT LIKE 'extensions%' " +
                 "AND schema_name NOT LIKE 'realtime%' " +
                 "AND schema_name NOT LIKE 'supabase%' " +
                 "AND schema_name NOT LIKE 'auth%' " +
                 "AND schema_name NOT LIKE 'storage%' " +
                 "AND schema_name NOT LIKE 'vault%' " +
                 "AND schema_name NOT LIKE 'graphql%' " +
                 "AND schema_name NOT LIKE 'graphql_public%' " +
                 "AND schema_name NOT LIKE 'net%' " +
                 "AND schema_name NOT LIKE 'tiger%' " +
                 "AND schema_name NOT LIKE 'tiger_data%' " +
                 "AND schema_name NOT LIKE 'topology%' " +
                 "AND schema_name NOT LIKE 'analytics%' " +
                 "ORDER BY schema_name")) {
            
            while (rs.next()) {
                schemas.add(rs.getString("schema_name"));
            }
        }
        
        return schemas;
    }

    /**
     * Get all user-defined tables in a schema (exclude system tables)
     */
    private List<String> getTablesInSchema(Connection connection, String schema) throws SQLException {
        List<String> tables = new ArrayList<>();
        
        try (PreparedStatement stmt = connection.prepareStatement(
                "SELECT table_name FROM information_schema.tables " +
                "WHERE table_schema = ? AND table_type = 'BASE TABLE' " +
                "AND table_name NOT LIKE 'pg_%' " +
                "AND table_name NOT LIKE 'sql_%' " +
                "AND table_name NOT LIKE 'temp%' " +
                "AND table_name NOT LIKE 'tmp%' " +
                "AND table_name NOT IN ('schema_migrations', 'ar_internal_metadata', 'sessions', 'pg_stat_statements', 'pg_stat_activity', 'pg_stat_database', 'pg_stat_user_tables', 'pg_stat_user_indexes', 'pg_stat_user_functions') " +
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
     * Get all user-defined views in a schema (exclude system views)
     */
    private List<String> getViewsInSchema(Connection connection, String schema) throws SQLException {
        List<String> views = new ArrayList<>();
        
        try (PreparedStatement stmt = connection.prepareStatement(
                "SELECT table_name FROM information_schema.views " +
                "WHERE table_schema = ? " +
                "AND table_name NOT LIKE 'pg_%' " +
                "AND table_name NOT LIKE 'sql_%' " +
                "AND table_name NOT LIKE 'temp%' " +
                "AND table_name NOT LIKE 'tmp%' " +
                "ORDER BY table_name")) {
            
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

    /**
     * Get table schema information
     */
    public Map<String, Object> getTableSchema(PostgresRequest request, String tableName) throws SQLException {
        Map<String, Object> result = new HashMap<>();
        List<Map<String, String>> columns = new ArrayList<>();
        
        try (Connection connection = createConnection(request)) {
            String schema = request.getSchema();
            if (schema == null || schema.isEmpty()) {
                schema = "public"; // Default to public schema
            }
            
            try (PreparedStatement stmt = connection.prepareStatement(
                    "SELECT column_name, data_type, is_nullable, column_default, character_maximum_length " +
                    "FROM information_schema.columns " +
                    "WHERE table_schema = ? AND table_name = ? " +
                    "ORDER BY ordinal_position")) {
                
                stmt.setString(1, schema);
                stmt.setString(2, tableName);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Map<String, String> column = new HashMap<>();
                        column.put("name", rs.getString("column_name"));
                        column.put("type", rs.getString("data_type"));
                        column.put("nullable", rs.getString("is_nullable"));
                        column.put("default", rs.getString("column_default"));
                        column.put("maxLength", rs.getString("character_maximum_length"));
                        columns.add(column);
                    }
                }
            }
            
            result.put("table", schema + "." + tableName);
            result.put("columns", columns);
        }
        
        return result;
    }

    /**
     * Get sample data from a table
     */
    public Map<String, Object> getTableSample(PostgresRequest request, String tableName, int limit) throws SQLException {
        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        List<String> columnNames = new ArrayList<>();
        
        try (Connection connection = createConnection(request)) {
            String schema = request.getSchema();
            if (schema == null || schema.isEmpty()) {
                schema = "public"; // Default to public schema
            }
            
            // Get column names first
            try (PreparedStatement stmt = connection.prepareStatement(
                    "SELECT column_name FROM information_schema.columns " +
                    "WHERE table_schema = ? AND table_name = ? " +
                    "ORDER BY ordinal_position")) {
                
                stmt.setString(1, schema);
                stmt.setString(2, tableName);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        columnNames.add(rs.getString("column_name"));
                    }
                }
            }
            
            // Get sample data
            try (PreparedStatement stmt = connection.prepareStatement(
                    "SELECT * FROM " + schema + "." + tableName + " LIMIT ?")) {
                
                stmt.setInt(1, limit);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> row = new HashMap<>();
                        for (int i = 0; i < columnNames.size(); i++) {
                            String columnName = columnNames.get(i);
                            Object value = rs.getObject(i + 1);
                            row.put(columnName, value);
                        }
                        rows.add(row);
                    }
                }
            }
            
            result.put("table", schema + "." + tableName);
            result.put("columns", columnNames);
            result.put("rows", rows);
            result.put("limit", limit);
        }
        
        return result;
    }

    /**
     * Drop a database object (table or view)
     */
    public boolean dropDatabaseObject(PostgresRequest request, String objectName, String schema) throws SQLException {
        try (Connection connection = createConnection(request)) {
            // First check if it's a table or view
            String checkQuery = "SELECT table_type FROM information_schema.tables WHERE table_schema = ? AND table_name = ?";
            String objectType = null;
            
            try (PreparedStatement stmt = connection.prepareStatement(checkQuery)) {
                stmt.setString(1, schema);
                stmt.setString(2, objectName);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        objectType = rs.getString("table_type");
                    }
                }
            }
            
            if (objectType == null) {
                return false; // Object doesn't exist
            }
            
            // Drop the object
            String dropQuery;
            if ("VIEW".equals(objectType)) {
                dropQuery = "DROP VIEW IF EXISTS " + schema + "." + objectName + " CASCADE";
            } else {
                dropQuery = "DROP TABLE IF EXISTS " + schema + "." + objectName + " CASCADE";
            }
            
            try (Statement stmt = connection.createStatement()) {
                stmt.executeUpdate(dropQuery);
                return true;
            }
            
        } catch (SQLException e) {
            System.err.println("Error dropping database object: " + e.getMessage());
            throw e;
        }
    }
}
