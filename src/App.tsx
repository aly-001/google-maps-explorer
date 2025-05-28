import React, { useState, useEffect, useCallback } from 'react';
import { useWebviewInteraction } from './hooks/useWebviewInteraction';
import { BusinessInfo } from './types/business';
import './App.css'; // Import the CSS file
import { initSupabase, saveBusinessToSupabase, getBusinessesFromDateRange } from './supabaseClient'; // Removed getUniqueDatesFromArchive
import { OPEN_MAP_WINDOW } from './ipcChannels'; // Import the IPC channel name
import MapWindowContentView from './components/MapWindowContentView'; // Import the new map view component

// Debounce function (can be removed if no longer needed after autosave removal)
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => { if (timeout !== null) { clearTimeout(timeout); timeout = null; } timeout = setTimeout(() => func(...args), waitFor); };
  return debounced as (...args: Parameters<F>) => void;
}

// Electron's WebviewTag type definition can be tricky in React. 
// For the ref, we might need to use a more generic HTML element type or 'any' 
// if direct 'WebviewTag' causes issues in this context.
// However, the hook uses 'WebviewTag', so we align with that for now.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { src: string; partition: string; webpreferences: string; useragent?: string; className?: string /* Allow className for webview */, preload?: string }, HTMLElement>;
    }
  }
}

const App: React.FC = () => {
  const queryParams = new URLSearchParams(window.location.search);
  const viewMode = queryParams.get('view');

  // If viewMode is 'map', render only the map content (placeholder for now)
  if (viewMode === 'map') {
    // This will be replaced with <MapWindowContentView /> in the next step
    return <MapWindowContentView />;
  }

  // --- Main App Logic (when not in 'map' view mode) ---
  const { 
    webviewRef, 
    currentBusiness, 
    isLoading, 
    isBusinessPage, 
    updateCurrentBusiness // Get the function from the hook
  } = useWebviewInteraction();
  // savedBusinesses now represents an in-memory list for the current session
  const [savedBusinesses, setSavedBusinesses] = useState<BusinessInfo[]>([]);
  const [showDashboard, setShowDashboard] = useState(false);
  
  // State for timestamp range export (values will be directly from input fields)
  const [exportStartTimestamp, setExportStartTimestamp] = useState<string>('');
  const [exportEndTimestamp, setExportEndTimestamp] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState<boolean>(false); // New state for modal visibility

  useEffect(() => {
    // Initialize Supabase client when the app loads
    const initializeSupabase = async () => {
      const supabaseClient = await initSupabase();
      console.log('[App.tsx] Supabase client initialized:', supabaseClient ? 'Client OK' : 'Client FAILED', supabaseClient);
      if (!supabaseClient) {
        alert("Failed to initialize Supabase. Check console for errors. App may not function correctly.")
      }
    };
    
    initializeSupabase();
  }, []);

  useEffect(() => {
    if (currentBusiness) {
      // Check if business already exists in the current in-memory session list
      const businessExistsInState = savedBusinesses.find(b => 
        b.name === currentBusiness.name && 
        (b.address === currentBusiness.address || (!b.address && !currentBusiness.address))
      );
      if (!businessExistsInState) {
        console.log('[App.tsx] New business identified by hook:', currentBusiness);
        // Add to in-memory list for immediate UI feedback
        setSavedBusinesses(prev => [...prev, currentBusiness]);
        
        // Save to Supabase (this part remains)
        (async () => {
          console.log("[App.tsx] Attempting to save NEW business to Supabase (archive):", currentBusiness);
          const result = await saveBusinessToSupabase(currentBusiness);
          if (result.success) {
            console.log('[App.tsx] Successfully saved NEW business to Supabase (archive)');
          } else {
            console.error('[App.tsx] Failed to save NEW business to Supabase (archive):', result.error);
          }
        })();
      } else {
        console.log('[App.tsx] Business already processed or in local state:', currentBusiness.name);
      }
    }
  }, [currentBusiness, savedBusinesses]); // Added savedBusinesses to deps for the check

  const handleSaveButtonClick = () => {
    // This function is called when the user clicks the 'Save Business' button.
    // It tells the webview interaction hook to try and extract business info.
    // The useEffect hook for 'currentBusiness' will then handle saving to state and Supabase.
    if (updateCurrentBusiness) {
      updateCurrentBusiness();
    }
  };

  const handleExportArchiveByTimestampRange = async () => {
    if (!exportStartTimestamp || !exportEndTimestamp) {
      alert("Please select a start and end date/time for the archive export.");
      return;
    }
    const startDate = new Date(exportStartTimestamp);
    const endDate = new Date(exportEndTimestamp);
    if (startDate > endDate) {
      alert("Start date/time cannot be after end date/time.");
      return;
    }
    console.log(`[App.tsx] Attempting to fetch archive businesses from ${exportStartTimestamp} to ${exportEndTimestamp}`);
    const result = await getBusinessesFromDateRange(exportStartTimestamp, exportEndTimestamp);
    if (result.success && result.data) {
      if (result.data.length === 0) {
        alert(`No businesses found in the archive between ${exportStartTimestamp} and ${exportEndTimestamp}.`);
        return;
      }
      console.log(`[App.tsx] Fetched ${result.data.length} businesses from archive. Exporting...`);
      // Ensure exportArchiveByDate is correctly exposed and typed in preload.ts
      const exportResult = await window.electron.localStorage.exportArchiveByDate(result.data);
      if (exportResult.success && exportResult.filePath) {
        alert(`Archive successfully exported to: ${exportResult.filePath}`);
      } else if (!exportResult.success && exportResult.error === 'Export canceled by user.'){
        console.log('[App.tsx] Archive JSON export canceled by user.');
      } else {
        alert(`Failed to export archive session: ${exportResult.error}`);
        console.error('[App.tsx] Failed to export archive session to JSON:', exportResult.error);
      }
    } else {
      alert(`Failed to fetch businesses from archive: ${result.error}`);
      console.error('[App.tsx] Failed to fetch businesses from archive for date range query:', result.error);
    }
  };

  const toggleDashboard = () => {
    setShowDashboard(prev => !prev);
  };

  const handleViewArchive = () => {
    window.electron.ipcRenderer.send(OPEN_MAP_WINDOW, null); // Corrected: added null as second argument
  };

  const openExportModal = () => {
    setShowExportModal(true);
  };

  const closeExportModal = () => {
    setShowExportModal(false);
  };

  const dashboardControlsStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap', // Allow buttons to wrap
    gap: '10px',      // Space between buttons
    padding: '10px', // Keep existing padding for the container
    // borderTop: '1px solid #ccc', // from App.css original .dashboard-controls
    // backgroundColor: '#f8f9fa', // from App.css original .dashboard-controls
    // flexShrink: 0, // from App.css original .dashboard-controls
    // boxShadow: '0 -1px 4px rgba(0,0,0,0.08)', // from App.css original .dashboard-controls
  };

  const dashboardButtonStyle: React.CSSProperties = {
    // padding: '10px 15px', // from App.css .dashboard-toggle-button
    // fontSize: '15px', // from App.css .dashboard-toggle-button
    // fontWeight: '500', // from App.css .dashboard-toggle-button
    // cursor: 'pointer', // from App.css .dashboard-toggle-button
    // backgroundColor: '#007bff', // from App.css .dashboard-toggle-button
    // color: 'white', // from App.css .dashboard-toggle-button
    // border: 'none', // from App.css .dashboard-toggle-button
    // borderRadius: '4px', // from App.css .dashboard-toggle-button
    // transition: 'background-color 0.2s ease', // from App.css .dashboard-toggle-button
    flexGrow: 1, // Allow buttons to grow and fill space if only a few
    minWidth: '160px', // Adjusted minWidth for potentially more buttons
  };

  const dateTimeGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '10px',
    border: '1px solid #eee',
    borderRadius: '4px',
    backgroundColor: '#fdfdfd',
    marginTop: '10px',
  };

  const dateTimeLabelStyle: React.CSSProperties = {
    fontSize: '0.9em',
    fontWeight: 500,
    marginBottom: '2px',
  };

  const dateTimeInputStyle: React.CSSProperties = {
    padding: '8px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    width: '100%', // Ensure it takes full width within the modal
    boxSizing: 'border-box', // Include padding and border in the element's total width and height
  };

  // Styles for the modal
  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, // Ensure modal is on top
  };

  const modalContentStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '25px', // Increased padding
    borderRadius: '8px', // More rounded corners
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)', // Softer, more pronounced shadow
    width: '450px', // Wider modal
    maxWidth: '90%', // Ensure it's responsive
    display: 'flex',
    flexDirection: 'column',
    gap: '15px', // Spacing between elements in the modal
  };

  const modalTitleStyle: React.CSSProperties = {
    margin: 0,
    marginBottom: '10px', // Space below title
    fontSize: '1.5em', // Larger title
    color: '#333',
    textAlign: 'center',
  };
  
  const modalActionsStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end', // Align buttons to the right
    gap: '10px', // Space between buttons
    marginTop: '15px', // Space above action buttons
  };
  
  const modalButtonStyle: React.CSSProperties = {
    padding: '10px 20px',
    fontSize: '1em',
    borderRadius: '5px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  };
  
  const confirmButtonStyle: React.CSSProperties = {
    ...modalButtonStyle,
    backgroundColor: '#28a745', // Green
    color: 'white',
  };

  const cancelButtonStyle: React.CSSProperties = {
    ...modalButtonStyle,
    backgroundColor: '#6c757d', // Grey
    color: 'white',
  };

  return (
    <div className="app-container">
      <div className="webview-section">
        <webview
          ref={webviewRef as any}
          src="https://www.google.com/maps/@52.332958382004556,-113.75084495316375,7z"
          className="webview-element"
          partition="persist:googlemaps"
          webpreferences="allowRunningInsecureContent=no, javascript=yes, plugins=no"
          useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
          preload={undefined} // Ensuring preload attribute matches expected type if necessary
        ></webview>
        {isLoading && (
          <div className="loading-indicator">Loading Map...</div>
        )}
        {isBusinessPage && (
          <button onClick={handleSaveButtonClick} className="save-button">
            Add Business to Session (Archives to Supabase)
          </button>
        )}
      </div>

      <div className="dashboard-controls" style={dashboardControlsStyle}>
        <button onClick={toggleDashboard} className="dashboard-toggle-button" style={dashboardButtonStyle}>
          {showDashboard ? 'Hide Session' : 'Show Session'} ({savedBusinesses.length})
        </button>
        <button onClick={handleViewArchive} className="dashboard-toggle-button" style={{...dashboardButtonStyle, backgroundColor: '#17a2b8'}}>
          View Supabase Archive
        </button>
        <button 
            onClick={openExportModal} 
            className="dashboard-toggle-button" 
            style={{...dashboardButtonStyle, backgroundColor: '#fd7e14'}}
          >
            Export Archive
        </button>
      </div>

      {showDashboard && (
        <div className="dashboard-panel">
          <h2>Current In-Memory Session</h2>
          {savedBusinesses.length === 0 ? (
            <p>No businesses added in the current session yet. Add some from the map.</p>
          ) : (
            <ul>
              {savedBusinesses.map((business, index) => (
                <li key={`${business.name}-${index}-${business.address || 'no-address'}`}>
                  <strong>{business.name}</strong><br />
                  Address: {business.address || 'N/A'}<br />
                  Phone: {business.phone || 'N/A'}<br />
                  Website: {business.website ? <a href={business.website.startsWith('http') ? business.website : `http://${business.website}`} target="_blank" rel="noopener noreferrer">{business.website}</a> : 'N/A'}<br />
                  {business.coordinates && `Coordinates: Lat: ${business.coordinates.lat.toFixed(4)}, Lng: ${business.coordinates.lng.toFixed(4)}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div style={modalOverlayStyle} onClick={closeExportModal}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}> {/* Prevent closing modal when clicking inside */}
            <h3 style={modalTitleStyle}>Export Archive by Date/Time</h3>
            <div style={dateTimeGroupStyle}> {/* Re-using dateTimeGroupStyle for inputs container */}
              <label htmlFor="start-datetime-input-modal" style={dateTimeLabelStyle}>Start Date/Time:</label>
              <input 
                type="datetime-local"
                id="start-datetime-input-modal" // Unique ID for modal input
                value={exportStartTimestamp} 
                onChange={(e) => setExportStartTimestamp(e.target.value)} 
                style={dateTimeInputStyle}
              />
              <label htmlFor="end-datetime-input-modal" style={dateTimeLabelStyle}>End Date/Time:</label>
              <input 
                type="datetime-local"
                id="end-datetime-input-modal" // Unique ID for modal input
                value={exportEndTimestamp} 
                onChange={(e) => setExportEndTimestamp(e.target.value)} 
                style={dateTimeInputStyle}
              />
            </div>
            <div style={modalActionsStyle}>
              <button 
                onClick={handleExportArchiveByTimestampRange} 
                style={confirmButtonStyle}
                disabled={!exportStartTimestamp || !exportEndTimestamp}
              >
                Confirm Export
              </button>
              <button onClick={closeExportModal} style={cancelButtonStyle}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App; 