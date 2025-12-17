import { useState, useRef, useEffect } from 'react';
import type { Point } from '../utils/convexHull';
import type { ColorPalette } from '../App';

export interface LatexExportOptions {
  fillColor: string;
  strokeColor: string;
  pointColor: string;
  lineThickness: number;
  latticePointSize: number;
  hullVertexSize: number;
  scale: number;
}

interface LatexExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  hullVertices: Point[];
  allPoints: Point[];
  latticeType: 'square' | 'hexagonal';
  palette: ColorPalette;
  palettes: ColorPalette[];
  onExport: (options: LatexExportOptions) => void;
  generatePreviewCode: (options: LatexExportOptions) => string;
}

export default function LatexExportModal({
  isOpen,
  onClose,
  hullVertices,
  allPoints,
  latticeType,
  palette: initialPalette,
  palettes,
  onExport,
  generatePreviewCode
}: LatexExportModalProps) {
  const [previewMode, setPreviewMode] = useState<'visual' | 'text'>('visual');
  const [selectedPalette, setSelectedPalette] = useState<ColorPalette>(initialPalette);
  const [isPaletteDropdownOpen, setIsPaletteDropdownOpen] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Use initialPalette for modal UI, selectedPalette only for polytope rendering
  // Options will use actual hex colors from selectedPalette
  const [options, setOptions] = useState<LatexExportOptions>({
    fillColor: initialPalette.hullFill,
    strokeColor: initialPalette.hullStroke,
    pointColor: initialPalette.latticePoints,
    lineThickness: 1.5,
    latticePointSize: 1,
    hullVertexSize: 2,
    scale: 0.8
  });

  // Update colors when palette changes
  useEffect(() => {
    setOptions(prev => ({
      ...prev,
      fillColor: selectedPalette.hullFill,
      strokeColor: selectedPalette.hullStroke,
      pointColor: selectedPalette.latticePoints
    }));
  }, [selectedPalette]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render visual preview
  useEffect(() => {
    if (!isOpen || previewMode !== 'visual' || !canvasRef.current || hullVertices.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate bounding box
    const minX = Math.min(...hullVertices.map(p => p.x)) - 1;
    const maxX = Math.max(...hullVertices.map(p => p.x)) + 1;
    const minY = Math.min(...hullVertices.map(p => p.y)) - 1;
    const maxY = Math.max(...hullVertices.map(p => p.y)) + 1;

    const width = maxX - minX;
    const height = maxY - minY;

    // Use equal absolute padding on all sides (in pixels)
    const padding = 40;
    const availableWidth = canvas.width - 2 * padding;
    const availableHeight = canvas.height - 2 * padding;

    // Calculate scale to fit canvas
    const scaleX = availableWidth / width;
    const scaleY = availableHeight / height;
    const baseScale = Math.min(scaleX, scaleY) * options.scale;

    // Center with equal padding
    const scaledWidth = width * baseScale;
    const scaledHeight = height * baseScale;

    // Force equal visual margins by using padding as the offset
    const offsetX = padding;
    const offsetY = padding;

    // Add centering adjustment for the non-constrained dimension
    const extraX = (availableWidth - scaledWidth) / 2;
    const extraY = (availableHeight - scaledHeight) / 2;

    // Transform coordinate to canvas with equal margins
    const toCanvas = (p: Point) => ({
      x: offsetX + extraX + (p.x - minX) * baseScale,
      y: canvas.height - offsetY - extraY - (p.y - minY) * baseScale // Flip Y
    });

    // Draw lattice points using palette color
    ctx.fillStyle = selectedPalette.latticePoints;
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const pos = toCanvas({ x, y });
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, options.latticePointSize, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Draw filled polytope using palette color
    if (hullVertices.length > 0) {
      ctx.fillStyle = selectedPalette.hullFill;
      ctx.beginPath();
      const first = toCanvas(hullVertices[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < hullVertices.length; i++) {
        const pos = toCanvas(hullVertices[i]);
        ctx.lineTo(pos.x, pos.y);
      }
      ctx.closePath();
      ctx.fill();

      // Draw polytope edges using palette color
      ctx.strokeStyle = selectedPalette.hullStroke;
      ctx.lineWidth = options.lineThickness;
      ctx.stroke();

      // Draw hull vertices using palette color
      ctx.fillStyle = selectedPalette.selectedPoints;
      for (const vertex of hullVertices) {
        const pos = toCanvas(vertex);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, options.hullVertexSize, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }, [isOpen, previewMode, hullVertices, options, selectedPalette]);

  if (!isOpen) return null;

  const latexCode = generatePreviewCode(options);

  // Handle copy to clipboard
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(latexCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Helper function to convert hex to rgba with opacity
  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Create style for slider tracks with uniform light background
  const trackColor = hexToRgba(initialPalette.latticePoints, 0.2);
  const sliderStyle = `
    .palette-slider {
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      cursor: pointer;
    }
    .palette-slider::-webkit-slider-runnable-track {
      background: ${trackColor};
      height: 6px;
      border-radius: 3px;
    }
    .palette-slider::-moz-range-track {
      background: ${trackColor};
      height: 6px;
      border-radius: 3px;
    }
    .palette-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: ${initialPalette.selectedPoints};
      cursor: pointer;
      margin-top: -5px;
    }
    .palette-slider::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: ${initialPalette.selectedPoints};
      cursor: pointer;
      border: none;
    }

    /* Responsive styles */
    @media (min-width: 769px) {
      .mobile-only {
        display: none !important;
      }
    }

    @media (max-width: 768px) {
      .desktop-only {
        display: none !important;
      }
      .options-panel {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        width: 40%;
        max-width: 200px;
        transform: translateX(-100%);
        transition: transform 0.3s ease;
        border-right: 1px solid ${initialPalette.border};
        box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
        background-color: ${hexToRgba(initialPalette.background, 0.95)} !important;
        backdrop-filter: blur(10px);
      }
      .options-panel.mobile-open {
        transform: translateX(0);
      }
      .preview-panel {
        flex: 1 !important;
      }
    }
  `;

  return (
    <>
    <style>{sliderStyle}</style>
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: initialPalette.background,
          border: `2px solid ${initialPalette.border}`,
          borderRadius: '8px',
          width: '90%',
          maxWidth: '900px',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${initialPalette.border}`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative'
        }}>
          {/* Hamburger menu button - visible on mobile */}
          <button
            onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
            style={{
              position: 'absolute',
              left: '20px',
              background: 'none',
              border: 'none',
              color: initialPalette.text,
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              width: '24px',
              height: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
            className="mobile-only"
          >
            <div style={{ width: '20px', height: '2px', backgroundColor: initialPalette.text }} />
            <div style={{ width: '20px', height: '2px', backgroundColor: initialPalette.text }} />
            <div style={{ width: '20px', height: '2px', backgroundColor: initialPalette.text }} />
          </button>

          <h2 style={{ margin: 0, color: initialPalette.text, fontSize: '18px', fontWeight: '600' }}>
            Export LaTeX
          </h2>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              right: '20px',
              background: 'none',
              border: 'none',
              color: initialPalette.text,
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative'
        }}>
          {/* Left: Options - responsive panel */}
          <div
            className={isOptionsMenuOpen ? 'options-panel mobile-open' : 'options-panel'}
            style={{
              flex: '0 0 20%',
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              justifyContent: 'center',
              backgroundColor: initialPalette.background,
              zIndex: 10
            }}
          >
            {/* Color Palette - custom dropdown */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: initialPalette.text, fontSize: '13px' }}>
                Palette
              </label>
              {/* Dropdown trigger */}
              <div
                onClick={() => setIsPaletteDropdownOpen(!isPaletteDropdownOpen)}
                style={{
                  width: '100px',
                  padding: '8px',
                  backgroundColor: initialPalette.background,
                  border: `1px solid ${initialPalette.border}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {/* Color dots for selected palette */}
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: selectedPalette.hullStroke
                }} />
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: selectedPalette.selectedPoints
                }} />
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: selectedPalette.latticePoints
                }} />
                {/* Dropdown arrow */}
                <span style={{ color: initialPalette.text, fontSize: '8px', marginLeft: '4px' }}>▼</span>
              </div>

              {/* Dropdown menu */}
              {isPaletteDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '100px',
                  marginTop: '4px',
                  backgroundColor: initialPalette.background,
                  border: `1px solid ${initialPalette.border}`,
                  borderRadius: '4px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  zIndex: 1000,
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {palettes.map((p) => (
                    <div
                      key={p.name}
                      onClick={() => {
                        setSelectedPalette(p);
                        setIsPaletteDropdownOpen(false);
                      }}
                      style={{
                        padding: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '5px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selectedPalette.name === p.name ? initialPalette.border : 'transparent'
                      }}
                      onMouseOver={(e) => {
                        if (selectedPalette.name !== p.name) {
                          e.currentTarget.style.backgroundColor = initialPalette.border;
                        }
                      }}
                      onMouseOut={(e) => {
                        if (selectedPalette.name !== p.name) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: p.hullStroke
                      }} />
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: p.selectedPoints
                      }} />
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: p.latticePoints
                      }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scale */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: initialPalette.text, fontSize: '13px' }}>
                Scale: {options.scale.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.3"
                max="2"
                step="0.1"
                value={options.scale}
                onChange={(e) => setOptions({ ...options, scale: parseFloat(e.target.value) })}
                className="palette-slider"
                style={{
                  width: '100px'
                }}
              />
            </div>

            {/* Edge thickness */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: initialPalette.text, fontSize: '13px' }}>
                Edge thickness: {options.lineThickness.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.5"
                value={options.lineThickness}
                onChange={(e) => setOptions({ ...options, lineThickness: parseFloat(e.target.value) })}
                className="palette-slider"
                style={{
                  width: '100px'
                }}
              />
            </div>

            {/* Point size */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: initialPalette.text, fontSize: '13px' }}>
                Point size: {options.latticePointSize.toFixed(1)}pt
              </label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.5"
                value={options.latticePointSize}
                onChange={(e) => setOptions({ ...options, latticePointSize: parseFloat(e.target.value) })}
                className="palette-slider"
                style={{
                  width: '100px'
                }}
              />
            </div>

            {/* Vertex size */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: initialPalette.text, fontSize: '13px' }}>
                Vertex size: {options.hullVertexSize.toFixed(1)}pt
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={options.hullVertexSize}
                onChange={(e) => setOptions({ ...options, hullVertexSize: parseFloat(e.target.value) })}
                className="palette-slider"
                style={{
                  width: '100px'
                }}
              />
            </div>
          </div>

          {/* Right: Preview */}
          <div
            className="preview-panel"
            style={{
              flex: '0 0 80%',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0
            }}
          >
            {/* Toggle */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '12px',
              flexShrink: 0
            }}>
              <button
                onClick={() => setPreviewMode('visual')}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: previewMode === 'visual' ? initialPalette.selectedPoints : initialPalette.background,
                  color: previewMode === 'visual' ? '#ffffff' : initialPalette.text,
                  border: `1px solid ${initialPalette.border}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: previewMode === 'visual' ? '600' : '400'
                }}
              >
                Visual
              </button>
              <button
                onClick={() => setPreviewMode('text')}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: previewMode === 'text' ? initialPalette.selectedPoints : initialPalette.background,
                  color: previewMode === 'text' ? '#ffffff' : initialPalette.text,
                  border: `1px solid ${initialPalette.border}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: previewMode === 'text' ? '600' : '400'
                }}
              >
                Code
              </button>
            </div>

            {/* Preview area - fixed height container */}
            {previewMode === 'visual' ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${initialPalette.border}`,
                borderRadius: '4px',
                backgroundColor: initialPalette.background,
                padding: '10px',
                minHeight: 0,
                overflow: 'hidden'
              }}>
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={400}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    borderRadius: '4px'
                  }}
                />
              </div>
            ) : (
              <textarea
                value={latexCode}
                readOnly
                style={{
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  padding: '12px',
                  border: `1px solid ${initialPalette.border}`,
                  borderRadius: '4px',
                  backgroundColor: initialPalette.background,
                  color: initialPalette.text,
                  resize: 'none',
                  minHeight: 0,
                  boxSizing: 'border-box',
                  overflow: 'auto'
                }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: initialPalette.background,
              color: initialPalette.text,
              border: `1px solid ${initialPalette.border}`,
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCopyToClipboard}
            style={{
              padding: '8px 16px',
              backgroundColor: initialPalette.selectedPoints,
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            {copySuccess ? '✓ Copied!' : 'Copy LaTeX'}
          </button>
          <button
            onClick={() => onExport(options)}
            className="desktop-only"
            style={{
              padding: '8px 16px',
              backgroundColor: initialPalette.selectedPoints,
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Download .tex
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
