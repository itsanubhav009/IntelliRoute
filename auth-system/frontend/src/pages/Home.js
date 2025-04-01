import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated } = useContext(AuthContext) || {};

  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem 1rem',
  };

  const heroStyle = {
    textAlign: 'center',
    padding: '3rem 1rem',
    marginBottom: '3rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  };

  const buttonContainerStyle = {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    marginTop: '2rem',
  };

  const buttonStyle = {
    padding: '0.8rem 1.8rem',
    borderRadius: '4px',
    fontWeight: 'bold',
    textDecoration: 'none',
    display: 'inline-block',
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#3498db',
    color: 'white',
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#2ecc71',
    color: 'white',
  };

  const featuresStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '2rem',
    marginBottom: '3rem',
  };

  const featureCardStyle = {
    padding: '2rem',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
  };

  return (
    <div style={containerStyle}>
      <div style={heroStyle}>
        <h1 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Welcome to Location Tracker</h1>
        <p style={{ fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto 2rem', color: '#7f8c8d' }}>
          Connect with other users around the world by sharing your selected location.
        </p>
        
        <div style={buttonContainerStyle}>
          {!isAuthenticated ? (
            <>
              <Link to="/login" style={primaryButtonStyle}>
                Login
              </Link>
              <Link to="/register" style={secondaryButtonStyle}>
                Register
              </Link>
            </>
          ) : (
            <>
              <Link to="/profile" style={primaryButtonStyle}>
                View Profile
              </Link>
              <Link to="/live-users" style={secondaryButtonStyle}>
                See Live Users
              </Link>
            </>
          )}
        </div>
      </div>
      
      <div style={featuresStyle}>
        <div style={featureCardStyle}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌍</div>
          <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Select Your Location</h3>
          <p style={{ color: '#7f8c8d' }}>Choose your location from our predefined list of cities across India.</p>
        </div>
        
        <div style={featureCardStyle}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
          <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Find Others</h3>
          <p style={{ color: '#7f8c8d' }}>See other users who are currently online and their chosen locations.</p>
        </div>
        
        <div style={featureCardStyle}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Privacy First</h3>
          <p style={{ color: '#7f8c8d' }}>Your location is only what you select. No GPS or actual location tracking.</p>
        </div>
      </div>
    </div>
  );
};

export default Home;