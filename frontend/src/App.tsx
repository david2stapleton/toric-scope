import './App.css'
import LatticeCanvas from './components/LatticeCanvas'
import LatexRenderer from './components/LatexRenderer'
import LatexExportModal from './components/LatexExportModal'
import Toggle from './components/Toggle'
import { useState, useEffect, useRef } from 'react'
import type { BlinkState } from './types/blinkable'
import type { PolytopeAttributes } from './types/attributes'
import { convexHull } from './utils/convexHull'
import { generateTikZCode, downloadTexFile, type PolytopeExportData, type LatexExportOptions } from './utils/latexExport'
import type { Point } from './utils/convexHull'

export interface ColorPalette {
  name: string;
  background: string;
  latticePoints: string;
  selectedPoints: string;
  hullFill: string;
  hullStroke: string;
  border: string;
  text: string;
}

const palettes: ColorPalette[] = [
  {
    name: 'palette-0',
    background: '#fff4e6',
    latticePoints: '#d4a574',
    selectedPoints: '#ff6b35',
    hullFill: 'rgba(255, 107, 53, 0.15)',
    hullStroke: '#ff8c42',
    border: '#cc8844',
    text: '#2d2d2d'
  },
  {
    name: 'palette-1',
    background: '#e8f5f0',
    latticePoints: '#a8c4b8',
    selectedPoints: '#b6e8c1',
    hullFill: 'rgba(157, 219, 179, 0.3)',
    hullStroke: '#9ddbad',
    border: '#b4d4c4',
    text: '#4f6b5d'
  },
  {
    name: 'palette-2',
    background: '#f0e8f5',
    latticePoints: '#c4b8d0',
    selectedPoints: '#e8b6ff',
    hullFill: 'rgba(219, 179, 230, 0.3)',
    hullStroke: '#dbb3e6',
    border: '#d4c4dc',
    text: '#5d4f6b'
  },
  {
    name: 'palette-3',
    background: '#fff5f0',
    latticePoints: '#d4c4b8',
    selectedPoints: '#ffcba4',
    hullFill: 'rgba(255, 179, 186, 0.3)',
    hullStroke: '#ffb3ba',
    border: '#f0d4c4',
    text: '#6b5d5d'
  },
  {
    name: 'palette-4',
    background: '#f0f8ff',
    latticePoints: '#b8c4d4',
    selectedPoints: '#a4c8ff',
    hullFill: 'rgba(179, 200, 255, 0.3)',
    hullStroke: '#93b8ff',
    border: '#c4d4e8',
    text: '#4f5d6b'
  },
  {
    name: 'palette-5',
    background: '#fff8f0',
    latticePoints: '#d4c0a8',
    selectedPoints: '#ffd4a4',
    hullFill: 'rgba(255, 200, 150, 0.3)',
    hullStroke: '#ffb886',
    border: '#e8d4c0',
    text: '#6b5d4f'
  },
  {
    name: 'palette-6',
    background: '#f8f0f8',
    latticePoints: '#d0b8c8',
    selectedPoints: '#ffb8d8',
    hullFill: 'rgba(255, 180, 210, 0.3)',
    hullStroke: '#ffa0c8',
    border: '#e0c8d8',
    text: '#6b4f5d'
  },
  {
    name: 'palette-7',
    background: '#f0fff5',
    latticePoints: '#b8d4c0',
    selectedPoints: '#a8ffb8',
    hullFill: 'rgba(160, 255, 180, 0.3)',
    hullStroke: '#88ff98',
    border: '#c8e8d0',
    text: '#4f6b55'
  }
];

export type LatticeType = 'square' | 'hexagonal';
export type Mode = 'polytopes' | 'multiplicities' | 'rings' | 'fans';

type ModeTextContent = Record<Mode, string>;

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// UI Constants
const BORDER_THICKNESS = 2;
const BORDER_RADIUS = 6;
const BORDER_RADIUS_INNER = 4;
const BORDER_OPACITY = 0.7;
const BUTTON_HEIGHT = 32;
const BUTTON_SPACING = 8;
const ICON_SIZE = 20;

// Helper function to convert hex color to rgba with transparency
const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function App() {
  const [selectedPalette] = useState<ColorPalette>(palettes[0]);
  const [latticeType, setLatticeType] = useState<LatticeType>('square');
  const [mode, setMode] = useState<Mode>('polytopes');
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 600, height: 600 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [savedPolytopes, setSavedPolytopes] = useState<Array<{name: string, point_count: number}>>([]);
  const [isLoadDropdownOpen, setIsLoadDropdownOpen] = useState(false);
  const [blinkState, setBlinkState] = useState<BlinkState | null>(null);

  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'canvas' | 'text'>('canvas'); // Which panel to show on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Hamburger menu state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalData, setExportModalData] = useState<{ hull: Point[], points: Point[] } | null>(null);

  // Initialize with empty strings, will load from backend
  const [modeTexts, setModeTexts] = useState<ModeTextContent>({
    'polytopes': '',
    'multiplicities': '',
    'rings': '',
    'fans': ''
  });

  // Polytope statistics for template interpolation
  const [polytopeStats, setPolytopeStats] = useState<PolytopeAttributes | undefined>(undefined);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Listen for polytope stats updates from LatticeCanvas
  useEffect(() => {
    const handler = (event: any) => {
      setPolytopeStats(event.detail);
    };
    window.addEventListener('polytopeStatsUpdate', handler);
    return () => window.removeEventListener('polytopeStatsUpdate', handler);
  }, []);

  // Swipe gesture handling for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && mobileView === 'canvas') {
      setMobileView('text');
    }
    if (isRightSwipe && mobileView === 'text') {
      setMobileView('canvas');
    }
  };

  // Measure canvas container and update dimensions
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      // Use clientWidth/clientHeight to get internal dimensions (excluding border)
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;

      if (newWidth > 0 && newHeight > 0) {
        setCanvasDimensions({
          width: newWidth,
          height: newHeight
        });
      }
    };

    // Initial measurement after a short delay to let layout settle
    const timeoutId = setTimeout(updateDimensions, 100);

    // Update on window resize
    const handleResize = () => {
      updateDimensions();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileView]);

  // Fetch all texts from backend on mount
  useEffect(() => {
    const fetchTexts = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/texts`);
        if (response.ok) {
          const data = await response.json();
          setModeTexts(data);
        }
      } catch (error) {
        console.error('Failed to fetch texts:', error);
      }
    };
    fetchTexts();
  }, []);

  // Debounced save to backend
  const saveTimeoutRef = useRef<number | null>(null);

  const updateCurrentModeText = (newText: string) => {
    // Update state immediately for responsive UI
    setModeTexts(prev => ({
      ...prev,
      [mode]: newText
    }));

    // Debounce the API call
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/api/text/${mode}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: newText })
        });
      } catch (error) {
        console.error('Failed to save text:', error);
      }
    }, 500); // Save 500ms after user stops typing
  };

  // Fetch saved polytopes list
  const fetchSavedPolytopes = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/polytopes`);
      if (response.ok) {
        const data = await response.json();
        setSavedPolytopes(data.polytopes);
      }
    } catch (error) {
      console.error('Failed to fetch saved polytopes:', error);
    }
  };

  // Load polytopes list on mount
  useEffect(() => {
    fetchSavedPolytopes();
  }, []);

  // Listen for polytope link clicks from notes
  useEffect(() => {
    const handler = (event: any) => {
      const { name, mode: targetMode } = event.detail;
      console.log('Link clicked:', { name, targetMode });
      // Set mode first if specified
      if (targetMode) {
        console.log('Setting mode to:', targetMode);
        setMode(targetMode as Mode);
      }
      // Then load the polytope
      handleLoadPolytope(name);
    };
    window.addEventListener('loadPolytopeFromLink', handler);
    return () => window.removeEventListener('loadPolytopeFromLink', handler);
  }, []);

  // Store animation parameters
  const blinkRateRef = useRef(500);
  const currentActionRef = useRef<string | null>(null);
  const currentFeatureTypeRef = useRef<string | null>(null);

  // Listen for polytope fact clicks from notes
  useEffect(() => {
    const handler = (event: any) => {
      const { attribute, attributeIndex, action, params } = event.detail;
      console.log('App received polytope fact click:', { attribute, attributeIndex, action, params });

      // Extract blink rate from params (default 500ms)
      const blinkRate = params && params.length > 0 ? params[0] : 500;

      // Store the blink rate for when features arrive
      blinkRateRef.current = blinkRate;

      // Handle scoped actions
      if (attribute) {
        // Extract base attribute name (handle 'vertices.count' -> 'vertices')
        const baseAttribute = attribute.split('.')[0];

        // If index is specified (e.g., vertices[0]), apply action directly
        if (attributeIndex !== null && attributeIndex !== undefined) {
          const actionEvent = new CustomEvent('applyFeatureAction', {
            detail: {
              action,
              featureType: baseAttribute,
              index: attributeIndex
            }
          });
          window.dispatchEvent(actionEvent);
        }
        // If no index (e.g., vertices), iterate through all features
        else {
          // Store action and feature type for animation loop
          currentActionRef.current = action;
          currentFeatureTypeRef.current = baseAttribute;

          // Get all features to iterate through
          const requestEvent = new CustomEvent('getBlinkableFeatures', {
            detail: {
              featureType: baseAttribute,
              index: null  // Get all features
            }
          });
          window.dispatchEvent(requestEvent);
        }
      } else {
        // Handle global actions (no attribute specified)
        console.log('Global action not yet implemented:', action);
      }
    };
    window.addEventListener('polytopeFactClicked', handler);
    return () => window.removeEventListener('polytopeFactClicked', handler);
  }, [mode]);

  // Listen for blinkable features from LatticeCanvas
  useEffect(() => {
    const handler = (event: any) => {
      const { features } = event.detail;
      console.log('Received blinkable features:', features);
      if (features && features.length > 0) {
        // Start from last index and go backward (safer for polytope toggling)
        const startIndex = features.length - 1;

        setBlinkState({
          features,
          currentIndex: startIndex,
          blinkRate: blinkRateRef.current,
          isPersistent: true  // Animation always shows visual feedback
        });
      }
    };
    window.addEventListener('blinkableFeaturesReady', handler);
    return () => window.removeEventListener('blinkableFeaturesReady', handler);
  }, []);

  // Generic animation loop - iterates through features and applies actions
  useEffect(() => {
    if (!blinkState) return; // No animation running

    const { features, currentIndex, blinkRate } = blinkState;
    const currentFeature = features[currentIndex];
    console.log('Animation: applying action to', currentFeature?.type, 'index:', currentIndex);

    // Apply the action to the current feature
    if (currentActionRef.current && currentFeatureTypeRef.current && currentFeature) {
      // Extract the index from the feature ID (e.g., "vertex-0" -> 0)
      const featureIndexMatch = currentFeature.id.match(/-(\d+)$/);
      const featureIndex = featureIndexMatch ? parseInt(featureIndexMatch[1], 10) : null;

      if (featureIndex !== null) {
        console.log('Dispatching action:', currentActionRef.current, 'on', currentFeatureTypeRef.current, 'index:', featureIndex);
        const actionEvent = new CustomEvent('applyFeatureAction', {
          detail: {
            action: currentActionRef.current,
            featureType: currentFeatureTypeRef.current,
            index: featureIndex
          }
        });
        window.dispatchEvent(actionEvent);
      }
    }

    // Set up timer to move to next feature
    const timer = setTimeout(() => {
      setBlinkState((prev) => {
        if (!prev) return null;

        // Always go in reverse (safer for modifications like toggling)
        const nextIndex = prev.currentIndex - 1;

        // Stop when we've gone through all features (reached index -1)
        if (nextIndex < 0) {
          console.log('Animation complete');
          return null;
        }

        console.log('Moving to index', nextIndex);
        return { ...prev, currentIndex: nextIndex };
      });
    }, blinkRate);

    // Cleanup: clear the timer when component unmounts or blinkState changes
    return () => clearTimeout(timer);
  }, [blinkState]);

  // Save current polytope
  const handleSavePolytope = async () => {
    const name = prompt('Enter a name for this polytope:');
    if (!name) return;

    // Dispatch event to get selected points from canvas
    const event = new CustomEvent('getSelectedPoints');
    window.dispatchEvent(event);

    // Wait a bit for the event to be processed
    setTimeout(async () => {
      const selectedPoints = (window as any).selectedPointsForSave;
      if (!selectedPoints || selectedPoints.length < 3) {
        alert('Please select at least 3 points to form a polytope');
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/polytopes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            lattice_type: latticeType,
            points: selectedPoints
          })
        });

        if (response.ok) {
          alert(`Polytope "${name}" saved successfully!`);
          fetchSavedPolytopes();
        } else {
          alert('Failed to save polytope');
        }
      } catch (error) {
        console.error('Failed to save polytope:', error);
        alert('Failed to save polytope');
      }
    }, 100);
  };

  // Load a polytope
  const handleLoadPolytope = async (name: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/polytopes/${encodeURIComponent(name)}`);
      if (response.ok) {
        const data = await response.json();

        // Set lattice type
        setLatticeType(data.lattice_type);

        // Dispatch event to load points into canvas
        const event = new CustomEvent('loadPolytope', {
          detail: {
            points: data.points,
            latticeType: data.lattice_type
          }
        });
        window.dispatchEvent(event);

        setIsLoadDropdownOpen(false);
      } else {
        alert('Failed to load polytope');
      }
    } catch (error) {
      console.error('Failed to load polytope:', error);
      alert('Failed to load polytope');
    }
  };

  // Export polytope as LaTeX/TikZ - open modal
  const handleExportLatex = () => {
    // Listen for response
    const handler = (event: any) => {
      const { points } = event.detail;

      if (!points || points.length < 3) {
        alert('Need at least 3 points to export a polytope');
        return;
      }

      // Compute convex hull
      const hull = convexHull(points);

      // Open modal with data
      setExportModalData({ hull, points });
      setIsExportModalOpen(true);

      // Cleanup listener
      window.removeEventListener('selectedPointsReady', handler);
    };

    // Set up listener BEFORE dispatching event
    window.addEventListener('selectedPointsReady', handler, { once: true });

    // Request selected points from canvas
    const requestEvent = new CustomEvent('getSelectedPoints');
    window.dispatchEvent(requestEvent);
  };

  // Handle actual export from modal
  const handleExportWithOptions = (options: LatexExportOptions) => {
    if (!exportModalData) return;

    const exportData: PolytopeExportData = {
      name: 'polytope',
      hullVertices: exportModalData.hull,
      latticeType: latticeType as 'square' | 'hexagonal',
      allPoints: exportModalData.points
    };

    const tikzCode = generateTikZCode(exportData, options);
    const filename = `polytope_${Date.now()}.tex`;
    downloadTexFile(tikzCode, filename);

    // Close modal
    setIsExportModalOpen(false);
    setExportModalData(null);
  };

  return (
    <>
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: selectedPalette.background
    }}>
      {/* Unified Top Navigation Bar */}
      <div style={{
        height: '50px',
        borderBottom: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 15px',
        backgroundColor: selectedPalette.background,
        gap: `${BUTTON_SPACING}px`
      }}>
        {/* Left side: Hamburger + Lattice Toggle + Center + Clear */}
        <div style={{ display: 'flex', gap: `${BUTTON_SPACING}px`, alignItems: 'center' }}>
          {/* Hamburger button */}
          <button
            onClick={(e) => {
              if (isSidebarOpen) {
                setIsLoadDropdownOpen(false);
              }
              setIsSidebarOpen(!isSidebarOpen);
              e.currentTarget.blur();
            }}
            onTouchEnd={(e) => {
              setTimeout(() => e.currentTarget.blur(), 0);
            }}
            style={{
              height: `${BUTTON_HEIGHT}px`,
              padding: '0 12px',
              backgroundColor: selectedPalette.background,
              border: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
              borderRadius: `${BORDER_RADIUS}px`,
              cursor: 'pointer',
              color: selectedPalette.text,
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Lattice Type Toggle - Horizontal (desktop only) */}
          {!isMobile && (
            <Toggle
              isLeft={latticeType === 'square'}
              onToggle={() => setLatticeType(latticeType === 'square' ? 'hexagonal' : 'square')}
              leftIcon={
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <rect x="4" y="4" width="12" height="12" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              }
              rightIcon={
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <path d="M 10 3 L 15.5 6.5 L 15.5 13.5 L 10 17 L 4.5 13.5 L 4.5 6.5 Z" stroke="currentColor" strokeWidth="1.8" fill="none" />
                </svg>
              }
              title={latticeType === 'square' ? 'Square lattice (click for hexagonal)' : 'Hexagonal lattice (click for square)'}
              palette={selectedPalette}
              borderThickness={BORDER_THICKNESS}
              borderOpacity={BORDER_OPACITY}
              buttonHeight={BUTTON_HEIGHT}
            />
          )}

          {/* Center Button */}
          <button
            disabled={isMobile && mobileView === 'text'}
            onClick={(e) => {
              if (!(isMobile && mobileView === 'text')) {
                const event = new CustomEvent('centerView');
                window.dispatchEvent(event);
                e.currentTarget.blur();
              }
            }}
            onTouchStart={(e) => {
              if (!(isMobile && mobileView === 'text')) {
                e.currentTarget.style.backgroundColor = selectedPalette.border;
              }
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.backgroundColor = selectedPalette.background;
              e.currentTarget.blur();
            }}
            style={{
              height: `${BUTTON_HEIGHT}px`,
              padding: '0 10px',
              backgroundColor: selectedPalette.background,
              border: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
              borderRadius: `${BORDER_RADIUS}px`,
              cursor: (isMobile && mobileView === 'text') ? 'not-allowed' : 'pointer',
              color: selectedPalette.text,
              opacity: (isMobile && mobileView === 'text') ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none',
              touchAction: 'manipulation'
            }}
            onMouseOver={(e) => {
              if (!isMobile && !(isMobile && mobileView === 'text')) {
                e.currentTarget.style.backgroundColor = selectedPalette.border;
              }
            }}
            onMouseOut={(e) => {
              if (!isMobile) {
                e.currentTarget.style.backgroundColor = selectedPalette.background;
              }
            }}
            title="Center and fit polytope"
          >
            <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 20 20" fill="none">
              <path d="M 3 3 L 3 7 M 3 3 L 7 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M 17 3 L 17 7 M 17 3 L 13 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M 3 17 L 3 13 M 3 17 L 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M 17 17 L 17 13 M 17 17 L 13 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          {/* Clear Button */}
          <button
            disabled={isMobile && mobileView === 'text'}
            onClick={(e) => {
              if (!(isMobile && mobileView === 'text')) {
                const event = new CustomEvent('clearPoints');
                window.dispatchEvent(event);
                e.currentTarget.blur();
              }
            }}
            onTouchStart={(e) => {
              if (!(isMobile && mobileView === 'text')) {
                e.currentTarget.style.backgroundColor = selectedPalette.border;
              }
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.backgroundColor = selectedPalette.background;
              e.currentTarget.blur();
            }}
            style={{
              height: `${BUTTON_HEIGHT}px`,
              padding: '0 10px',
              backgroundColor: selectedPalette.background,
              border: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
              borderRadius: `${BORDER_RADIUS}px`,
              cursor: (isMobile && mobileView === 'text') ? 'not-allowed' : 'pointer',
              color: selectedPalette.text,
              opacity: (isMobile && mobileView === 'text') ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none',
              touchAction: 'manipulation'
            }}
            onMouseOver={(e) => {
              if (!isMobile && !(isMobile && mobileView === 'text')) {
                e.currentTarget.style.backgroundColor = selectedPalette.border;
              }
            }}
            onMouseOut={(e) => {
              if (!isMobile) {
                e.currentTarget.style.backgroundColor = selectedPalette.background;
              }
            }}
            title="Clear all points"
          >
            <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 20 20" fill="none">
              <path d="M 5 5 L 15 15 M 15 5 L 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Right side: Mode Dropdown + View Toggle (mobile) */}
        <div style={{ display: 'flex', gap: `${BUTTON_SPACING}px`, alignItems: 'center' }}>
          {/* Mode Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
              style={{
                height: `${BUTTON_HEIGHT}px`,
                padding: '0 10px',
                backgroundColor: selectedPalette.background,
                border: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
                borderRadius: `${BORDER_RADIUS}px`,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                color: selectedPalette.text,
                gap: '8px',
                minWidth: isMobile ? '90px' : '110px',
                outline: 'none'
              }}
            >
              <span style={{ flex: 1, textAlign: 'left' }}>
                {mode === 'polytopes' ? 'Polytopes'
                  : mode === 'multiplicities' ? 'Multiplicities'
                  : mode === 'rings' ? 'Rings'
                  : 'Fans'}
              </span>
              <span>▼</span>
            </button>

            {isModeDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '2px',
                backgroundColor: selectedPalette.background,
                border: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
                borderRadius: `${BORDER_RADIUS}px`,
                zIndex: 1000,
                overflow: 'hidden',
                minWidth: isMobile ? '90px' : '110px'
              }}>
                <button
                  onClick={() => {
                    setMode('polytopes');
                    setIsModeDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: mode === 'polytopes'
                      ? selectedPalette.border
                      : selectedPalette.background,
                    border: 'none',
                    borderBottom: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '12px',
                    color: selectedPalette.text,
                    transition: 'background-color 0.1s',
                    borderRadius: 0,
                    outline: 'none'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = selectedPalette.border;
                  }}
                  onMouseOut={(e) => {
                    if (mode !== 'polytopes') {
                      e.currentTarget.style.backgroundColor = selectedPalette.background;
                    }
                  }}
                >
                  Polytopes
                </button>
                <button
                  onClick={() => {
                    setMode('rings');
                    setIsModeDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: mode === 'rings'
                      ? selectedPalette.border
                      : selectedPalette.background,
                    border: 'none',
                    borderBottom: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '12px',
                    color: selectedPalette.text,
                    transition: 'background-color 0.1s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = selectedPalette.border;
                  }}
                  onMouseOut={(e) => {
                    if (mode !== 'rings') {
                      e.currentTarget.style.backgroundColor = selectedPalette.background;
                    }
                  }}
                >
                  Rings
                </button>
                <button
                  onClick={() => {
                    setMode('fans');
                    setIsModeDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: mode === 'fans'
                      ? selectedPalette.border
                      : selectedPalette.background,
                    border: 'none',
                    borderBottom: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '12px',
                    color: selectedPalette.text,
                    transition: 'background-color 0.1s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = selectedPalette.border;
                  }}
                  onMouseOut={(e) => {
                    if (mode !== 'fans') {
                      e.currentTarget.style.backgroundColor = selectedPalette.background;
                    }
                  }}
                >
                  Fans
                </button>
                <button
                  onClick={() => {
                    setMode('multiplicities');
                    setIsModeDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: mode === 'multiplicities'
                      ? selectedPalette.border
                      : selectedPalette.background,
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '12px',
                    color: selectedPalette.text,
                    transition: 'background-color 0.1s',
                    borderRadius: 0,
                    outline: 'none'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = selectedPalette.border;
                  }}
                  onMouseOut={(e) => {
                    if (mode !== 'multiplicities') {
                      e.currentTarget.style.backgroundColor = selectedPalette.background;
                    }
                  }}
                >
                  Multiplicities
                </button>
              </div>
            )}
          </div>

          {/* View toggle (mobile only) */}
          {isMobile && (
            <Toggle
              isLeft={mobileView === 'canvas'}
              onToggle={() => setMobileView(mobileView === 'canvas' ? 'text' : 'canvas')}
              leftIcon={
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <circle cx="6" cy="6" r="1.5" fill="currentColor" />
                  <circle cx="10" cy="6" r="1.5" fill="currentColor" />
                  <circle cx="14" cy="6" r="1.5" fill="currentColor" />
                  <circle cx="6" cy="10" r="1.5" fill="currentColor" />
                  <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                  <circle cx="14" cy="10" r="1.5" fill="currentColor" />
                  <circle cx="6" cy="14" r="1.5" fill="currentColor" />
                  <circle cx="10" cy="14" r="1.5" fill="currentColor" />
                  <circle cx="14" cy="14" r="1.5" fill="currentColor" />
                </svg>
              }
              rightIcon={
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <line x1="4" y1="6" x2="16" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="4" y1="14" x2="12" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              }
              title={mobileView === 'canvas' ? 'Switch to Notes' : 'Switch to Lattice'}
              palette={selectedPalette}
              borderThickness={BORDER_THICKNESS}
              borderOpacity={BORDER_OPACITY}
              buttonHeight={BUTTON_HEIGHT}
            />
          )}
        </div>
      </div>

      {/* Backdrop for hamburger menu */}
      {isSidebarOpen && (
        <div
          onClick={() => {
            setIsSidebarOpen(false);
            setIsLoadDropdownOpen(false);
          }}
          style={{
            position: 'fixed',
            top: '50px',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 99
          }}
        />
      )}

      {/* Hamburger Menu Dropdown */}
      {isSidebarOpen && (
        <div style={{
          position: 'absolute',
          top: '50px',
          left: 0,
          width: '60px',
          backgroundColor: selectedPalette.background,
          border: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
          borderRadius: `${BORDER_RADIUS}px`,
          zIndex: 100
        }}>
          {/* Lattice Type Toggle (mobile only) */}
          {isMobile && (
            <>
              <button
                onClick={() => {
                  setLatticeType('square');
                  setIsSidebarOpen(false);
                  setIsLoadDropdownOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: latticeType === 'square' ? selectedPalette.border : selectedPalette.background,
                  border: 'none',
                  borderBottom: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
                  cursor: 'pointer',
                  color: selectedPalette.text,
                  transition: 'background-color 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  outline: 'none',
                  borderTopLeftRadius: `${BORDER_RADIUS_INNER}px`,
                  borderTopRightRadius: `${BORDER_RADIUS_INNER}px`
                }}
                onMouseOver={(e) => {
                  if (latticeType !== 'square') {
                    e.currentTarget.style.backgroundColor = selectedPalette.border;
                  }
                }}
                onMouseOut={(e) => {
                  if (latticeType !== 'square') {
                    e.currentTarget.style.backgroundColor = selectedPalette.background;
                  }
                }}
                title="Square lattice"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <rect x="4" y="4" width="12" height="12" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setLatticeType('hexagonal');
                  setIsSidebarOpen(false);
                  setIsLoadDropdownOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: latticeType === 'hexagonal' ? selectedPalette.border : selectedPalette.background,
                  border: 'none',
                  borderBottom: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
                  cursor: 'pointer',
                  color: selectedPalette.text,
                  transition: 'background-color 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  outline: 'none'
                }}
                onMouseOver={(e) => {
                  if (latticeType !== 'hexagonal') {
                    e.currentTarget.style.backgroundColor = selectedPalette.border;
                  }
                }}
                onMouseOut={(e) => {
                  if (latticeType !== 'hexagonal') {
                    e.currentTarget.style.backgroundColor = selectedPalette.background;
                  }
                }}
                title="Hexagonal lattice"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M 10 3 L 15.5 6.5 L 15.5 13.5 L 10 17 L 4.5 13.5 L 4.5 6.5 Z" stroke="currentColor" strokeWidth="1.8" fill="none" />
                </svg>
              </button>
            </>
          )}

          {/* Undo */}
          <button
            onClick={() => {
              const event = new CustomEvent('undoPoints');
              window.dispatchEvent(event);
              setIsSidebarOpen(false);
              setIsLoadDropdownOpen(false);
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              backgroundColor: selectedPalette.background,
              border: 'none',
              borderBottom: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
              cursor: 'pointer',
              color: selectedPalette.text,
              transition: 'background-color 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              outline: 'none',
              borderRadius: 0
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = selectedPalette.border;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = selectedPalette.background;
            }}
            title="Undo"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M 7 7 L 4 10 L 7 13 M 4 10 L 14 10 C 15.5 10 17 11.5 17 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>

          {/* Redo */}
          <button
            onClick={() => {
              const event = new CustomEvent('redoPoints');
              window.dispatchEvent(event);
              setIsSidebarOpen(false);
              setIsLoadDropdownOpen(false);
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              backgroundColor: selectedPalette.background,
              border: 'none',
              borderBottom: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
              cursor: 'pointer',
              color: selectedPalette.text,
              transition: 'background-color 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              outline: 'none',
              borderRadius: 0
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = selectedPalette.border;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = selectedPalette.background;
            }}
            title="Redo"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M 13 7 L 16 10 L 13 13 M 16 10 L 6 10 C 4.5 10 3 11.5 3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>

          {/* Save (development only) */}
          {import.meta.env.DEV && (
            <button
              onClick={() => {
                handleSavePolytope();
                setIsSidebarOpen(false);
                setIsLoadDropdownOpen(false);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: selectedPalette.background,
                border: 'none',
                borderBottom: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
                cursor: 'pointer',
                color: selectedPalette.text,
                transition: 'background-color 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                outline: 'none',
                borderRadius: 0
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = selectedPalette.border;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = selectedPalette.background;
              }}
              title="Save polytope (dev only)"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M 4 4 L 4 16 L 16 16 L 16 6 L 14 4 Z M 7 4 L 7 8 L 13 8 L 13 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="7" y="11" width="6" height="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
              </svg>
            </button>
          )}

          {/* Export LaTeX */}
          <button
            onClick={() => {
              handleExportLatex();
              setIsSidebarOpen(false);
              setIsLoadDropdownOpen(false);
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              backgroundColor: selectedPalette.background,
              border: 'none',
              borderBottom: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
              cursor: 'pointer',
              color: selectedPalette.text,
              transition: 'background-color 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              outline: 'none',
              borderRadius: 0
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = selectedPalette.border;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = selectedPalette.background;
            }}
            title="Export as LaTeX/TikZ"
          >
            <svg width="16" height="16" viewBox="0 0 30 20" fill="currentColor">
              {/* T */}
              <path d="M 1 2 L 1 4.5 L 4 4.5 L 4 17 L 6.5 17 L 6.5 4.5 L 9.5 4.5 L 9.5 2 Z" />
              {/* E (full-sized but lowered) */}
              <path d="M 10.5 7 L 10.5 20 L 17.5 20 L 17.5 17.5 L 13 17.5 L 13 14.5 L 17 14.5 L 17 12 L 13 12 L 13 9.5 L 17.5 9.5 L 17.5 7 Z" />
              {/* X */}
              <path d="M 18.5 2 L 21.5 9.5 L 18.5 17 L 21 17 L 23 12 L 25 17 L 27.5 17 L 24.5 9.5 L 27.5 2 L 25 2 L 23 7 L 21 2 Z" />
            </svg>
          </button>

          {/* Load */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsLoadDropdownOpen(!isLoadDropdownOpen)}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: selectedPalette.background,
                border: 'none',
                cursor: 'pointer',
                color: selectedPalette.text,
                transition: 'background-color 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                outline: 'none',
                borderRadius: 0
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = selectedPalette.border;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = selectedPalette.background;
              }}
              title="Load polytope"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M 3 6 L 3 16 L 17 16 L 17 6 L 10 6 L 8 4 L 3 4 Z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Load Dropdown */}
            {isLoadDropdownOpen && (
              <div style={{
                position: 'absolute',
                left: '100%',
                top: '0',
                marginLeft: '4px',
                backgroundColor: selectedPalette.background,
                border: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
                borderRadius: `${BORDER_RADIUS}px`,
                zIndex: 1000,
                maxHeight: '400px',
                overflow: 'auto'
              }}>
                {savedPolytopes.length === 0 ? (
                  <div style={{
                    padding: '12px',
                    color: selectedPalette.text,
                    fontSize: '12px',
                    fontStyle: 'italic'
                  }}>
                    No saved polytopes
                  </div>
                ) : (
                  savedPolytopes.map((polytope) => (
                    <button
                      key={polytope.name}
                      onClick={() => handleLoadPolytope(polytope.name)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: selectedPalette.background,
                        border: 'none',
                        borderBottom: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '12px',
                        color: selectedPalette.text,
                        transition: 'background-color 0.1s',
                        whiteSpace: 'nowrap',
                        borderRadius: 0
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = selectedPalette.border;
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = selectedPalette.background;
                      }}
                    >
                      {polytope.name}
                      <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '8px' }}>
                        ({polytope.point_count} pts)
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* Main Content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '0' : '20px',
            padding: isMobile ? '0' : '20px',
            overflow: 'hidden',
            minHeight: 0,
            alignItems: 'stretch'
          }}
          onTouchStart={isMobile ? onTouchStart : undefined}
          onTouchMove={isMobile ? onTouchMove : undefined}
          onTouchEnd={isMobile ? onTouchEnd : undefined}
        >
        {/* Lattice Canvas */}
        <div
          ref={canvasContainerRef}
          style={{
            flex: 1,
            minHeight: 0,
            backgroundColor: selectedPalette.background,
            display: isMobile ? (mobileView === 'canvas' ? 'block' : 'none') : 'block'
          }}
        >
          <LatticeCanvas
            palette={selectedPalette}
            latticeType={latticeType}
            mode={mode}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            blinkState={blinkState}
          />
        </div>

        {/* Right Side: Text Area */}
        <div style={{
          flex: 1,
          minHeight: 0,
          height: '100%',
          border: isMobile ? 'none' : `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
          borderRadius: isMobile ? '0' : `${BORDER_RADIUS}px`,
          backgroundColor: selectedPalette.background,
          display: isMobile ? (mobileView === 'text' ? 'flex' : 'none') : 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Edit button (development only) - positioned in top right */}
          {!import.meta.env.PROD && (
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                padding: '6px 8px',
                backgroundColor: 'transparent',
                border: `${BORDER_THICKNESS}px solid ${hexToRgba(selectedPalette.border, BORDER_OPACITY)}`,
                borderRadius: `${BORDER_RADIUS_INNER}px`,
                cursor: 'pointer',
                fontSize: '18px',
                color: selectedPalette.text,
                opacity: 0.6,
                transition: 'opacity 0.15s',
                zIndex: 10
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
              title={isEditMode ? 'View mode' : 'Edit mode'}
            >
              {isEditMode ? '×' : '✎'}
            </button>
          )}

          {isEditMode ? (
            // Edit mode: Show textarea
            <textarea
              value={modeTexts[mode]}
              onChange={(e) => updateCurrentModeText(e.target.value)}
              onKeyDown={(e) => {
                // Development mode keyboard shortcuts
                if (import.meta.env.DEV) {
                  const isMod = e.metaKey || e.ctrlKey; // Cmd on Mac, Ctrl on Windows

                  if (isMod && e.key === 'b') {
                    e.preventDefault();
                    const textarea = e.currentTarget;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const before = text.substring(0, start);
                    const selected = text.substring(start, end);
                    const after = text.substring(end);

                    // Insert [b][/b] around selected text or at cursor
                    const newText = before + '[b]' + selected + '[/b]' + after;
                    updateCurrentModeText(newText);

                    // Position cursor between tags (or after selection if text was selected)
                    setTimeout(() => {
                      textarea.selectionStart = textarea.selectionEnd = start + 3 + selected.length;
                      textarea.focus();
                    }, 0);
                  } else if (isMod && e.key === 'i') {
                    e.preventDefault();
                    const textarea = e.currentTarget;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const before = text.substring(0, start);
                    const selected = text.substring(start, end);
                    const after = text.substring(end);

                    // Insert [i][/i] around selected text or at cursor
                    const newText = before + '[i]' + selected + '[/i]' + after;
                    updateCurrentModeText(newText);

                    // Position cursor between tags (or after selection if text was selected)
                    setTimeout(() => {
                      textarea.selectionStart = textarea.selectionEnd = start + 3 + selected.length;
                      textarea.focus();
                    }, 0);
                  } else if (isMod && e.key === 't') {
                    e.preventDefault();
                    const textarea = e.currentTarget;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const before = text.substring(0, start);
                    const selected = text.substring(start, end);
                    const after = text.substring(end);

                    // Insert [title][/title] around selected text or at cursor
                    const newText = before + '[title]' + selected + '[/title]' + after;
                    updateCurrentModeText(newText);

                    // Position cursor between tags (or after selection if text was selected)
                    setTimeout(() => {
                      textarea.selectionStart = textarea.selectionEnd = start + 7 + selected.length;
                      textarea.focus();
                    }, 0);
                  } else if (isMod && e.key === 'c') {
                    e.preventDefault();
                    const textarea = e.currentTarget;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const before = text.substring(0, start);
                    const selected = text.substring(start, end);
                    const after = text.substring(end);

                    // Insert [center][/center] around selected text or at cursor
                    const newText = before + '[center]' + selected + '[/center]' + after;
                    updateCurrentModeText(newText);

                    // Position cursor between tags (or after selection if text was selected)
                    setTimeout(() => {
                      textarea.selectionStart = textarea.selectionEnd = start + 8 + selected.length;
                      textarea.focus();
                    }, 0);
                  }
                }
              }}
              style={{
                flex: 1,
                padding: '15px',
                border: 'none',
                outline: 'none',
                resize: 'none',
                backgroundColor: selectedPalette.background,
                color: selectedPalette.text,
                fontSize: '14px',
                fontFamily: 'monospace',
                lineHeight: '1.6'
              }}
              placeholder="Enter notes with LaTeX (e.g., $x^2$, $$\int f$$)..."
            />
          ) : (
            // View mode: Show rendered content
            <div style={{
              flex: 1,
              padding: '15px',
              overflow: 'auto',
              backgroundColor: selectedPalette.background
            }}>
              {modeTexts[mode] ? (
                <LatexRenderer content={modeTexts[mode]} textColor={selectedPalette.text} palette={selectedPalette} polytopeStats={polytopeStats} />
              ) : (
                <div style={{
                  color: selectedPalette.text,
                  opacity: 0.4,
                  fontSize: '13px',
                  fontStyle: 'italic'
                }}>
                  Loading content from server...
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>

    {/* LaTeX Export Modal */}
    {exportModalData && (
      <LatexExportModal
        isOpen={isExportModalOpen}
        onClose={() => {
          setIsExportModalOpen(false);
          setExportModalData(null);
        }}
        hullVertices={exportModalData.hull}
        allPoints={exportModalData.points}
        latticeType={latticeType}
        palette={selectedPalette}
        palettes={palettes}
        onExport={handleExportWithOptions}
        generatePreviewCode={(options) => {
          const exportData: PolytopeExportData = {
            name: 'polytope',
            hullVertices: exportModalData.hull,
            latticeType: latticeType as 'square' | 'hexagonal',
            allPoints: exportModalData.points
          };
          return generateTikZCode(exportData, options);
        }}
      />
    )}
    </>
  )
}

export default App
