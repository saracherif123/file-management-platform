import React, { useState } from 'react';
import { 
  Stack, 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Button, 
  IconButton, 
  InputAdornment 
} from '@mui/material';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

export default function S3Input({ 
  config, 
  onConfigChange, 
  onConnect, 
  loading = false 
}) {
  const [showSecretKey, setShowSecretKey] = useState(false);

  const handleChange = (field) => (event) => {
    onConfigChange({
      ...config,
      [field]: event.target.value
    });
  };

  return (
    <Stack spacing={2} sx={{ flex: 1 }}>
      {/* First row: Access Key and Secret Key */}
      <Stack direction="row" spacing={2} alignItems="center">
        <TextField
          label="Access Key"
          value={config.accessKey}
          onChange={handleChange('accessKey')}
          size="small"
          autoComplete="off"
          sx={{ flex: 1, minWidth: 200 }}
        />
        <TextField
          label="Secret Key"
          value={config.secretKey}
          onChange={handleChange('secretKey')}
          size="small"
          type={showSecretKey ? 'text' : 'password'}
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  edge="end"
                >
                  {showSecretKey ? <FaEyeSlash /> : <FaEye />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Stack>
      {/* Second row: Region and S3 Path */}
      <Stack direction="row" spacing={2} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="region-label">Region</InputLabel>
          <Select
            labelId="region-label"
            value={config.region}
            label="Region"
            onChange={handleChange('region')}
          >
            <MenuItem value="us-east-1">US East (N. Virginia)</MenuItem>
            <MenuItem value="us-west-2">US West (Oregon)</MenuItem>
            <MenuItem value="eu-west-1">Europe (Ireland)</MenuItem>
            <MenuItem value="eu-central-1">Europe (Frankfurt)</MenuItem>
            <MenuItem value="ap-southeast-1">Asia Pacific (Singapore)</MenuItem>
            <MenuItem value="ap-northeast-1">Asia Pacific (Tokyo)</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="S3 Path"
          value={config.s3Path}
          onChange={handleChange('s3Path')}
          size="small"
          placeholder="s3://bucket/prefix/"
          sx={{ flex: 1, minWidth: 300 }}
        />
        <Button 
          variant="contained" 
          onClick={onConnect} 
          disabled={loading || !config.accessKey || !config.secretKey || !config.s3Path}
          sx={{ minWidth: 100, height: 40 }}
        >
          {loading ? 'Connecting...' : 'Connect'}
        </Button>
      </Stack>
    </Stack>
  );
}
