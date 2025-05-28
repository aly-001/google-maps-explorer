import React, { useEffect, useState, CSSProperties, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { BusinessInfo } from '../types/business'; // Adjust path as necessary
import { getBusinessesForMap, initSupabase } from '../supabaseClient'; // Adjust path as necessary

// Fix for default marker icon issue with bundlers like Vite/Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;

// Define a custom smaller icon (from previous MapModal enhancement)
const smallIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [15, 25],
  iconAnchor: [7, 25],
  popupAnchor: [1, -24],
  shadowSize: [25, 25]
});

// Default Leaflet icons (if smallIcon is not used everywhere or for fallback)
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface FitBoundsToMarkersProps {
  businesses: BusinessInfo[];
}

// Helper component to adjust map view when businesses are loaded
const FitBoundsToMarkers: React.FC<FitBoundsToMarkersProps> = ({ businesses }) => {
  const map = useMap();
  useEffect(() => {
    if (businesses.length > 0) {
      const validCoordinates = businesses
        .filter(biz => biz.coordinates && typeof biz.coordinates.lat === 'number' && typeof biz.coordinates.lng === 'number' && !isNaN(biz.coordinates.lat) && !isNaN(biz.coordinates.lng))
        .map(biz => [biz.coordinates!.lat, biz.coordinates!.lng] as L.LatLngExpression);
      
      if (validCoordinates.length > 0) {
        console.log('[FitBoundsToMarkers] Fitting bounds to:', validCoordinates);
        map.fitBounds(L.latLngBounds(validCoordinates), { padding: [50, 50] });
      } else {
        console.log('[FitBoundsToMarkers] No valid coordinates to fit bounds after NaN check.');
      }
    }
  }, [businesses, map]);
  return null;
};

const MapWindowContentView: React.FC = () => {
  console.log('[MapWindowContentView] Component rendering/re-rendering.');
  const [businesses, setBusinesses] = useState<BusinessInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const effectRan = useRef(false); // Ref to track if effect has run for the current mount

  useEffect(() => {
    console.log('[MapWindowContentView] useEffect for fetching data CHECKING.');
    // Handle React 18 StrictMode double invocation in development
    if (process.env.NODE_ENV === 'development' && effectRan.current) {
      console.log('[MapWindowContentView] useEffect for fetching data - StrictMode: already run, skipping.');
      return;
    }

    console.log('[MapWindowContentView] useEffect for fetching data RUNNING.');
    const fetchBusinesses = async () => {
      setLoading(true);
      setError(null);
      
      // Initialize Supabase for this window context first
      console.log('[MapWindowContentView] Initializing Supabase...');
      const supabaseClient = await initSupabase();
      if (!supabaseClient) {
        console.error('[MapWindowContentView] Failed to initialize Supabase');
        setError('Failed to initialize database connection');
        setLoading(false);
        return;
      }
      
      console.log('[MapWindowContentView] Fetching businesses CALLED...');
      const result = await getBusinessesForMap();
      console.log('[MapWindowContentView] Result from getBusinessesForMap:', result);

      if (result.success && result.data) {
        const businessesWithCoords = result.data.filter(b => 
          b.coordinates && 
          typeof b.coordinates.lat === 'number' && !isNaN(b.coordinates.lat) &&
          typeof b.coordinates.lng === 'number' && !isNaN(b.coordinates.lng)
        );
        console.log('[MapWindowContentView] Filtered businesses with valid & non-NaN coordinates:', businessesWithCoords);
        setBusinesses(businessesWithCoords);
        if (businessesWithCoords.length === 0 && result.data.length > 0) {
          console.warn('[MapWindowContentView] Data was fetched, but no businesses had valid/non-NaN coordinates after filtering.');
          setError('Data loaded, but no locations have plottable coordinates.');
        }
      } else {
        console.error('[MapWindowContentView] Failed to load businesses for map. Result error:', result.error);
        setError('Failed to load businesses for map. Check console for details.');
      }
      setLoading(false);
    };
    fetchBusinesses();

    // Mark effect as run for StrictMode
    if (process.env.NODE_ENV === 'development') {
      effectRan.current = true;
    }

    // Cleanup function for StrictMode (optional, but good practice if you had subscriptions)
    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[MapWindowContentView] useEffect for fetching data - StrictMode: cleanup phase.');
        // If you needed to reset effectRan.current on actual unmount, this would be the place,
        // but for a single fetch, just preventing the second run is often enough.
      }
    };
  }, []); // Fetch once on mount

  const mapContainerStyle: CSSProperties = {
    height: '100vh', // Fill the entire viewport height
    width: '100vw',  // Fill the entire viewport width
    overflow: 'hidden',
  };

  const statusMessageStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2em',
    color: '#666',
  };
  
  console.log('[MapWindowContentView] Data before rendering MapContainer:', businesses);

  if (loading) {
    return <div style={statusMessageStyle}>Loading map data...</div>;
  }

  if (error) {
    return <div style={{ ...statusMessageStyle, color: 'red' }}>Error: {error}</div>;
  }

  if (businesses.length === 0) {
    return <div style={statusMessageStyle}>No businesses with coordinates found to display on the map.</div>;
  }

  return (
    <div style={mapContainerStyle}>
      <MapContainer 
        center={[businesses[0]?.coordinates?.lat || 51.505, businesses[0]?.coordinates?.lng || -0.09]} 
        zoom={businesses.length > 0 && businesses[0]?.coordinates ? 10 : 2} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {businesses.map((biz, index) => (
          biz.coordinates ? (
            <Marker 
              key={`${biz.name}-${index}-${biz.coordinates.lat}-${biz.coordinates.lng}`} // Added index to key for debugging
              position={[biz.coordinates.lat, biz.coordinates.lng]}
              icon={smallIcon} // Use the custom smaller icon
            >
              <Popup>
                <strong>{biz.name}</strong><br />
                {biz.address || 'Address not available'}
              </Popup>
            </Marker>
          ) : null
        ))}
        <FitBoundsToMarkers businesses={businesses} />
      </MapContainer>
    </div>
  );
};

export default MapWindowContentView; 