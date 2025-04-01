// Central file for predefined locations
export const PREDEFINED_LOCATIONS = [
  { id: 1, name: "New Delhi", latitude: 28.6139, longitude: 77.2090, description: "Capital of India" },
  { id: 2, name: "Mumbai", latitude: 19.0760, longitude: 72.8777, description: "Financial Hub of India" },
  { id: 3, name: "Kolkata", latitude: 22.5726, longitude: 88.3639, description: "City of Joy" },
  { id: 4, name: "Chennai", latitude: 13.0827, longitude: 80.2707, description: "Gateway of South India" },
  { id: 5, name: "Bengaluru", latitude: 12.9716, longitude: 77.5946, description: "Silicon Valley of India" },
  { id: 6, name: "Hyderabad", latitude: 17.3850, longitude: 78.4867, description: "City of Pearls" },
  { id: 7, name: "Pune", latitude: 18.5204, longitude: 73.8567, description: "Cultural Capital of Maharashtra" },
  { id: 8, name: "Ahmedabad", latitude: 23.0225, longitude: 72.5714, description: "Economic Hub of Gujarat" },
  { id: 9, name: "Jaipur", latitude: 26.9124, longitude: 75.7873, description: "Pink City of India" },
  { id: 10, name: "Lucknow", latitude: 26.8467, longitude: 80.9462, description: "Cultural Capital of Uttar Pradesh" },
  { id: 11, name: "Imphal", latitude: 24.8170, longitude: 93.9368, description: "Capital of Manipur" },
  { id: 12, name: "Coimbatore", latitude: 11.0168, longitude: 76.9558, description: "Manchester of South India" }
];

export const getLocationNameByCoordinates = (latitude, longitude) => {
  if (!latitude || !longitude) return null;
  
  const location = PREDEFINED_LOCATIONS.find(loc => 
    Math.abs(loc.latitude - latitude) < 0.01 && 
    Math.abs(loc.longitude - longitude) < 0.01
  );
  
  return location ? location.name : "Custom Location";
};
