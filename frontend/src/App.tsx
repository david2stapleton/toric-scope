import './App.css'
import LatticeCanvas from './components/LatticeCanvas'
import LatexRenderer from './components/LatexRenderer'
import { useState, useEffect, useRef } from 'react'

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

  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'canvas' | 'text'>('canvas'); // Which panel to show on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Hamburger menu state

  // Initialize with empty strings, will load from backend
  const [modeTexts, setModeTexts] = useState<ModeTextContent>({
    'polytopes': '',
    'multiplicities': '',
    'rings': '',
    'fans': ''
  });

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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

  return (
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
        borderBottom: `1px solid ${selectedPalette.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 15px',
        backgroundColor: selectedPalette.background
      }}>
        {/* Left side: Hamburger + Mode selector */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Hamburger button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: selectedPalette.text
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Mode Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
              style={{
                padding: '8px 12px',
                backgroundColor: selectedPalette.background,
                border: `1px solid ${selectedPalette.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                color: selectedPalette.text,
                textAlign: 'left',
                gap: '8px',
                minWidth: '140px'
              }}
            >
              <span>
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
                left: 0,
                marginTop: '4px',
                backgroundColor: selectedPalette.background,
                border: `1px solid ${selectedPalette.border}`,
                borderRadius: '6px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                zIndex: 1000,
                overflow: 'hidden',
                minWidth: '140px'
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
                    borderBottom: `1px solid ${selectedPalette.border}`,
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
                    borderBottom: `1px solid ${selectedPalette.border}`,
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
                    borderBottom: `1px solid ${selectedPalette.border}`,
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
                    transition: 'background-color 0.1s'
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
        </div>

        {/* Right side: View toggle (mobile only) */}
        {isMobile && (
          <div style={{
            display: 'flex',
            gap: '8px',
            fontSize: '12px',
            color: selectedPalette.text
          }}>
            <button
              onClick={() => setMobileView('canvas')}
              style={{
                padding: '6px 12px',
                backgroundColor: mobileView === 'canvas' ? selectedPalette.border : 'transparent',
                border: `1px solid ${selectedPalette.border}`,
                borderRadius: '4px',
                cursor: 'pointer',
                color: selectedPalette.text,
                fontSize: '12px'
              }}
            >
              Lattice
            </button>
            <button
              onClick={() => setMobileView('text')}
              style={{
                padding: '6px 12px',
                backgroundColor: mobileView === 'text' ? selectedPalette.border : 'transparent',
                border: `1px solid ${selectedPalette.border}`,
                borderRadius: '4px',
                cursor: 'pointer',
                color: selectedPalette.text,
                fontSize: '12px'
              }}
            >
              Notes
            </button>
          </div>
        )}
      </div>

      {/* Backdrop for hamburger menu */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
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
          width: '220px',
          backgroundColor: selectedPalette.background,
          border: `1px solid ${selectedPalette.border}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 100,
          maxHeight: 'calc(100vh - 50px)',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: '15px',
          gap: '15px'
        }}>
          {/* Lattice Type Toggle - Vertical */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0',
            border: `1px solid ${selectedPalette.border}`,
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => setLatticeType('square')}
              style={{
                padding: '12px',
                backgroundColor: latticeType === 'square'
                  ? selectedPalette.border
                  : selectedPalette.background,
                border: 'none',
                cursor: 'pointer',
                color: selectedPalette.text,
                borderBottom: `1px solid ${selectedPalette.border}`,
                transition: 'background-color 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="4" y="4" width="12" height="12" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
            <button
              onClick={() => setLatticeType('hexagonal')}
              style={{
                padding: '12px',
                backgroundColor: latticeType === 'hexagonal'
                  ? selectedPalette.border
                  : selectedPalette.background,
                border: 'none',
                cursor: 'pointer',
                color: selectedPalette.text,
                transition: 'background-color 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 3 L16 6.5 L16 13.5 L10 17 L4 13.5 L4 6.5 Z" stroke="currentColor" strokeWidth="1.8" fill="none" />
              </svg>
            </button>
          </div>

          {/* Center View Button */}
          <button
            onClick={() => {
              // This will be handled by a callback from LatticeCanvas
              const event = new CustomEvent('centerView');
              window.dispatchEvent(event);
            }}
            style={{
              padding: '12px',
              backgroundColor: selectedPalette.background,
              border: `1px solid ${selectedPalette.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              color: selectedPalette.text,
              transition: 'background-color 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = selectedPalette.border;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = selectedPalette.background;
            }}
            title="Center and fit polytope"
          >
            {/* Four corners icon */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              {/* Top-left corner */}
              <path d="M 3 3 L 3 7 M 3 3 L 7 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              {/* Top-right corner */}
              <path d="M 17 3 L 17 7 M 17 3 L 13 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              {/* Bottom-left corner */}
              <path d="M 3 17 L 3 13 M 3 17 L 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              {/* Bottom-right corner */}
              <path d="M 17 17 L 17 13 M 17 17 L 13 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          {/* Clear Button */}
          <button
            onClick={() => {
              const event = new CustomEvent('clearPoints');
              window.dispatchEvent(event);
            }}
            style={{
              padding: '12px',
              backgroundColor: selectedPalette.background,
              border: `1px solid ${selectedPalette.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              color: selectedPalette.text,
              transition: 'background-color 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = selectedPalette.border;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = selectedPalette.background;
            }}
            title="Clear all points"
          >
            {/* X icon */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M 5 5 L 15 15 M 15 5 L 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          {/* Undo/Redo Buttons */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0',
            border: `1px solid ${selectedPalette.border}`,
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => {
                const event = new CustomEvent('undoPoints');
                window.dispatchEvent(event);
              }}
              style={{
                padding: '12px',
                backgroundColor: selectedPalette.background,
                border: 'none',
                borderBottom: `1px solid ${selectedPalette.border}`,
                cursor: 'pointer',
                color: selectedPalette.text,
                transition: 'background-color 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = selectedPalette.border;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = selectedPalette.background;
              }}
              title="Undo"
            >
              {/* Undo icon - curved arrow left */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M 7 7 L 4 10 L 7 13 M 4 10 L 14 10 C 15.5 10 17 11.5 17 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </button>
            <button
              onClick={() => {
                const event = new CustomEvent('redoPoints');
                window.dispatchEvent(event);
              }}
              style={{
                padding: '12px',
                backgroundColor: selectedPalette.background,
                border: 'none',
                cursor: 'pointer',
                color: selectedPalette.text,
                transition: 'background-color 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = selectedPalette.border;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = selectedPalette.background;
              }}
              title="Redo"
            >
              {/* Redo icon - curved arrow right */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M 13 7 L 16 10 L 13 13 M 16 10 L 6 10 C 4.5 10 3 11.5 3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSavePolytope}
            style={{
              padding: '12px',
              backgroundColor: selectedPalette.background,
              border: `1px solid ${selectedPalette.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              color: selectedPalette.text,
              transition: 'background-color 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = selectedPalette.border;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = selectedPalette.background;
            }}
            title="Save polytope"
          >
            {/* Save icon (floppy disk) */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M 4 4 L 4 16 L 16 16 L 16 6 L 14 4 Z M 7 4 L 7 8 L 13 8 L 13 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="7" y="11" width="6" height="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
            </svg>
          </button>

          {/* Load Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsLoadDropdownOpen(!isLoadDropdownOpen)}
              style={{
                padding: '12px',
                backgroundColor: selectedPalette.background,
                border: `1px solid ${selectedPalette.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                color: selectedPalette.text,
                transition: 'background-color 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = selectedPalette.border;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = selectedPalette.background;
              }}
              title="Load polytope"
            >
              {/* Load icon (folder) */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M 3 6 L 3 16 L 17 16 L 17 6 L 10 6 L 8 4 L 3 4 Z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Load Dropdown */}
            {isLoadDropdownOpen && (
              <div style={{
                position: 'absolute',
                left: '70px',
                top: '0',
                backgroundColor: selectedPalette.background,
                border: `1px solid ${selectedPalette.border}`,
                borderRadius: '6px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                zIndex: 1000,
                minWidth: '200px',
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
                        padding: '10px 12px',
                        backgroundColor: selectedPalette.background,
                        border: 'none',
                        borderBottom: `1px solid ${selectedPalette.border}`,
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
          />
        </div>

        {/* Right Side: Text Area */}
        <div style={{
          flex: 1,
          minHeight: 0,
          height: '100%',
          border: isMobile ? 'none' : `1px solid ${selectedPalette.border}`,
          borderRadius: isMobile ? '0' : '6px',
          backgroundColor: selectedPalette.background,
          display: isMobile ? (mobileView === 'text' ? 'flex' : 'none') : 'flex',
          flexDirection: 'column'
        }}>
          {/* Header - Edit button (development only) */}
          {!import.meta.env.PROD && (
            <div style={{
              padding: '12px 15px',
              borderBottom: `1px solid ${selectedPalette.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center'
            }}>
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: isEditMode ? selectedPalette.border : selectedPalette.background,
                  border: `1px solid ${selectedPalette.border}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: selectedPalette.text,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '600',
                  transition: 'background-color 0.15s'
                }}
              >
                {isEditMode ? 'View' : 'Edit'}
              </button>
            </div>
          )}

          {isEditMode ? (
            // Edit mode: Show textarea
            <textarea
              value={modeTexts[mode]}
              onChange={(e) => updateCurrentModeText(e.target.value)}
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
                <LatexRenderer content={modeTexts[mode]} textColor={selectedPalette.text} palette={selectedPalette} />
              ) : (
                <div style={{
                  color: selectedPalette.text,
                  opacity: 0.4,
                  fontSize: '13px',
                  fontStyle: 'italic'
                }}>
                  No content yet. Click "Edit" to add notes...
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

export default App
