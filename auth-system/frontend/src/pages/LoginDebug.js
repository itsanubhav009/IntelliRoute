import React, { useState, useEffect } from 'react';
import axios from 'axios';

const LoginDebug = () => {
  const [logs, setLogs] = useState([]);
  const [serverInfo, setServerInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({
    username: 'itsanubhav009',
    password: ''
  });

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    setLogs(prev => [{timestamp, message, type}, ...prev]);
  };

  const checkServerStatus = async () => {
    addLog('Checking server status...', 'info');
    try {
      // Try to hit a simple endpoint to see if server is responding
      const response = await axios.get('http://localhost:5000/api');
      addLog(`Server is online: ${JSON.stringify(response.data)}`, 'success');
      setServerInfo(response.data);
    } catch (error) {
      // If that fails, try without /api
      try {
        const response = await axios.get('http://localhost:5000/');
        addLog(`Server is online at root: ${JSON.stringify(response.data)}`, 'success');
        setServerInfo(response.data);
      } catch (innerError) {
        addLog(`Server connection failed: ${innerError.message}`, 'error');
      }
    }
  };

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  const testLogin = async (endpoint) => {
    setLoading(true);
    addLog(`Attempting login at ${endpoint}...`, 'info');
    
    try {
      const response = await axios.post(endpoint, credentials);
      addLog(`Login successful! Response: ${JSON.stringify(response.data)}`, 'success');
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        addLog('Token saved to localStorage', 'success');
      }
      
      return true;
    } catch (error) {
      let errorMsg = 'Unknown error';
      
      if (error.response) {
        errorMsg = `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        errorMsg = 'No response received from server';
      } else {
        errorMsg = error.message;
      }
      
      addLog(`Login failed: ${errorMsg}`, 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Test multiple login endpoints to find the correct one
  const testAllEndpoints = async () => {
    setLoading(true);
    addLog('Testing all possible login endpoints...', 'info');
    
    const endpoints = [
      'http://localhost:5000/api/auth/login',
      'http://localhost:5000/auth/login',
      'http://localhost:5000/api/login',
      'http://localhost:5000/login'
    ];
    
    let success = false;
    
    for (const endpoint of endpoints) {
      addLog(`Trying endpoint: ${endpoint}`, 'info');
      success = await testLogin(endpoint);
      if (success) {
        addLog(`Found working endpoint: ${endpoint}`, 'success');
        break;
      }
    }
    
    if (!success) {
      addLog('All login attempts failed', 'error');
    }
    
    setLoading(false);
    return success;
  };

  // Try different request formats that might be expected by the server
  const testAlternativePayloads = async () => {
    setLoading(true);
    addLog('Testing alternative payload formats...', 'info');
    
    const endpoint = 'http://localhost:5000/api/auth/login';
    const payloads = [
      // Standard username/password
      { username: credentials.username, password: credentials.password },
      // Try with email field instead
      { email: credentials.username, password: credentials.password },
      // Try with both
      { username: credentials.username, email: credentials.username, password: credentials.password },
      // Try with user object wrapper
      { user: { username: credentials.username, password: credentials.password } }
    ];
    
    let success = false;
    
    for (const payload of payloads) {
      addLog(`Trying payload: ${JSON.stringify(payload)}`, 'info');
      
      try {
        const response = await axios.post(endpoint, payload);
        addLog(`Login successful with payload! Response: ${JSON.stringify(response.data)}`, 'success');
        
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          addLog('Token saved to localStorage', 'success');
        }
        
        success = true;
        break;
      } catch (error) {
        let errorMsg = 'Unknown error';
        
        if (error.response) {
          errorMsg = `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`;
        } else if (error.request) {
          errorMsg = 'No response received from server';
        } else {
          errorMsg = error.message;
        }
        
        addLog(`Payload failed: ${errorMsg}`, 'error');
      }
    }
    
    setLoading(false);
    return success;
  };

  useEffect(() => {
    checkServerStatus();
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Login Debugging Tool</h1>
      
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
        <h3>Server Status</h3>
        {serverInfo ? (
          <pre>{JSON.stringify(serverInfo, null, 2)}</pre>
        ) : (
          <p>Checking server status...</p>
        )}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Credentials</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <input
            type="text"
            name="username"
            value={credentials.username}
            onChange={handleChange}
            placeholder="Username"
            style={{ padding: '8px', flex: 1 }}
          />
          <input
            type="password"
            name="password"
            value={credentials.password}
            onChange={handleChange}
            placeholder="Password"
            style={{ padding: '8px', flex: 1 }}
          />
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => testLogin('http://localhost:5000/api/auth/login')}
          disabled={loading || !credentials.password}
          style={{
            padding: '10px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (loading || !credentials.password) ? 'not-allowed' : 'pointer'
          }}
        >
          Test Login
        </button>
        
        <button
          onClick={testAllEndpoints}
          disabled={loading || !credentials.password}
          style={{
            padding: '10px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (loading || !credentials.password) ? 'not-allowed' : 'pointer'
          }}
        >
          Test All Endpoints
        </button>
        
        <button
          onClick={testAlternativePayloads}
          disabled={loading || !credentials.password}
          style={{
            padding: '10px',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (loading || !credentials.password) ? 'not-allowed' : 'pointer'
          }}
        >
          Test Alt Payloads
        </button>
        
        <button
          onClick={() => {
            localStorage.removeItem('token');
            addLog('Token cleared from localStorage', 'info');
          }}
          style={{
            padding: '10px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear Token
        </button>
      </div>
      
      <div>
        <h3>Debug Logs</h3>
        <div style={{ 
          height: '300px', 
          overflowY: 'auto', 
          backgroundColor: '#f5f5f5', 
          padding: '10px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div 
                key={index}
                style={{
                  padding: '5px',
                  borderBottom: '1px solid #ddd',
                  color: log.type === 'error' ? '#f44336' : 
                        log.type === 'success' ? '#4CAF50' : '#2196F3'
                }}
              >
                <span style={{ color: '#666' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
              </div>
            ))
          ) : (
            <p>No logs yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginDebug;