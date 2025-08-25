import React from 'react';
import { 
  Stack, 
  Button, 
  TextField,
  Typography,
  Box,
  Alert
} from '@mui/material';
import { Storage } from '@mui/icons-material';

export default function PostgresInput({ 
  config, 
  onConfigChange, 
  onConnect, 
  loading = false,
  error = null
}) {
  const handleInputChange = (field, value) => {
    onConfigChange({
      ...config,
      [field]: value
    });
  };

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Storage color="primary" />
        <Typography variant="h6">PostgreSQL Connection</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack spacing={2}>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Host"
            value={config.host || ''}
            onChange={(e) => handleInputChange('host', e.target.value)}
            placeholder="localhost"
            fullWidth
            size="small"
          />
          <TextField
            label="Port"
            value={config.port || ''}
            onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 5432)}
            placeholder="5432"
            type="number"
            size="small"
            sx={{ minWidth: 120 }}
          />
        </Stack>

        <TextField
          label="Database"
          value={config.database || ''}
          onChange={(e) => handleInputChange('database', e.target.value)}
          placeholder="testdb"
          fullWidth
          size="small"
        />

        <Stack direction="row" spacing={2}>
          <TextField
            label="Username"
            value={config.username || ''}
            onChange={(e) => handleInputChange('username', e.target.value)}
            placeholder="postgres"
            fullWidth
            size="small"
          />
          <TextField
            label="Password"
            value={config.password || ''}
            onChange={(e) => handleInputChange('password', e.target.value)}
            type="password"
            placeholder="••••••••"
            fullWidth
            size="small"
          />
        </Stack>

        <TextField
          label="Schema (Optional)"
          value={config.schema || ''}
          onChange={(e) => handleInputChange('schema', e.target.value)}
          placeholder="public"
          fullWidth
          size="small"
          helperText="Leave empty to connect to all schemas"
        />
      </Stack>

      <Button
        variant="contained"
        onClick={onConnect}
        disabled={loading || !config.host || !config.database || !config.username || !config.password}
        size="large"
        sx={{ mt: 2 }}
      >
        {loading ? 'Connecting...' : 'Connect to PostgreSQL'}
      </Button>

      <Typography variant="body2" color="text.secondary">
        <strong>Note:</strong> This will connect to your PostgreSQL database and list all available tables and views.
        Make sure your database is accessible and credentials are correct.
      </Typography>
    </Stack>
  );
}
