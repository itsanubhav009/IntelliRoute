import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Header = () => {
  const { isAuthenticated, logout, user } = useContext(AuthContext) || {};
  const navigate = useNavigate();

  const handleLogout = () => {
    if (logout) {
      logout();
      navigate('/login');
    }
  };

  return (
    <header style={{ 
      backgroundColor: '#2c3e50', 
      color: 'white', 
      padding: '1rem 0',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' 
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 1rem'
      }}>
        <div>
          <Link to="/" style={{ color: 'white', textDecoration: 'none', fontSize: '1.5rem', fontWeight: 'bold' }}>
            Location Tracker
          </Link>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center' }}>
          {isAuthenticated ? (
            <>
              <span style={{ marginRight: '1rem', color: '#ecf0f1' }}>
                Welcome, {user?.username || 'User'}
              </span>
              <Link to="/profile" style={{ color: 'white', textDecoration: 'none', marginLeft: '1.5rem' }}>
                Profile
              </Link>
              <Link to="/live-users" style={{ color: 'white', textDecoration: 'none', marginLeft: '1.5rem' }}>
                Live Users
              </Link>
              <button 
                onClick={handleLogout} 
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid white',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  marginLeft: '1.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ color: 'white', textDecoration: 'none', marginLeft: '1.5rem' }}>
                Login
              </Link>
              <Link to="/register" style={{ color: 'white', textDecoration: 'none', marginLeft: '1.5rem' }}>
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
