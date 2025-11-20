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

function App() {
  const [selectedPalette, setSelectedPalette] = useState<ColorPalette>(palettes[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
      padding: '20px',
      backgroundColor: selectedPalette.background
    }}>
      <div style={{ marginBottom: '20px', position: 'relative', width: 'fit-content' }}>
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
            left: 0,
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
      <LatticeCanvas palette={selectedPalette} />
    </div>
  )
}

export default App
