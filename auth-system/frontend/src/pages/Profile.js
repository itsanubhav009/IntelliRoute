import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { LocationContext } from '../context/LocationContext';
import LocationSelector from '../components/LocationSelector';
import api from '../utils/api';
import './Profile.css';

const Profile = () => {
  const { user, loading } = useContext(AuthContext);
  const { position } = useContext(LocationContext);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/auth/profile');
        setProfileData(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to load profile data');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user]);

  if (loading || isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        <h1>User Profile</h1>
        
        {profileData && (
          <div className="profile-info">
            <div className="profile-avatar">
              {profileData.username.charAt(0).toUpperCase()}
            </div>
            
            <div className="profile-details">
              <div className="detail-item">
                <span className="detail-label">Username:</span>
                <span className="detail-value">{profileData.username}</span>
              </div>
              
              <div className="detail-item">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{profileData.email}</span>
              </div>
              
              <div className="detail-item">
                <span className="detail-label">Status:</span>
                <span className="detail-value status-value">
                  <span className="status-indicator online"></span>
                  Online
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Location:</span>
                <div className="detail-value location-value">
                  {position ? (
                    <div>
                      <div className="coordinates">
                        Lat: {position.latitude.toFixed(4)}, 
                        Lng: {position.longitude.toFixed(4)}
                      </div>
                      <div className="location-updated">
                        Last updated: {new Date().toLocaleString()}
                      </div>
                      <a 
                        href={`https://www.google.com/maps?q=${position.latitude},${position.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="map-link"
                      >
                        View on Map
                      </a>
                    </div>
                  ) : (
                    <div>
                      <span className="no-location">No location set. Select a location below.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="location-selector-wrapper">
          <LocationSelector />
        </div>
        
        <div className="profile-actions">
          <a href="/live-users" className="btn live-users-btn">
            See All Live Users
          </a>
        </div>
      </div>
    </div>
  );
};

export default Profile;