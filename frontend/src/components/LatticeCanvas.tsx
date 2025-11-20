import { useRef, useEffect, useState } from 'react';
import { convexHull, type Point } from '../utils/convexHull';
import type { ColorPalette } from '../App';

interface LatticeCanvasProps {
  palette: ColorPalette;
  width?: number;
  height?: number;
  gridSpacing?: number;
}

export default function LatticeCanvas({
  palette,
  width = 600,
  height = 400,
  gridSpacing = 40
}: LatticeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set());
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);

  const DRAG_THRESHOLD = 5; // pixels - movement needed to count as drag vs click

  // Selection threshold that scales with zoom - more generous at low zoom
  const getSelectionThreshold = () => {
    const spacing = gridSpacing * zoom;
    // At min zoom (~0.375), spacing = 15, threshold will be 15
    // At max zoom, threshold will be capped at 30
    return Math.min(30, Math.max(15, spacing * 0.5));
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

  // Convert canvas coordinates to lattice coordinates
  const canvasToLattice = (canvasX: number, canvasY: number): Point => {
    const centerX = width / 2;
    const centerY = height / 2;
    const spacing = gridSpacing * zoom;

    return {
      x: Math.round((canvasX - centerX - offset.x) / spacing),
      y: Math.round((centerY - canvasY - offset.y) / spacing) // Fixed: was + offset.y
    };
  };

  // Convert lattice coordinates to canvas coordinates
  const latticeToCanvas = (latticeX: number, latticeY: number): Point => {
    const centerX = width / 2;
    const centerY = height / 2;
    const spacing = gridSpacing * zoom;

    return {
      x: centerX + latticeX * spacing + offset.x,
      y: centerY - latticeY * spacing - offset.y
    };
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
    const spacing = gridSpacing * currentZoom;

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
      selectedPointsArray.forEach(point => {
        const centerX = width / 2;
        const centerY = height / 2;
        const canvasX = centerX + point.x * spacing + newOffset.x;
        const canvasY = centerY - point.y * spacing - newOffset.y;

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

  // Handle mouse down for panning
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setDragStart({ x, y });
    setPanStart({ x: offset.x, y: offset.y });
  };

  // Handle mouse move to show hover effect and handle panning
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseCanvasX = event.clientX - rect.left;
    const mouseCanvasY = event.clientY - rect.top;

    // Handle panning if dragging
    if (dragStart && panStart) {
      const dx = mouseCanvasX - dragStart.x;
      const dy = mouseCanvasY - dragStart.y;

      // Check if moved enough to be a drag
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        setIsPanning(true);
        const newOffset = {
          x: panStart.x + dx,
          y: panStart.y - dy  // Inverted: drag down = view goes up
        };
        setOffset(clampOffset(newOffset));
        setHoveredPoint(null); // Clear hover during pan
        return;
      }
    }

    // Show hover effect if not panning
    if (!isPanning) {
      const nearestLattice = canvasToLattice(mouseCanvasX, mouseCanvasY);
      const nearestCanvas = latticeToCanvas(nearestLattice.x, nearestLattice.y);

      const distance = canvasDistance(
        { x: mouseCanvasX, y: mouseCanvasY },
        nearestCanvas
      );

      if (distance <= getSelectionThreshold()) {
        setHoveredPoint(nearestLattice);
      } else {
        setHoveredPoint(null);
      }
    }
  };

  // Handle mouse up to end panning or handle click
  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragStart) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseCanvasX = event.clientX - rect.left;
    const mouseCanvasY = event.clientY - rect.top;

    const dx = mouseCanvasX - dragStart.x;
    const dy = mouseCanvasY - dragStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If didn't move much, treat as click
    if (distance <= DRAG_THRESHOLD && !isPanning) {
      handleClick(mouseCanvasX, mouseCanvasY);
    }

    setIsPanning(false);
    setDragStart(null);
    setPanStart(null);
  };

  // Handle point selection (called from mouse up if not dragging)
  const handleClick = (mouseCanvasX: number, mouseCanvasY: number) => {
    const nearestLattice = canvasToLattice(mouseCanvasX, mouseCanvasY);
    const nearestCanvas = latticeToCanvas(nearestLattice.x, nearestLattice.y);

    const distance = canvasDistance(
      { x: mouseCanvasX, y: mouseCanvasY },
      nearestCanvas
    );

    // Only select if mouse is close enough to the point
    if (distance <= getSelectionThreshold()) {
      const key = pointKey(nearestLattice.x, nearestLattice.y);

      setSelectedPoints(prev => {
        const newSet = new Set(prev);
        if (newSet.has(key)) {
          newSet.delete(key);
        } else {
          newSet.add(key);
        }
        return newSet;
      });
    }
  };

  // Get array of selected points
  const getSelectedPointsArray = (): Point[] => {
    return Array.from(selectedPoints).map(key => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });
  };

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

    // Clear canvas with palette background
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);

    const spacing = gridSpacing * zoom;
    const centerX = width / 2;
    const centerY = height / 2;

    // Calculate visible lattice bounds
    // Account for the full canvas dimensions and offset
    const minX = Math.floor((-centerX - offset.x) / spacing) - 1;
    const maxX = Math.ceil((width - centerX - offset.x) / spacing) + 1;
    const minY = Math.floor((-centerY - offset.y) / spacing) - 1;
    const maxY = Math.ceil((height - centerY - offset.y) / spacing) + 1;

    // Draw lattice points
    const latticePointSize = getLatticePointSize();
    ctx.fillStyle = palette.latticePoints;
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const canvasPos = latticeToCanvas(x, y);
        ctx.beginPath();
        ctx.arc(canvasPos.x, canvasPos.y, latticePointSize, 0, Math.PI * 2);
        ctx.fill();
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

  }, [width, height, gridSpacing, zoom, offset, selectedPoints, hoveredPoint, palette]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{
        cursor: isPanning ? 'grabbing' : 'default',
        touchAction: 'none'
      }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
