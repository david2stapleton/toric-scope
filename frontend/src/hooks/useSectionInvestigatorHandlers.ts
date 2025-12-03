import { useState, useEffect } from 'react';
import type { Point } from '../utils/convexHull';

interface UseSectionInvestigatorHandlersProps {
  canvasToLattice: (x: number, y: number) => Point;
  latticeToCanvas: (x: number, y: number) => Point;
  canvasDistance: (p1: Point, p2: Point) => number;
  getSelectionThreshold: () => number;
  setHoveredPoint: React.Dispatch<React.SetStateAction<Point | null>>;
  offset: Point;
  setOffset: React.Dispatch<React.SetStateAction<Point>>;
  clampOffset: (newOffset: Point) => Point;
  selectedPoints: Set<string>;
  edgePoints: Set<string>;
  interiorPoints: Set<string>;
  pointKey: (x: number, y: number) => string;
  setSelectedInvestigatorPoint: React.Dispatch<React.SetStateAction<Point | null>>;
}

export function useSectionInvestigatorHandlers({
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
}: UseSectionInvestigatorHandlersProps) {
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [panStart, setPanStart] = useState<Point | null>(null);

  const DRAG_THRESHOLD = 5; // pixels

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setDragStart({ x, y });
    setPanStart({ x: offset.x, y: offset.y });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
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
    // In section investigator mode, show hover for vertices, edge points, and interior points
    if (!isPanning) {
      const nearestLattice = canvasToLattice(mouseCanvasX, mouseCanvasY);
      const nearestCanvas = latticeToCanvas(nearestLattice.x, nearestLattice.y);

      const distance = canvasDistance(
        { x: mouseCanvasX, y: mouseCanvasY },
        nearestCanvas
      );

      const key = pointKey(nearestLattice.x, nearestLattice.y);

      // Show hover if point is close enough AND is a polytope point (vertex, edge, or interior)
      if (distance <= getSelectionThreshold() && (selectedPoints.has(key) || edgePoints.has(key) || interiorPoints.has(key))) {
        setHoveredPoint(nearestLattice);
      } else {
        setHoveredPoint(null);
      }
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    if (!dragStart) return;

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

  const handleClick = (mouseCanvasX: number, mouseCanvasY: number) => {
    const nearestLattice = canvasToLattice(mouseCanvasX, mouseCanvasY);
    const nearestCanvas = latticeToCanvas(nearestLattice.x, nearestLattice.y);

    const distance = canvasDistance(
      { x: mouseCanvasX, y: mouseCanvasY },
      nearestCanvas
    );

    const key = pointKey(nearestLattice.x, nearestLattice.y);

    // If clicking on a polytope point
    if (distance <= getSelectionThreshold() && (selectedPoints.has(key) || edgePoints.has(key) || interiorPoints.has(key))) {
      // Toggle: if clicking the same point again, clear selection
      setSelectedInvestigatorPoint(prev => {
        if (prev && prev.x === nearestLattice.x && prev.y === nearestLattice.y) {
          return null;
        }
        return nearestLattice;
      });
    } else {
      // If clicking away from polytope, clear selection
      setSelectedInvestigatorPoint(null);
    }
  };

  // Listen for mouseup on window to handle releases outside canvas
  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (dragStart) {
        setIsPanning(false);
        setDragStart(null);
        setPanStart(null);
      }
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, [dragStart]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isPanning
  };
}
