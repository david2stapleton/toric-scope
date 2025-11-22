import './App.css'
import LatticeCanvas from './components/LatticeCanvas'
import { useState } from 'react'

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
    background: '#f5f0e8',
    latticePoints: '#c4b8a8',
    selectedPoints: '#ffb6c1',
    hullFill: 'rgba(179, 157, 219, 0.3)',
    hullStroke: '#b39ddb',
    border: '#d4c4b4',
    text: '#6b5d4f'
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
export type Mode = 'polytope-builder' | 'section-investigator' | 'rings' | 'fans';

function App() {
  const [selectedPalette, setSelectedPalette] = useState<ColorPalette>(palettes[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [latticeType, setLatticeType] = useState<LatticeType>('square');
  const [mode, setMode] = useState<Mode>('polytope-builder');
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

  const PaletteOption = ({ palette }: { palette: ColorPalette }) => (
    <div style={{
      display: 'flex',
      gap: '6px',
      alignItems: 'center'
    }}>
      <div style={{
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        backgroundColor: palette.selectedPoints,
        border: `1px solid ${palette.border}`
      }} />
      <div style={{
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        backgroundColor: palette.hullStroke,
        border: `1px solid ${palette.border}`
      }} />
      <div style={{
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        backgroundColor: palette.latticePoints,
        border: `1px solid ${palette.border}`
      }} />
    </div>
  );

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
      {/* Top Menu Bar */}
      <div style={{
        height: '50px',
        borderBottom: `1px solid ${selectedPalette.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        backgroundColor: selectedPalette.background
      }}>
        {/* Lattice Type Toggle */}
        <div style={{
          display: 'flex',
          gap: '0',
          border: `1px solid ${selectedPalette.border}`,
          borderRadius: '6px',
          overflow: 'hidden'
        }}>
          <button
            onClick={() => setLatticeType('square')}
            style={{
              padding: '8px 12px',
              backgroundColor: latticeType === 'square'
                ? selectedPalette.border
                : selectedPalette.background,
              border: 'none',
              cursor: 'pointer',
              color: selectedPalette.text,
              borderRight: `1px solid ${selectedPalette.border}`,
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
              padding: '8px 12px',
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

        {/* Palette Selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{
              padding: '8px 12px',
              backgroundColor: selectedPalette.background,
              border: `1px solid ${selectedPalette.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              fontSize: '14px',
              color: selectedPalette.text
            }}
          >
            <PaletteOption palette={selectedPalette} />
            <span style={{ marginLeft: '4px' }}>▼</span>
          </button>

          {isDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              backgroundColor: selectedPalette.background,
              border: `1px solid ${selectedPalette.border}`,
              borderRadius: '6px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              zIndex: 1000,
              minWidth: '120px'
            }}>
              {palettes.map((palette) => (
                <button
                  key={palette.name}
                  onClick={() => {
                    setSelectedPalette(palette);
                    setIsDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: selectedPalette.name === palette.name
                      ? palette.border
                      : palette.background,
                    border: 'none',
                    borderBottom: `1px solid ${palette.border}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    textAlign: 'left',
                    transition: 'background-color 0.1s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = palette.border;
                  }}
                  onMouseOut={(e) => {
                    if (selectedPalette.name !== palette.name) {
                      e.currentTarget.style.backgroundColor = palette.background;
                    }
                  }}
                >
                  <PaletteOption palette={palette} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '20px',
        padding: '20px',
        overflow: 'hidden'
      }}>
        {/* Left Side: Canvas + Stats */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Lattice Canvas */}
          <div>
            <LatticeCanvas palette={selectedPalette} latticeType={latticeType} mode={mode} />
          </div>

          {/* Stats/Config Box */}
          <div style={{
            width: '600px',
            height: '200px',
            border: `1px solid ${selectedPalette.border}`,
            borderRadius: '6px',
            padding: '15px',
            backgroundColor: selectedPalette.background,
            display: 'flex',
            gap: '20px'
          }}>
            {/* Left: Mode Selector */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: selectedPalette.text,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Mode
              </div>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: selectedPalette.background,
                    border: `1px solid ${selectedPalette.border}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '14px',
                    color: selectedPalette.text,
                    textAlign: 'left'
                  }}
                >
                  <span>
                    {mode === 'polytope-builder' ? 'Polytope'
                      : mode === 'section-investigator' ? 'Multiplicities'
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
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: selectedPalette.background,
                    border: `1px solid ${selectedPalette.border}`,
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000,
                    overflow: 'hidden'
                  }}>
                    <button
                      onClick={() => {
                        setMode('polytope-builder');
                        setIsModeDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        backgroundColor: mode === 'polytope-builder'
                          ? selectedPalette.border
                          : selectedPalette.background,
                        border: 'none',
                        borderBottom: `1px solid ${selectedPalette.border}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '14px',
                        color: selectedPalette.text,
                        transition: 'background-color 0.1s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = selectedPalette.border;
                      }}
                      onMouseOut={(e) => {
                        if (mode !== 'polytope-builder') {
                          e.currentTarget.style.backgroundColor = selectedPalette.background;
                        }
                      }}
                    >
                      Polytope
                    </button>
                    <button
                      onClick={() => {
                        setMode('section-investigator');
                        setIsModeDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        backgroundColor: mode === 'section-investigator'
                          ? selectedPalette.border
                          : selectedPalette.background,
                        border: 'none',
                        borderBottom: `1px solid ${selectedPalette.border}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '14px',
                        color: selectedPalette.text,
                        transition: 'background-color 0.1s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = selectedPalette.border;
                      }}
                      onMouseOut={(e) => {
                        if (mode !== 'section-investigator') {
                          e.currentTarget.style.backgroundColor = selectedPalette.background;
                        }
                      }}
                    >
                      Multiplicities
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
                        fontSize: '14px',
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
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '14px',
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
                  </div>
                )}
              </div>
            </div>

            {/* Right: Statistics (placeholder for now) */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: selectedPalette.text,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Statistics
              </div>
              <div style={{
                fontSize: '13px',
                color: selectedPalette.text,
                opacity: 0.6
              }}>
                {/* Statistics will appear here */}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Text Area */}
        <div style={{
          flex: 1,
          border: `1px solid ${selectedPalette.border}`,
          borderRadius: '6px',
          padding: '15px',
          backgroundColor: selectedPalette.background,
          overflow: 'auto'
        }}>
          {/* Text area content will go here */}
        </div>
      </div>
    </div>
  )
}

export default App
