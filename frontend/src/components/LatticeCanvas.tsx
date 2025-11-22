import { useRef, useEffect, useState } from 'react';
import { convexHull, isPointInsidePolygon, edgePointsOfPolygon, type Point } from '../utils/convexHull';
import type { ColorPalette, LatticeType, Mode } from '../App';
import { usePolytopeBuilderHandlers } from '../hooks/usePolytopeBuilderHandlers';
import { useSectionInvestigatorHandlers } from '../hooks/useSectionInvestigatorHandlers';
import { useRingsHandlers } from '../hooks/useRingsHandlers';
import { StratumRegistry } from '../types/stratum';
import { createStratificationFromPolytope, enumerateLatticePoints } from '../utils/stratification';

interface LatticeCanvasProps {
  palette: ColorPalette;
  latticeType: LatticeType;
  mode: Mode;
  width?: number;
  height?: number;
  gridSpacing?: number;
}

export default function LatticeCanvas({
  palette,
  latticeType,
  mode,
  width = 600,
  height = 400,
  gridSpacing = 40
}: LatticeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set());
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [previousLatticeType, setPreviousLatticeType] = useState<LatticeType>(latticeType);
  const [edgePoints, setEdgePoints] = useState<Set<string>>(new Set());
  const [interiorPoints, setInteriorPoints] = useState<Set<string>>(new Set());
  const [selectedInvestigatorPoint, setSelectedInvestigatorPoint] = useState<Point | null>(null);
  const [highlightedEdges, setHighlightedEdges] = useState<[Point, Point][]>([]);
  const [edgeMultiplicities, setEdgeMultiplicities] = useState<Map<string, number>>(new Map());
  const [stratumRegistry, setStratumRegistry] = useState<StratumRegistry>(new StratumRegistry());
  const [selectedStratumId, setSelectedStratumId] = useState<string | null>(null);
  const [hoveredStratumId, setHoveredStratumId] = useState<string | null>(null);

  // Selection threshold that scales with zoom - smaller for better precision
  const getSelectionThreshold = () => {
    const spacing = gridSpacing * zoom;

    if (latticeType === 'hexagonal') {
      // Hexagonal points are spaced further apart (by sqrt(3))
      // Use a smaller threshold for better edge selection
      const effectiveSpacing = spacing * Math.sqrt(3);
      return Math.min(25, Math.max(12, effectiveSpacing * 0.4));
    } else {
      // Square lattice - smaller threshold for precision
      return Math.min(20, Math.max(10, spacing * 0.35));
    }
  };

  // Point sizes that scale with zoom
  const getLatticePointSize = () => {
    return Math.max(1.5, Math.min(3, zoom * 2));
  };

  const getSelectedPointSize = () => {
    return Math.max(4, Math.min(7, zoom * 5));
  };

  const getHoverGlowSize = () => {
    return getSelectionThreshold() * 0.8;
  };

  // Convert canvas coordinates to lattice coordinates (square lattice)
  const canvasToSquareLattice = (canvasX: number, canvasY: number): Point => {
    const centerX = width / 2;
    const centerY = height / 2;
    const spacing = gridSpacing * zoom;

    return {
      x: Math.round((canvasX - centerX - offset.x) / spacing),
      y: Math.round((centerY - canvasY - offset.y) / spacing)
    };
  };

  // Convert lattice coordinates to canvas coordinates (square lattice)
  const squareLatticeToCanvas = (latticeX: number, latticeY: number): Point => {
    const centerX = width / 2;
    const centerY = height / 2;
    const spacing = gridSpacing * zoom;

    return {
      x: centerX + latticeX * spacing + offset.x,
      y: centerY - latticeY * spacing - offset.y
    };
  };

  // Convert canvas coordinates to hexagonal lattice coordinates (axial: q, r)
  const canvasToHexLattice = (canvasX: number, canvasY: number): Point => {
    const centerX = width / 2;
    const centerY = height / 2;
    const size = gridSpacing * zoom;

    // Adjust for offset and center
    const adjustedX = canvasX - centerX - offset.x;
    const adjustedY = centerY - canvasY - offset.y; // Invert y-axis and account for offset

    // Convert to axial coordinates (fractional)
    // Scaled so (1,0) has same length as square lattice and equal fundamental domain area
    const q = adjustedX / size - adjustedY / (Math.sqrt(3) * size);
    const r = (2 * adjustedY) / (Math.sqrt(3) * size);

    // Round to nearest hex using cube coordinate rounding
    return roundHex(q, r);
  };

  // Convert hexagonal lattice coordinates to canvas coordinates
  const hexLatticeToCanvas = (q: number, r: number): Point => {
    const centerX = width / 2;
    const centerY = height / 2;
    const size = gridSpacing * zoom;

    // Scaled so (1,0) has same length as square lattice and equal fundamental domain area
    const x = size * (q + r/2);
    const y = size * (Math.sqrt(3)/2 * r);

    return {
      x: centerX + x + offset.x,
      y: centerY - y - offset.y  // Flip y for canvas coordinates
    };
  };

  // Round fractional hex coordinates to nearest hex
  const roundHex = (q: number, r: number): Point => {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    }

    return { x: rq, y: rr };
  };

  // Unified interface
  const canvasToLattice = (canvasX: number, canvasY: number): Point => {
    if (latticeType === 'hexagonal') {
      return canvasToHexLattice(canvasX, canvasY);
    }
    return canvasToSquareLattice(canvasX, canvasY);
  };

  const latticeToCanvas = (latticeX: number, latticeY: number): Point => {
    if (latticeType === 'hexagonal') {
      return hexLatticeToCanvas(latticeX, latticeY);
    }
    return squareLatticeToCanvas(latticeX, latticeY);
  };

  // Create a unique key for a point
  const pointKey = (x: number, y: number): string => `${x},${y}`;

  // Calculate distance between two canvas points
  const canvasDistance = (p1: Point, p2: Point): number => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Clamp offset to prevent panning too far and keep selected points visible
  const clampOffset = (newOffset: Point, newZoom?: number): Point => {
    const BUFFER = 50; // pixels buffer from edge
    const currentZoom = newZoom ?? zoom;

    // Get selected points
    const selectedPointsArray = Array.from(selectedPoints).map(key => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });

    // If there are selected points, ensure they stay visible
    if (selectedPointsArray.length > 0) {
      let minCanvasX = Infinity, maxCanvasX = -Infinity;
      let minCanvasY = Infinity, maxCanvasY = -Infinity;

      // Calculate canvas bounds of selected points with the new offset
      // Temporarily set zoom and offset to calculate positions
      const oldZoom = zoom;
      const oldOffset = offset;

      // We need to use the lattice transformation, but it depends on current state
      // So we'll compute manually
      selectedPointsArray.forEach(point => {
        const centerX = width / 2;
        const centerY = height / 2;
        const spacing = gridSpacing * currentZoom;

        let canvasX, canvasY;
        if (latticeType === 'hexagonal') {
          const x = spacing * (point.x + point.y/2);
          const y = spacing * (Math.sqrt(3)/2 * point.y);
          canvasX = centerX + x + newOffset.x;
          canvasY = centerY - y - newOffset.y;
        } else {
          canvasX = centerX + point.x * spacing + newOffset.x;
          canvasY = centerY - point.y * spacing - newOffset.y;
        }

        minCanvasX = Math.min(minCanvasX, canvasX);
        maxCanvasX = Math.max(maxCanvasX, canvasX);
        minCanvasY = Math.min(minCanvasY, canvasY);
        maxCanvasY = Math.max(maxCanvasY, canvasY);
      });

      // Adjust offset to keep points within bounds
      let adjustedX = newOffset.x;
      let adjustedY = newOffset.y;

      if (minCanvasX < BUFFER) adjustedX += (BUFFER - minCanvasX);
      if (maxCanvasX > width - BUFFER) adjustedX -= (maxCanvasX - (width - BUFFER));
      if (minCanvasY < BUFFER) adjustedY -= (BUFFER - minCanvasY);
      if (maxCanvasY > height - BUFFER) adjustedY += (maxCanvasY - (height - BUFFER));

      return { x: adjustedX, y: adjustedY };
    }

    // If no selected points, use general pan limits
    const maxOffset = Math.max(width, height) * 0.5;
    return {
      x: Math.max(-maxOffset, Math.min(maxOffset, newOffset.x)),
      y: Math.max(-maxOffset, Math.min(maxOffset, newOffset.y))
    };
  };

  // Handle mouse wheel for zoom
  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Zoom factor - reduced sensitivity
    const zoomFactor = event.deltaY > 0 ? 0.95 : 1.05;

    // Set minimum zoom based on grid spacing (ensure points are at least 15px apart)
    const minZoom = 15 / gridSpacing; // ~0.375 for default gridSpacing of 40
    const maxZoom = 5;
    const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * zoomFactor));

    // Adjust offset to zoom towards mouse position
    const zoomRatio = newZoom / zoom;
    const centerX = width / 2;
    const centerY = height / 2;

    const newOffset = {
      x: mouseX - centerX - (mouseX - centerX - offset.x) * zoomRatio,
      y: mouseY - centerY - (mouseY - centerY - offset.y) * zoomRatio
    };

    setOffset(clampOffset(newOffset, newZoom)); // Pass newZoom for correct calculation
    setZoom(newZoom);
  };

  // Use the appropriate event handlers based on mode
  const polytopeBuilderHandlers = usePolytopeBuilderHandlers({
    selectedPoints,
    setSelectedPoints,
    canvasToLattice,
    latticeToCanvas,
    canvasDistance,
    getSelectionThreshold,
    setHoveredPoint,
    offset,
    setOffset,
    clampOffset,
    edgePoints,
    interiorPoints,
    pointKey
  });

  const sectionInvestigatorHandlers = useSectionInvestigatorHandlers({
    canvasToLattice,
    latticeToCanvas,
    canvasDistance,
    getSelectionThreshold,
    setHoveredPoint,
    offset,
    setOffset,
    clampOffset,
    selectedPoints,
    edgePoints,
    interiorPoints,
    pointKey,
    setSelectedInvestigatorPoint
  });

  const ringsHandlers = useRingsHandlers({
    canvasToLattice,
    latticeToCanvas,
    canvasDistance,
    getSelectionThreshold,
    setHoveredPoint,
    offset,
    setOffset,
    clampOffset,
    stratumRegistry,
    setSelectedStratumId,
    setHoveredStratumId
  });

  // Select the appropriate handlers based on mode
  const handlers = mode === 'polytope-builder' ? polytopeBuilderHandlers
    : mode === 'section-investigator' ? sectionInvestigatorHandlers
    : mode === 'rings' ? ringsHandlers
    : polytopeBuilderHandlers; // Default for 'fans' mode for now
  const isPanning = handlers.isPanning;


  // Get array of selected points
  const getSelectedPointsArray = (): Point[] => {
    return Array.from(selectedPoints).map(key => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });
  };

  // Adjust visual offset when lattice type changes (coordinates stay the same)
  useEffect(() => {
    if (latticeType !== previousLatticeType && selectedPoints.size > 0) {
      const selectedPointsArray = getSelectedPointsArray();

      // Coordinates don't change - only the visual mapping changes
      // Calculate where center of mass WAS on canvas (using OLD lattice mapping)
      const oldCanvasPositions = selectedPointsArray.map(p => {
        if (previousLatticeType === 'square') {
          return squareLatticeToCanvas(p.x, p.y);
        } else {
          return hexLatticeToCanvas(p.x, p.y);
        }
      });
      const oldCanvasCOM = {
        x: oldCanvasPositions.reduce((sum, p) => sum + p.x, 0) / oldCanvasPositions.length,
        y: oldCanvasPositions.reduce((sum, p) => sum + p.y, 0) / oldCanvasPositions.length
      };

      // Calculate where center of mass IS now on canvas (using NEW lattice mapping, same coordinates)
      const newCanvasPositions = selectedPointsArray.map(p => {
        if (latticeType === 'square') {
          return squareLatticeToCanvas(p.x, p.y);
        } else {
          return hexLatticeToCanvas(p.x, p.y);
        }
      });
      const newCanvasCOM = {
        x: newCanvasPositions.reduce((sum, p) => sum + p.x, 0) / newCanvasPositions.length,
        y: newCanvasPositions.reduce((sum, p) => sum + p.y, 0) / newCanvasPositions.length
      };

      // Adjust visual offset to keep center of mass in the same canvas position
      const offsetAdjustment = {
        x: oldCanvasCOM.x - newCanvasCOM.x,
        y: oldCanvasCOM.y - newCanvasCOM.y
      };

      setOffset(prevOffset => clampOffset({
        x: prevOffset.x + offsetAdjustment.x,
        y: prevOffset.y + offsetAdjustment.y
      }));

      setPreviousLatticeType(latticeType);
    } else if (latticeType !== previousLatticeType) {
      // No selected points, just update the previous type
      setPreviousLatticeType(latticeType);
    }
  }, [latticeType]);

  // Automatically remove interior points from selection
  useEffect(() => {
    const selectedPointsArray = getSelectedPointsArray();

    if (selectedPointsArray.length >= 3) {
      const hull = convexHull(selectedPointsArray);

      // Create set of hull point keys
      const hullKeys = new Set(hull.map(p => pointKey(p.x, p.y)));

      // Find interior points (selected but not on hull)
      const interiorPoints = Array.from(selectedPoints).filter(key => !hullKeys.has(key));

      // If there are interior points, remove them
      if (interiorPoints.length > 0) {
        setSelectedPoints(prev => {
          const newSet = new Set(prev);
          interiorPoints.forEach(key => newSet.delete(key));
          return newSet;
        });
      }
    }
  }, [selectedPoints]);

  // Clear mode-specific state when switching modes
  useEffect(() => {
    if (mode === 'polytope-builder') {
      setSelectedInvestigatorPoint(null);
      setHighlightedEdges([]);
      setSelectedStratumId(null);
    } else if (mode === 'section-investigator') {
      setSelectedStratumId(null);
    } else if (mode === 'rings') {
      setSelectedInvestigatorPoint(null);
      setHighlightedEdges([]);
    } else if (mode === 'fans') {
      setSelectedInvestigatorPoint(null);
      setHighlightedEdges([]);
      setSelectedStratumId(null);
    }
  }, [mode]);

  // Helper to create edge key for multiplicity map
  const edgeKey = (v1: Point, v2: Point): string => `${v1.x},${v1.y}-${v2.x},${v2.y}`;

  // Calculate edge multiplicity - the lattice distance from edge to monomial
  const calculateEdgeMultiplicity = (v1: Point, v2: Point, monomial: Point): number => {
    // Normal vector to the edge (perpendicular)
    const nx = v2.y - v1.y;
    const ny = -(v2.x - v1.x);

    // Make it primitive (divide by gcd)
    const gcd = (a: number, b: number): number => {
      a = Math.abs(a);
      b = Math.abs(b);
      while (b !== 0) {
        const temp = b;
        b = a % b;
        a = temp;
      }
      return a;
    };

    const g = gcd(nx, ny);
    const primitiveNx = g === 0 ? 0 : nx / g;
    const primitiveNy = g === 0 ? 0 : ny / g;

    // Compute signed distance
    const dist = primitiveNx * (monomial.x - v1.x) + primitiveNy * (monomial.y - v1.y);

    return Math.abs(dist);
  };

  // Compute highlighted edges based on selected investigator point
  useEffect(() => {
    const selectedPointsArray = getSelectedPointsArray();

    if (!selectedInvestigatorPoint || selectedPointsArray.length < 3) {
      setHighlightedEdges([]);
      return;
    }

    const hull = convexHull(selectedPointsArray);
    const newHighlightedEdges: [Point, Point][] = [];

    // Check each edge of the hull
    for (let i = 0; i < hull.length; i++) {
      const v1 = hull[i];
      const v2 = hull[(i + 1) % hull.length];

      // Check if the selected point is on this edge
      const isV1 = v1.x === selectedInvestigatorPoint.x && v1.y === selectedInvestigatorPoint.y;
      const isV2 = v2.x === selectedInvestigatorPoint.x && v2.y === selectedInvestigatorPoint.y;

      // Check if selected point is on the line segment between v1 and v2
      let isOnEdge = isV1 || isV2;

      if (!isOnEdge) {
        // Check if point is on the line segment (for edge points)
        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        const t = ((selectedInvestigatorPoint.x - v1.x) * dx + (selectedInvestigatorPoint.y - v1.y) * dy) / (dx * dx + dy * dy);

        if (t >= 0 && t <= 1) {
          const projX = v1.x + t * dx;
          const projY = v1.y + t * dy;

          // Check if the point is exactly on the line (within floating point precision)
          if (Math.abs(projX - selectedInvestigatorPoint.x) < 0.0001 && Math.abs(projY - selectedInvestigatorPoint.y) < 0.0001) {
            isOnEdge = true;
          }
        }
      }

      // If the selected point is NOT on this edge, highlight it
      if (!isOnEdge) {
        newHighlightedEdges.push([v1, v2]);
      }
    }

    setHighlightedEdges(newHighlightedEdges);
  }, [selectedInvestigatorPoint, selectedPoints]);

  // Compute edge multiplicities for highlighted edges
  useEffect(() => {
    if (!selectedInvestigatorPoint || highlightedEdges.length === 0) {
      setEdgeMultiplicities(new Map());
      return;
    }

    const multiplicities = new Map<string, number>();

    highlightedEdges.forEach(([v1, v2]) => {
      const multiplicity = calculateEdgeMultiplicity(v1, v2, selectedInvestigatorPoint);
      multiplicities.set(edgeKey(v1, v2), multiplicity);
    });

    setEdgeMultiplicities(multiplicities);
  }, [selectedInvestigatorPoint, highlightedEdges]);

  // Compute edge and interior lattice points for section investigator mode
  useEffect(() => {
    const selectedPointsArray = getSelectedPointsArray();

    if (selectedPointsArray.length >= 3) {
      const hull = convexHull(selectedPointsArray);

      // Compute edge points (lattice points on edges, excluding vertices)
      const edgePointsArray = edgePointsOfPolygon(hull);
      const newEdgePoints = new Set(edgePointsArray.map(p => pointKey(p.x, p.y)));

      const newInteriorPoints = new Set<string>();

      // Calculate visible lattice bounds
      const spacing = gridSpacing * zoom;
      const centerX = width / 2;
      const centerY = height / 2;

      if (latticeType === 'square') {
        const minX = Math.floor((-centerX - offset.x) / spacing) - 1;
        const maxX = Math.ceil((width - centerX - offset.x) / spacing) + 1;
        const minY = Math.floor((-centerY - offset.y) / spacing) - 1;
        const maxY = Math.ceil((height - centerY - offset.y) / spacing) + 1;

        // Test each visible lattice point
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            const point = { x, y };
            if (isPointInsidePolygon(point, hull)) {
              newInteriorPoints.add(pointKey(x, y));
            }
          }
        }
      } else {
        // Hexagonal lattice
        const hexWidth = spacing;
        const hexHeight = spacing * Math.sqrt(3) / 2;

        const minQ = Math.floor((-centerX - offset.x) / hexWidth) - 4;
        const maxQ = Math.ceil((width - centerX - offset.x) / hexWidth) + 4;
        const minR = Math.floor((-centerY - offset.y) / hexHeight) - 4;
        const maxR = Math.ceil((height - centerY - offset.y) / hexHeight) + 4;

        // Test each visible lattice point
        for (let q = minQ; q <= maxQ; q++) {
          for (let r = minR; r <= maxR; r++) {
            const point = { x: q, y: r };
            if (isPointInsidePolygon(point, hull)) {
              newInteriorPoints.add(pointKey(q, r));
            }
          }
        }
      }

      setEdgePoints(newEdgePoints);
      setInteriorPoints(newInteriorPoints);
    } else {
      // No polytope defined, clear edge and interior points
      setEdgePoints(new Set());
      setInteriorPoints(new Set());
    }
  }, [selectedPoints, zoom, offset, width, height, gridSpacing, latticeType]);

  // Create and update stratum registry when polytope changes
  useEffect(() => {
    const selectedPointsArray = getSelectedPointsArray();

    if (selectedPointsArray.length >= 3) {
      // Calculate visible lattice bounds for monomial enumeration
      const spacing = gridSpacing * zoom;
      const centerX = width / 2;
      const centerY = height / 2;

      let visiblePoints: Point[] = [];

      if (latticeType === 'square') {
        const minX = Math.floor((-centerX - offset.x) / spacing) - 1;
        const maxX = Math.ceil((width - centerX - offset.x) / spacing) + 1;
        const minY = Math.floor((-centerY - offset.y) / spacing) - 1;
        const maxY = Math.ceil((height - centerY - offset.y) / spacing) + 1;

        visiblePoints = enumerateLatticePoints(minX, maxX, minY, maxY);
      } else {
        // Hexagonal lattice
        const hexWidth = spacing;
        const hexHeight = spacing * Math.sqrt(3) / 2;

        const minQ = Math.floor((-centerX - offset.x) / hexWidth) - 4;
        const maxQ = Math.ceil((width - centerX - offset.x) / hexWidth) + 4;
        const minR = Math.floor((-centerY - offset.y) / hexHeight) - 4;
        const maxR = Math.ceil((height - centerY - offset.y) / hexHeight) + 4;

        visiblePoints = enumerateLatticePoints(minQ, maxQ, minR, maxR);
      }

      // Create stratification from polytope
      const registry = createStratificationFromPolytope(selectedPointsArray, visiblePoints);
      setStratumRegistry(registry);

      // Expose registry to window for debugging
      (window as any).stratumRegistry = registry;

      // Log registry info for debugging
      console.log('Stratum Registry Updated:', {
        vertices: registry.getAllVertices().length,
        edges: registry.getAllEdges().length,
        faces: registry.getAllFaces().length,
        totalStrata: registry.getTotalCount()
      });
      console.log('Access full registry via: window.stratumRegistry');
    } else {
      // No polytope defined, clear registry
      setStratumRegistry(new StratumRegistry());
    }
  }, [selectedPoints, zoom, offset, width, height, gridSpacing, latticeType]);

  // Prevent page scroll on wheel event with passive: false
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener('wheel', wheelHandler, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', wheelHandler);
    };
  }, []);

  // Render the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Helper to convert hex to rgba
    const hexToRgba = (hex: string, alpha: number): string => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Clear canvas with palette background
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);

    const spacing = gridSpacing * zoom;
    const centerX = width / 2;
    const centerY = height / 2;

    // Calculate visible lattice bounds and draw lattice points
    const latticePointSize = getLatticePointSize();
    ctx.fillStyle = palette.latticePoints;

    if (latticeType === 'square') {
      // Square lattice bounds
      const minX = Math.floor((-centerX - offset.x) / spacing) - 1;
      const maxX = Math.ceil((width - centerX - offset.x) / spacing) + 1;
      const minY = Math.floor((-centerY - offset.y) / spacing) - 1;
      const maxY = Math.ceil((height - centerY - offset.y) / spacing) + 1;

      // Draw square lattice points
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const canvasPos = latticeToCanvas(x, y);
          ctx.beginPath();
          ctx.arc(canvasPos.x, canvasPos.y, latticePointSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // Hexagonal lattice - iterate in axial coordinates (q, r)
      // Use generous bounds since hexagons don't tile in a simple rectangular grid
      const hexWidth = spacing * Math.sqrt(3);
      const hexHeight = spacing * 1.5;

      // Calculate bounds with extra padding
      const minQ = Math.floor((-centerX - offset.x) / hexWidth) - 4;
      const maxQ = Math.ceil((width - centerX - offset.x) / hexWidth) + 4;
      const minR = Math.floor((-centerY - offset.y) / hexHeight) - 4;
      const maxR = Math.ceil((height - centerY - offset.y) / hexHeight) + 4;

      // Draw hexagonal lattice points
      for (let q = minQ; q <= maxQ; q++) {
        for (let r = minR; r <= maxR; r++) {
          const canvasPos = latticeToCanvas(q, r);
          // Only draw if within canvas bounds (with margin)
          if (canvasPos.x >= -spacing && canvasPos.x <= width + spacing &&
              canvasPos.y >= -spacing && canvasPos.y <= height + spacing) {
            ctx.beginPath();
            ctx.arc(canvasPos.x, canvasPos.y, latticePointSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Draw convex hull first (so it's behind points)
    const selectedPointsArray = getSelectedPointsArray();
    if (selectedPointsArray.length >= 3) {
      const hull = convexHull(selectedPointsArray);

      if (hull.length >= 3) {
        // Draw filled polygon
        ctx.fillStyle = palette.hullFill;
        ctx.beginPath();
        const firstPoint = latticeToCanvas(hull[0].x, hull[0].y);
        ctx.moveTo(firstPoint.x, firstPoint.y);

        for (let i = 1; i < hull.length; i++) {
          const point = latticeToCanvas(hull[i].x, hull[i].y);
          ctx.lineTo(point.x, point.y);
        }
        ctx.closePath();
        ctx.fill();

        // Draw hull edges
        ctx.strokeStyle = palette.hullStroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw hovered edge (in rings mode)
    if (mode === 'rings' && hoveredStratumId) {
      const hoveredEdge = stratumRegistry.getEdge(hoveredStratumId);
      if (hoveredEdge) {
        const v1 = stratumRegistry.getVertex(hoveredEdge.vertices[0]);
        const v2 = stratumRegistry.getVertex(hoveredEdge.vertices[1]);
        if (v1 && v2) {
          const p1 = latticeToCanvas(v1.point.x, v1.point.y);
          const p2 = latticeToCanvas(v2.point.x, v2.point.y);

          // Draw glow
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = hexToRgba(palette.selectedPoints, 0.3);
          ctx.lineWidth = 8;
          ctx.stroke();

          // Draw highlighted edge
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = palette.selectedPoints;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    }

    // Draw highlighted edges (in section investigator mode)
    if (highlightedEdges.length > 0) {
      highlightedEdges.forEach(([v1, v2]) => {
        const p1 = latticeToCanvas(v1.x, v1.y);
        const p2 = latticeToCanvas(v2.x, v2.y);

        // Add a subtle glow effect first (drawn behind)
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = hexToRgba(palette.selectedPoints, 0.3);
        ctx.lineWidth = 8;
        ctx.stroke();

        // Draw highlighted edge with emphasized style on top
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = palette.selectedPoints;
        ctx.lineWidth = 4;
        ctx.stroke();

        // Draw multiplicity at edge midpoint
        const key = edgeKey(v1, v2);
        const multiplicity = edgeMultiplicities.get(key);

        if (multiplicity !== undefined && multiplicity > 0) {
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;

          // Calculate edge direction for text offset
          const edgeDx = p2.x - p1.x;
          const edgeDy = p2.y - p1.y;
          const edgeLength = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);

          // Normal vector to the edge (for offsetting text)
          const normalX = -edgeDy / edgeLength;
          const normalY = edgeDx / edgeLength;

          // Offset text slightly away from the edge
          const textOffset = 20;
          const textX = midX + normalX * textOffset;
          const textY = midY + normalY * textOffset;

          // Draw multiplicity text
          ctx.font = 'bold 14px monospace';
          ctx.fillStyle = palette.text;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(multiplicity.toString(), textX, textY);
        }
      });
    }

    // Draw hovered point (if any)
    const hoverGlowSize = getHoverGlowSize();
    if (hoveredPoint) {
      const canvasPos = latticeToCanvas(hoveredPoint.x, hoveredPoint.y);
      const isSelected = selectedPoints.has(pointKey(hoveredPoint.x, hoveredPoint.y));

      // Draw glow effect - use palette colors with transparency
      const hoverColor = isSelected ? palette.selectedPoints : palette.hullStroke;
      // Extract RGB and add alpha
      ctx.fillStyle = hoverColor.replace(')', ', 0.4)').replace('rgb', 'rgba').replace('#', 'rgba(');
      if (ctx.fillStyle.startsWith('#')) {
        // Fallback for hex colors
        ctx.fillStyle = 'rgba(135, 206, 235, 0.4)';
      }
      ctx.beginPath();
      ctx.arc(canvasPos.x, canvasPos.y, hoverGlowSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw selected points
    const selectedPointSize = getSelectedPointSize();
    ctx.fillStyle = palette.selectedPoints;
    selectedPointsArray.forEach(point => {
      const canvasPos = latticeToCanvas(point.x, point.y);
      ctx.beginPath();
      ctx.arc(canvasPos.x, canvasPos.y, selectedPointSize, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw selected monomial (in section investigator mode)
    if (selectedInvestigatorPoint) {
      const canvasPos = latticeToCanvas(selectedInvestigatorPoint.x, selectedInvestigatorPoint.y);

      // Draw outer glow
      ctx.fillStyle = hexToRgba(palette.selectedPoints, 0.3);
      ctx.beginPath();
      ctx.arc(canvasPos.x, canvasPos.y, selectedPointSize * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw the monomial point
      ctx.fillStyle = palette.selectedPoints;
      ctx.beginPath();
      ctx.arc(canvasPos.x, canvasPos.y, selectedPointSize * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Highlight regions in rings mode
    if (mode === 'rings' && selectedStratumId) {
      const stratum = stratumRegistry.getStratum(selectedStratumId);

      if (stratum && stratum.dimension === 0) {
        // Vertex selected - draw wedge/cone extending from vertex along adjacent edges
        const vertex = stratumRegistry.getVertex(selectedStratumId);
        if (vertex) {
          const vertexCanvas = latticeToCanvas(vertex.point.x, vertex.point.y);

          // Find adjacent edges (edges that contain this vertex)
          const adjacentEdges = stratumRegistry.getAllEdges().filter(edge =>
            edge.vertices.includes(selectedStratumId)
          );

          if (adjacentEdges.length === 2) {
            // Get the other vertices of the adjacent edges
            const neighbors: Point[] = [];
            adjacentEdges.forEach(edge => {
              const otherVertexId = edge.vertices[0] === selectedStratumId
                ? edge.vertices[1]
                : edge.vertices[0];
              const otherVertex = stratumRegistry.getVertex(otherVertexId);
              if (otherVertex) {
                neighbors.push(otherVertex.point);
              }
            });

            if (neighbors.length === 2) {
              // Calculate direction vectors in lattice coordinates
              const dir1 = {
                x: neighbors[0].x - vertex.point.x,
                y: neighbors[0].y - vertex.point.y
              };
              const dir2 = {
                x: neighbors[1].x - vertex.point.x,
                y: neighbors[1].y - vertex.point.y
              };

              // Extend rays to a large distance in lattice space
              const rayLength = 1000; // Large number in lattice coordinates

              // Calculate ray endpoints in lattice space
              const ray1EndLattice = {
                x: vertex.point.x + dir1.x * rayLength,
                y: vertex.point.y + dir1.y * rayLength
              };

              const ray2EndLattice = {
                x: vertex.point.x + dir2.x * rayLength,
                y: vertex.point.y + dir2.y * rayLength
              };

              // Convert to canvas coordinates
              const ray1EndCanvas = latticeToCanvas(ray1EndLattice.x, ray1EndLattice.y);
              const ray2EndCanvas = latticeToCanvas(ray2EndLattice.x, ray2EndLattice.y);

              // Draw filled wedge with a lighter color
              ctx.fillStyle = hexToRgba(palette.hullStroke, 0.2);
              ctx.beginPath();
              ctx.moveTo(vertexCanvas.x, vertexCanvas.y);
              ctx.lineTo(ray1EndCanvas.x, ray1EndCanvas.y);
              ctx.lineTo(ray2EndCanvas.x, ray2EndCanvas.y);
              ctx.closePath();
              ctx.fill();
            }
          }
        }
      } else if (stratum && stratum.dimension === 1) {
        // Edge selected - draw half-plane extending from edge in normal direction
        const edge = stratumRegistry.getEdge(selectedStratumId);
        if (edge) {
          // Get the two vertices of the edge
          const v1 = stratumRegistry.getVertex(edge.vertices[0]);
          const v2 = stratumRegistry.getVertex(edge.vertices[1]);

          if (v1 && v2) {
            // Get the primitive normal (perpendicular direction) - flip it for inward direction
            const normal = {
              x: -edge.primitiveNormal.x,
              y: -edge.primitiveNormal.y
            };

            // Edge direction vector
            const edgeDir = {
              x: v2.point.x - v1.point.x,
              y: v2.point.y - v1.point.y
            };

            // Create a very large half-plane
            const largeDistance = 1000;

            // Four corners of the half-plane in lattice space:
            // Extend far along the edge in both directions
            // Extend far in the normal direction
            const corner1 = {
              x: v1.point.x - edgeDir.x * largeDistance,
              y: v1.point.y - edgeDir.y * largeDistance
            };

            const corner2 = {
              x: v2.point.x + edgeDir.x * largeDistance,
              y: v2.point.y + edgeDir.y * largeDistance
            };

            const corner3 = {
              x: corner2.x + normal.x * largeDistance,
              y: corner2.y + normal.y * largeDistance
            };

            const corner4 = {
              x: corner1.x + normal.x * largeDistance,
              y: corner1.y + normal.y * largeDistance
            };

            // Convert to canvas coordinates
            const c1 = latticeToCanvas(corner1.x, corner1.y);
            const c2 = latticeToCanvas(corner2.x, corner2.y);
            const c3 = latticeToCanvas(corner3.x, corner3.y);
            const c4 = latticeToCanvas(corner4.x, corner4.y);

            // Draw filled half-plane
            ctx.fillStyle = hexToRgba(palette.hullStroke, 0.2);
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y);
            ctx.lineTo(c2.x, c2.y);
            ctx.lineTo(c3.x, c3.y);
            ctx.lineTo(c4.x, c4.y);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }

    // Draw fan rays in fan mode
    if (mode === 'fans' && stratumRegistry.getTotalCount() > 0) {
      const vertices = stratumRegistry.getAllVertices();
      const edges = stratumRegistry.getAllEdges();

      if (vertices.length >= 3 && edges.length > 0) {
        // Calculate center of mass in lattice coordinates
        const centerOfMassLattice = {
          x: vertices.reduce((sum, v) => sum + v.point.x, 0) / vertices.length,
          y: vertices.reduce((sum, v) => sum + v.point.y, 0) / vertices.length
        };

        // Convert to canvas coordinates
        const centerCanvas = latticeToCanvas(centerOfMassLattice.x, centerOfMassLattice.y);

        // Draw a small circle at the center of mass
        ctx.fillStyle = palette.selectedPoints;
        ctx.beginPath();
        ctx.arc(centerCanvas.x, centerCanvas.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw rays from center perpendicular to each edge (in canvas space)
        edges.forEach(edge => {
          // Get edge vertices
          const v1 = stratumRegistry.getVertex(edge.vertices[0]);
          const v2 = stratumRegistry.getVertex(edge.vertices[1]);

          if (v1 && v2) {
            // Transform edge endpoints to canvas space
            const canvasV1 = latticeToCanvas(v1.point.x, v1.point.y);
            const canvasV2 = latticeToCanvas(v2.point.x, v2.point.y);

            // Compute edge direction in canvas space
            const edgeDx = canvasV2.x - canvasV1.x;
            const edgeDy = canvasV2.y - canvasV1.y;

            // Compute perpendicular direction in canvas space (rotate 90 degrees)
            // This gives us the normal direction
            const normalDx = -edgeDy;
            const normalDy = edgeDx;

            // Normalize the normal vector
            const normalLength = Math.sqrt(normalDx * normalDx + normalDy * normalDy);
            const normalizedDx = normalDx / normalLength;
            const normalizedDy = normalDy / normalLength;

            // Extend ray to a large distance in canvas space
            const rayLength = 2000; // pixels

            // Calculate ray endpoint in canvas space
            const rayEndCanvas = {
              x: centerCanvas.x + normalizedDx * rayLength,
              y: centerCanvas.y + normalizedDy * rayLength
            };

            // Draw the ray
            ctx.beginPath();
            ctx.moveTo(centerCanvas.x, centerCanvas.y);
            ctx.lineTo(rayEndCanvas.x, rayEndCanvas.y);
            ctx.strokeStyle = palette.selectedPoints;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        });
      }
    }

  }, [width, height, gridSpacing, zoom, offset, selectedPoints, hoveredPoint, palette, latticeType, highlightedEdges, selectedInvestigatorPoint, edgeMultiplicities, mode, selectedStratumId, hoveredStratumId, stratumRegistry]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={(e) => {
        const canvas = canvasRef.current;
        if (canvas) handlers.handleMouseDown(e, canvas);
      }}
      onMouseMove={(e) => {
        const canvas = canvasRef.current;
        if (canvas) handlers.handleMouseMove(e, canvas);
      }}
      onMouseUp={(e) => {
        const canvas = canvasRef.current;
        if (canvas) handlers.handleMouseUp(e, canvas);
      }}
      onWheel={handleWheel}
      style={{
        cursor: isPanning ? 'grabbing' : 'default',
        touchAction: 'none'
      }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
