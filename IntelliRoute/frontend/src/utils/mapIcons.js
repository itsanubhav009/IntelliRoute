import L from 'leaflet';

// Define path to icon images
const iconPath = '/';

// Create default icon
export const defaultIcon = L.icon({
  iconUrl: `${iconPath}marker-icon.png`,
  iconRetinaUrl: `${iconPath}marker-icon-2x.png`,
  shadowUrl: `${iconPath}marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

// Create current user icon (blue)
export const currentUserIcon = L.icon({
  iconUrl: `${iconPath}marker-icon-blue.png`,
  iconRetinaUrl: `${iconPath}marker-icon-blue-2x.png`,
  shadowUrl: `${iconPath}marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

// Create other user icon (red)
export const otherUserIcon = L.icon({
  iconUrl: `${iconPath}marker-icon-red.png`,
  iconRetinaUrl: `${iconPath}marker-icon-red-2x.png`,
  shadowUrl: `${iconPath}marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

// Set default icon for all markers
L.Marker.prototype.options.icon = defaultIcon;