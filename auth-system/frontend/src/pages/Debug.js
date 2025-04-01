import React, { useState } from 'react';
import axios from 'axios';

const Debug = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const testEndpoint = async (url, method = 'get', data = null) => {
    setLoading(true);
    try {
      const response = method === 'post' 
        ? await axios.post(url, data)
        : await axios.get(url);
        
      setResults(prev => [
        { url, status: 'success', statusCode: response.status, data: response.data },
        ...prev
      ]);
      return true;
    } catch (error) {
      setResults(prev => [
        { 
          url, 
          status: 'error', 
          statusCode: error.response?.status || 'N/A',
          message: error.message,
          data: error.response?.data
        },
        ...prev
      ]);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const testLoginEndpoints = async () => {
    const testData = { email: 'itsanubhav009@example.com', password: 'password123' };
    
    // Test various endpoint combinations
    await testEndpoint('http://localhost:5000/api/auth/login', 'post', testData);
    await testEndpoint('http://localhost:5000/auth/login', 'post', testData);
    await testEndpoint('http://localhost:5000/api/login', 'post', testData);
    await testEndpoint('http://localhost:5000/login', 'post', testData);
  };

  const testProfileEndpoints = async () => {
    const token = localStorage.getItem('token');
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    
    // Test various endpoint combinations with token if available
    await testEndpoint('http://localhost:5000/api/auth/profile', 'get', null, config);
    await testEndpoint('http://localhost:5000/auth/profile', 'get', null, config);
    await testEndpoint('http://localhost:5000/api/profile', 'get', null, config);
    await testEndpoint('http://localhost:5000/profile', 'get', null, config);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>API Endpoint Debug Tool</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={testLoginEndpoints}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginRight: '10px'
          }}
        >
          Test Login Endpoints
        </button>
        
        <button 
          onClick={testProfileEndpoints}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Test Profile Endpoints
        </button>
      </div>
      
      <div>
        <h2>Results</h2>
        {results.length === 0 ? (
          <p>No tests run yet</p>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {results.map((result, index) => (
              <div 
                key={index}
                style={{
                  padding: '10px',
                  margin: '10px 0',
                  backgroundColor: result.status === 'success' ? '#d4edda' : '#f8d7da',
                  borderRadius: '4px'
                }}
              >
                <p><strong>URL:</strong> {result.url}</p>
                <p><strong>Status:</strong> {result.status} ({result.statusCode})</p>
                {result.message && <p><strong>Message:</strong> {result.message}</p>}
                <details>
                  <summary>Response Data</summary>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Debug;