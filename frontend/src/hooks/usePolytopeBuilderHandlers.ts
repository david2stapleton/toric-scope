import { useState } from 'react';
import type { Point } from '../utils/convexHull';

interface UsePolytopeBuilderHandlersProps {
  selectedPoints: Set<string>;
  setSelectedPoints: React.Dispatch<React.SetStateAction<Set<string>>>;
  canvasToLattice: (x: number, y: number) => Point;
  latticeToCanvas: (x: number, y: number) => Point;
  canvasDistance: (p1: Point, p2: Point) => number;
  getSelectionThreshold: () => number;
  setHoveredPoint: React.Dispatch<React.SetStateAction<Point | null>>;
  offset: Point;
  setOffset: React.Dispatch<React.SetStateAction<Point>>;
  clampOffset: (newOffset: Point) => Point;
  edgePoints: Set<string>;
  interiorPoints: Set<string>;
  pointKey: (x: number, y: number) => string;
}

export function usePolytopeBuilderHandlers({
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
}: UsePolytopeBuilderHandlersProps) {
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
    // In polytope builder mode, show hover for vertices OR non-polytope points
    // Don't show hover for edge points or interior points
    if (!isPanning) {
      const nearestLattice = canvasToLattice(mouseCanvasX, mouseCanvasY);
      const nearestCanvas = latticeToCanvas(nearestLattice.x, nearestLattice.y);

      const distance = canvasDistance(
        { x: mouseCanvasX, y: mouseCanvasY },
        nearestCanvas
      );

      const key = pointKey(nearestLattice.x, nearestLattice.y);
      const isVertex = selectedPoints.has(key);
      const isEdgePoint = edgePoints.has(key);
      const isInteriorPoint = interiorPoints.has(key);

      // Show hover if: close enough AND (is a vertex OR is not an edge/interior point)
      if (distance <= getSelectionThreshold() && (isVertex || (!isEdgePoint && !isInteriorPoint))) {
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

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isPanning
  };
}
