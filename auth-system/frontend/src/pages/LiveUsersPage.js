import React from 'react';
import LiveUsers from '../components/LiveUsers';
import UserLocationMap from '../components/UserLocationMap';
import './LiveUsersPage.css';

const LiveUsersPage = () => {
  return (
    <div className="live-users-page">
      <div className="page-header">
        <h1>Live Users Map</h1>
        <p className="page-description">
          See who's online right now and where they're located
        </p>
      </div>
      
      {/* Add the map component at the top */}
      <UserLocationMap />
      
      {/* User list below the map */}
      <LiveUsers />
    </div>
  );
};

export default LiveUsersPage;