import { useState, useEffect } from 'react';
import type { Point } from '../utils/convexHull';
import type { StratumRegistry } from '../types/stratum';

interface UseRingsHandlersProps {
  canvasToLattice: (canvasX: number, canvasY: number) => Point;
  latticeToCanvas: (latticeX: number, latticeY: number) => Point;
  canvasDistance: (p1: Point, p2: Point) => number;
  getSelectionThreshold: () => number;
  setHoveredPoint: (point: Point | null) => void;
  offset: Point;
  setOffset: (offset: Point) => void;
  clampOffset: (offset: Point) => Point;
  stratumRegistry: StratumRegistry;
  setSelectedStratumId: (id: string | null) => void;
  setHoveredStratumId: (id: string | null) => void;
}

const DRAG_THRESHOLD = 5; // pixels

export function useRingsHandlers({
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
}: UseRingsHandlersProps) {
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [panStart, setPanStart] = useState<Point | null>(null);
  const [lastClickTime, setLastClickTime] = useState<number>(0);
  const [lastClickedStratumId, setLastClickedStratumId] = useState<string | null>(null);

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    setDragStart({ x: canvasX, y: canvasY });
    setPanStart({ x: offset.x, y: offset.y });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    // Check if we're panning
    if (dragStart && panStart) {
      const dragDistance = canvasDistance({ x: canvasX, y: canvasY }, dragStart);

      if (dragDistance > DRAG_THRESHOLD) {
        setIsPanning(true);

        // Calculate new offset
        const dx = canvasX - dragStart.x;
        const dy = canvasY - dragStart.y;
        const newOffset = {
          x: panStart.x + dx,
          y: panStart.y - dy  // Inverted: drag down = view goes up
        };

        setOffset(clampOffset(newOffset));
      }
    }

    // Find hovered stratum (same logic as click, but just for hover feedback)
    const hoveredId = findStratumAtPosition(canvasX, canvasY);
    setHoveredStratumId(hoveredId);

    // Also set hovered point for vertex highlighting
    if (hoveredId && stratumRegistry.getVertex(hoveredId)) {
      const vertex = stratumRegistry.getVertex(hoveredId);
      if (vertex) {
        setHoveredPoint(vertex.point);
      }
    } else {
      setHoveredPoint(null);
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    // If we weren't panning, handle stratum selection
    if (!isPanning && dragStart) {
      const clickDistance = canvasDistance({ x: canvasX, y: canvasY }, dragStart);

      if (clickDistance < DRAG_THRESHOLD) {
        handleStratumClick(canvasX, canvasY);
      }
    }

    // Reset drag state
    setIsPanning(false);
    setDragStart(null);
    setPanStart(null);
  };

  const findStratumAtPosition = (canvasX: number, canvasY: number): string | null => {
    const threshold = getSelectionThreshold();
    let closestStratumId: string | null = null;
    let closestDistance = Infinity;

    // Check vertices first (highest priority)
    const vertices = stratumRegistry.getAllVertices();
    for (const vertex of vertices) {
      const canvasPos = latticeToCanvas(vertex.point.x, vertex.point.y);
      const distance = canvasDistance({ x: canvasX, y: canvasY }, canvasPos);

      if (distance < threshold && distance < closestDistance) {
        closestDistance = distance;
        closestStratumId = vertex.id;
      }
    }

    // If no vertex was clicked, check edges
    if (!closestStratumId) {
      const edges = stratumRegistry.getAllEdges();
      for (const edge of edges) {
        // Get the two vertices of the edge
        const v1 = stratumRegistry.getVertex(edge.vertices[0]);
        const v2 = stratumRegistry.getVertex(edge.vertices[1]);

        if (!v1 || !v2) continue;

        const canvasV1 = latticeToCanvas(v1.point.x, v1.point.y);
        const canvasV2 = latticeToCanvas(v2.point.x, v2.point.y);

        // Calculate distance from click point to line segment
        const distance = distanceToSegment(
          { x: canvasX, y: canvasY },
          canvasV1,
          canvasV2
        );

        if (distance < threshold && distance < closestDistance) {
          closestDistance = distance;
          closestStratumId = edge.id;
        }
      }
    }

    // If no vertex or edge was clicked, check if we're inside the face
    if (!closestStratumId) {
      const faces = stratumRegistry.getAllFaces();
      if (faces.length > 0) {
        const face = faces[0]; // Assume single face for now
        const hullPoints = face.hullVertices
          .map(id => stratumRegistry.getVertex(id))
          .filter((v): v is NonNullable<typeof v> => v !== undefined)
          .map(v => v.point);

        // Check if click point is inside the polytope
        const latticePoint = canvasToLattice(canvasX, canvasY);
        if (isPointInsideOrOnPolygon(latticePoint, hullPoints)) {
          closestStratumId = face.id;
        }
      }
    }

    return closestStratumId;
  };

  const handleStratumClick = (canvasX: number, canvasY: number) => {
    const stratumId = findStratumAtPosition(canvasX, canvasY);
    const currentTime = Date.now();
    const DOUBLE_CLICK_THRESHOLD = 300; // milliseconds

    // Check for double-click
    if (
      stratumId &&
      stratumId === lastClickedStratumId &&
      currentTime - lastClickTime < DOUBLE_CLICK_THRESHOLD
    ) {
      // Double-click detected - deselect
      setSelectedStratumId(null);
      setLastClickedStratumId(null);
      setLastClickTime(0);
    } else {
      // Single click - select
      setSelectedStratumId(stratumId);
      setLastClickedStratumId(stratumId);
      setLastClickTime(currentTime);
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

// Helper function to calculate distance from point to line segment
function distanceToSegment(p: Point, v1: Point, v2: Point): number {
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // v1 and v2 are the same point
    return Math.sqrt((p.x - v1.x) ** 2 + (p.y - v1.y) ** 2);
  }

  // Calculate projection parameter
  let t = ((p.x - v1.x) * dx + (p.y - v1.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t)); // Clamp to segment

  // Calculate closest point on segment
  const closestX = v1.x + t * dx;
  const closestY = v1.y + t * dy;

  // Return distance
  return Math.sqrt((p.x - closestX) ** 2 + (p.y - closestY) ** 2);
}

// Helper to check if point is inside or on polygon boundary
function isPointInsideOrOnPolygon(point: Point, polygon: Point[]): boolean {
  const n = polygon.length;
  let inside = false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    // Check if point is on edge
    const onEdge = isPointOnSegment(point, polygon[i], polygon[j]);
    if (onEdge) return true;

    // Ray casting algorithm for interior
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

function isPointOnSegment(point: Point, v1: Point, v2: Point): boolean {
  // Check if point is collinear with v1 and v2
  const crossProduct = (v2.y - v1.y) * (point.x - v1.x) - (v2.x - v1.x) * (point.y - v1.y);

  if (Math.abs(crossProduct) > 1e-10) {
    return false; // Not collinear
  }

  // Check if point is between v1 and v2
  const dotProduct = (point.x - v1.x) * (v2.x - v1.x) + (point.y - v1.y) * (v2.y - v1.y);
  const squaredLength = (v2.x - v1.x) * (v2.x - v1.x) + (v2.y - v1.y) * (v2.y - v1.y);

  return dotProduct >= -1e-10 && dotProduct <= squaredLength + 1e-10;
}
