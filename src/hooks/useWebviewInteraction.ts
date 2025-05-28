import { useState, useEffect, useRef } from 'react';
import { WebviewTag } from 'electron';
import { BusinessInfo } from '../types/business';

export const useWebviewInteraction = () => {
  // Use WebviewTag type from Electron
  const webviewRef = useRef<WebviewTag>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusinessPage, setIsBusinessPage] = useState(false);
  const [currentBusiness, setCurrentBusiness] = useState<BusinessInfo | null>(null);
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleLoad = () => {
      setIsLoading(false);
      
      // Apply essential event handlers for interactive clicks and zooming
      applyWebviewInteractionFixes();
      
      // Initial check after page loads
      checkIfBusinessPage();
    };
    
    const handleNavigation = () => {
      setIsLoading(true);
      checkIfBusinessPage();
    };
    
    const handleNavigationComplete = () => {
      setIsLoading(false);
      checkIfBusinessPage();
    };

    // Set up event listeners
    webview.addEventListener('did-start-loading', () => setIsLoading(true));
    webview.addEventListener('did-finish-load', handleLoad);
    webview.addEventListener('did-navigate', handleNavigationComplete);
    webview.addEventListener('did-navigate-in-page', handleNavigationComplete);
    webview.addEventListener('dom-ready', applyWebviewInteractionFixes);
    
    // Set up interval to check for business page (since Google Maps uses client-side navigation)
    const intervalId = setInterval(checkIfBusinessPage, 1000);
    
    return () => {
      webview.removeEventListener('did-start-loading', () => setIsLoading(true));
      webview.removeEventListener('did-finish-load', handleLoad);
      webview.removeEventListener('did-navigate', handleNavigationComplete);
      webview.removeEventListener('did-navigate-in-page', handleNavigationComplete);
      webview.removeEventListener('dom-ready', applyWebviewInteractionFixes);
      clearInterval(intervalId);
    };
  }, []);

  const applyWebviewInteractionFixes = () => {
    const webview = webviewRef.current;
    if (!webview) return;

    // Run this script to improve interaction with Google Maps
    webview.executeJavaScript(`
      (function() {
        // Fix pointer events - ensure they are all captured correctly
        document.body.style.cursor = 'auto';
        
        // Make sure maps interactions work correctly
        const mapElements = document.querySelectorAll('.widget-scene, .widget-scene-canvas, [role="application"]');
        mapElements.forEach(el => {
          if (el) {
            el.style.pointerEvents = 'auto';
            el.style.touchAction = 'manipulation';
          }
        });
        
        // Fix zoom control events
        const zoomControls = document.querySelectorAll('.widget-zoom, .gm-control-active, .gmnoprint');
        zoomControls.forEach(control => {
          if (control) {
            control.style.pointerEvents = 'auto';
            control.style.cursor = 'pointer';
          }
        });
        
        // Make search box and buttons easily clickable
        const searchBar = document.getElementById('searchboxinput');
        if (searchBar) {
          searchBar.style.pointerEvents = 'auto';
          searchBar.style.cursor = 'text';
        }
        
        // Fix for business cards and panels
        const infoCards = document.querySelectorAll('.section-layout, .section-hero-header, .section-result-content');
        infoCards.forEach(card => {
          if (card) {
            card.style.pointerEvents = 'auto';
            card.style.cursor = 'auto';
          }
        });
        
        // Prevent event propagation issues
        return true;
      })();
    `).catch((error: Error) => {
      console.error('Error applying interaction fixes:', error);
    });
  };

  const checkIfBusinessPage = () => {
    const webview = webviewRef.current;
    if (!webview) return;

    const script = `
      (function() {
        // Check for business title (doesn't end with "- Google Maps" only)
        const title = document.title;
        const isBusinessTitle = title.includes(' - Google Maps') && title !== 'Google Maps';
        
        // Check for business-specific elements as a more reliable indicator
        const hasAddressElement = !!document.querySelector("[data-item-id='address']");
        const hasBusinessDescription = !!document.querySelector(".PYvSYb");
        
        return {
          isBusinessPage: isBusinessTitle && (hasAddressElement || hasBusinessDescription)
        };
      })();
    `;

    webview.executeJavaScript(script, false)
      .then((result: any) => {
        if (result && typeof result === 'object') {
          setIsBusinessPage(!!result.isBusinessPage);
          if (!result.isBusinessPage) {
            setCurrentBusiness(null);
          }
        }
      })
      .catch(() => {
        setIsBusinessPage(false);
        setCurrentBusiness(null);
      });
  };

  const updateCurrentBusiness = () => {
    if (!webviewRef.current) return;

    // Introduce a delay to allow the Google Maps page to potentially settle its URL
    setTimeout(() => {
      if (!webviewRef.current) return; // Check ref again in case component unmounted

      const script = `
      (function() {
        try {
          // Extract business name (from title)
          const title = document.title;
          const businessName = title.replace(' - Google Maps', '');
          
          // Extract phone number
          let phone = '';
          const phoneElement = document.querySelector("[data-item-id^='phone:tel:']");
          if (phoneElement) {
            const phoneText = phoneElement.querySelector('.Io6YTe');
            if (phoneText) {
              phone = phoneText.textContent || '';
            }
          }
          
          // Extract address (looking for the address element)
          let address = '';
          const addressElement = document.querySelector("[data-item-id='address']");
          if (addressElement) {
            const addressText = addressElement.querySelector('.Io6YTe');
            if (addressText) {
              address = addressText.textContent || '';
            }
          }
          
          // Extract website URL
          let website = '';
          const websiteElement = document.querySelector("[data-item-id='authority']");
          if (websiteElement && websiteElement.href) {
            website = websiteElement.href;
          } else {
            const websiteLink = document.querySelector("a[jslog*='3443']") || 
                                document.querySelector("a[data-tooltip='Open website']");
            if (websiteLink && websiteLink.href) {
              website = websiteLink.href;
            }
          }
          
          // Extract coordinates from URL
          let coordinates = null;
          const url = window.location.href;
          const coordsMatch = url.match(/@(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)/);
          if (coordsMatch) {
            coordinates = {
              lat: parseFloat(coordsMatch[1]),
              lng: parseFloat(coordsMatch[2])
            };
          }
          
          return {
            name: businessName,
            phone: phone,
            address: address,
            website: website,
            coordinates: coordinates
          };
        } catch (error) {
          return { error: error.message };
        }
      })();
    `;

      webviewRef.current.executeJavaScript(script, false)
        .then((result: unknown) => {
          // Type guard to check the structure of the result
          const isBusinessInfo = (obj: any): obj is BusinessInfo => {
            return obj && typeof obj === 'object' && 'name' in obj && 'address' in obj;
          };
          
          const hasError = (obj: any): obj is { error: string } => {
            return obj && typeof obj === 'object' && 'error' in obj;
          };

          if (hasError(result)) {
            console.error('Error extracting business info:', result.error);
            setCurrentBusiness(null);
          } else if (isBusinessInfo(result)) {
            setCurrentBusiness(result);
          }
        })
        .catch((error: unknown) => {
          console.error('Error executing script:', error);
          setCurrentBusiness(null);
        });
    }, 750); // 750ms delay
  };

  const captureWebviewScreenshot = async (): Promise<string> => {
    if (!webviewRef.current) return '';
    
    try {
      // Capture screenshot using Electron's capturePage
      const nativeImage = await webviewRef.current.capturePage();
      return nativeImage.toDataURL();
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      return '';
    }
  };

  return {
    webviewRef,
    isLoading,
    isBusinessPage,
    currentBusiness,
    mapLocation, // This state is declared but not updated in the provided hook. Ensure this is intended.
    captureWebviewScreenshot,
    applyWebviewInteractionFixes,
    updateCurrentBusiness,
  };
}; 