import type { Point } from './convexHull';
import { convexHull, edgePointsOfPolygon, isPointInsidePolygon } from './convexHull';
import {
  StratumRegistry,
  type VertexStratum,
  type EdgeStratum,
  type FaceStratum
} from '../types/stratum';

/**
 * Create a unique key for a point (used for monomial tracking)
 */
export function pointKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Parse a point key back into coordinates
 */
export function parsePointKey(key: string): Point {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

/**
 * Create a unique ID for a vertex stratum based on its coordinates
 */
function vertexId(point: Point): string {
  return `v_${pointKey(point.x, point.y)}`;
}

/**
 * Create a unique ID for an edge stratum based on its endpoint vertices
 */
function edgeId(v1: Point, v2: Point): string {
  // Use lexicographic ordering to ensure consistent edge IDs
  const [p1, p2] = v1.x < v2.x || (v1.x === v2.x && v1.y < v2.y) ? [v1, v2] : [v2, v1];
  return `e_${pointKey(p1.x, p1.y)}_${pointKey(p2.x, p2.y)}`;
}

/**
 * Compute the primitive normal vector to an edge (perpendicular, with minimal integer components)
 */
function computePrimitiveNormal(v1: Point, v2: Point): Point {
  // Normal vector to the edge (perpendicular)
  const nx = v2.y - v1.y;
  const ny = -(v2.x - v1.x);

  // Compute GCD to make it primitive
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
  if (g === 0) return { x: 0, y: 0 };

  return {
    x: nx / g,
    y: ny / g
  };
}

/**
 * Create a stratification from a polytope defined by selected points.
 * Computes vertices, edges, face, containment relationships, and populates monomials.
 *
 * @param selectedPoints - Array of points defining the polytope
 * @param visibleLatticePoints - All lattice points currently visible (for monomial classification)
 * @returns StratumRegistry containing the complete stratification
 */
export function createStratificationFromPolytope(
  selectedPoints: Point[],
  visibleLatticePoints: Point[]
): StratumRegistry {
  const registry = new StratumRegistry();

  // Need at least 3 points to form a polytope
  if (selectedPoints.length < 3) {
    return registry;
  }

  // Compute convex hull
  const hull = convexHull(selectedPoints);

  if (hull.length < 3) {
    return registry;
  }

  // Step 1: Create vertex strata
  const vertexStrata: VertexStratum[] = hull.map(point => ({
    id: vertexId(point),
    dimension: 0,
    point,
    vertexMonomials: new Set([pointKey(point.x, point.y)]), // Vertex itself is a monomial
    edgeMonomials: new Set(),
    interiorMonomials: new Set(),
    substrata: new Set(),
    superstrata: new Set()
  }));

  vertexStrata.forEach(v => registry.addVertex(v));

  // Step 2: Create edge strata
  const edgeStrata: EdgeStratum[] = [];

  for (let i = 0; i < hull.length; i++) {
    const v1 = hull[i];
    const v2 = hull[(i + 1) % hull.length];

    const edge: EdgeStratum = {
      id: edgeId(v1, v2),
      dimension: 1,
      vertices: [vertexId(v1), vertexId(v2)],
      primitiveNormal: computePrimitiveNormal(v1, v2),
      vertexMonomials: new Set([pointKey(v1.x, v1.y), pointKey(v2.x, v2.y)]),
      edgeMonomials: new Set(),
      interiorMonomials: new Set(),
      substrata: new Set(),
      superstrata: new Set()
    };

    // Add containment: edge contains its two vertices
    edge.substrata.add(vertexId(v1));
    edge.substrata.add(vertexId(v2));

    // Add reverse containment: vertices are contained in this edge
    const vertex1 = registry.getVertex(vertexId(v1));
    const vertex2 = registry.getVertex(vertexId(v2));
    if (vertex1) vertex1.superstrata.add(edge.id);
    if (vertex2) vertex2.superstrata.add(edge.id);

    edgeStrata.push(edge);
    registry.addEdge(edge);
  }

  // Step 3: Compute edge monomials (lattice points on edges, excluding vertices)
  const edgeMonomialPoints = edgePointsOfPolygon(hull);

  edgeMonomialPoints.forEach(point => {
    const key = pointKey(point.x, point.y);

    // Find which edge this point lies on
    for (let i = 0; i < hull.length; i++) {
      const v1 = hull[i];
      const v2 = hull[(i + 1) % hull.length];

      if (isPointOnSegment(point, v1, v2)) {
        const edge = registry.getEdge(edgeId(v1, v2));
        if (edge) {
          edge.edgeMonomials.add(key);
        }
        break;
      }
    }
  });

  // Step 4: Create face stratum (the 2D interior)
  const face: FaceStratum = {
    id: 'f_0',
    dimension: 2,
    hullVertices: hull.map(p => vertexId(p)),
    vertexMonomials: new Set(hull.map(p => pointKey(p.x, p.y))),
    edgeMonomials: new Set(edgeMonomialPoints.map(p => pointKey(p.x, p.y))),
    interiorMonomials: new Set(),
    substrata: new Set(),
    superstrata: new Set()
  };

  // Face contains all edges
  edgeStrata.forEach(edge => {
    face.substrata.add(edge.id);
    edge.superstrata.add(face.id);
  });

  // Face contains all vertices (indirectly via edges, but also directly)
  vertexStrata.forEach(vertex => {
    vertex.superstrata.add(face.id);
  });

  registry.addFace(face);

  // Step 5: Compute interior monomials
  visibleLatticePoints.forEach(point => {
    if (isPointInsidePolygon(point, hull)) {
      const key = pointKey(point.x, point.y);
      face.interiorMonomials.add(key);
    }
  });

  return registry;
}

/**
 * Helper function to check if a point lies on a line segment
 */
function isPointOnSegment(point: Point, v1: Point, v2: Point): boolean {
  // Check if point is collinear with v1 and v2
  const crossProduct = (v2.y - v1.y) * (point.x - v1.x) - (v2.x - v1.x) * (point.y - v1.y);

  if (Math.abs(crossProduct) > 1e-10) {
    return false; // Not collinear
  }

  // Check if point is between v1 and v2
  const dotProduct = (point.x - v1.x) * (v2.x - v1.x) + (point.y - v1.y) * (v2.y - v1.y);
  const squaredLength = (v2.x - v1.x) * (v2.x - v1.x) + (v2.y - v1.y) * (v2.y - v1.y);

  return dotProduct >= 0 && dotProduct <= squaredLength;
}

/**
 * Get all lattice points in a given region (for monomial enumeration)
 * This is a helper for generating visible lattice points.
 */
export function enumerateLatticePoints(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): Point[] {
  const points: Point[] = [];

  for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      points.push({ x, y });
    }
  }

  return points;
}

/**
 * Update monomial classifications when the visible region changes.
 * This is useful when zooming/panning to update interior monomials.
 */
export function updateMonomials(
  registry: StratumRegistry,
  visibleLatticePoints: Point[]
): void {
  const faces = registry.getAllFaces();

  if (faces.length === 0) return;

  // For each face, recompute interior monomials
  faces.forEach(face => {
    // Get hull vertices as Points
    const hullPoints = face.hullVertices
      .map(id => registry.getVertex(id))
      .filter((v): v is VertexStratum => v !== undefined)
      .map(v => v.point);

    // Clear and recompute interior monomials
    face.interiorMonomials.clear();

    visibleLatticePoints.forEach(point => {
      if (isPointInsidePolygon(point, hullPoints)) {
        face.interiorMonomials.add(pointKey(point.x, point.y));
      }
    });
  });
}
