export interface Point {
  x: number;
  y: number;
}

/**
 * Compute the cross product of vectors OA and OB
 * Returns positive if counterclockwise turn, negative if clockwise
 */
function crossProduct(O: Point, A: Point, B: Point): number {
  return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

/**
 * Compute the polar angle of point p with respect to anchor point
 */
function polarAngle(anchor: Point, p: Point): number {
  return Math.atan2(p.y - anchor.y, p.x - anchor.x);
}

/**
 * Compute the Euclidean distance between two points
 */
function distance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute the convex hull of a set of points using Graham's scan algorithm
 * Returns points in counter-clockwise order
 */
export function convexHull(points: Point[]): Point[] {
  if (points.length < 3) {
    return points;
  }

  // Find the point with the lowest y-coordinate (ties broken by x-coordinate)
  let anchor = points[0];
  for (const point of points) {
    if (point.y < anchor.y || (point.y === anchor.y && point.x < anchor.x)) {
      anchor = point;
    }
  }

  // Sort points by polar angle with respect to anchor
  // If angles are equal, sort by distance
  const sorted = points
    .filter(p => p !== anchor)
    .sort((a, b) => {
      const angleA = polarAngle(anchor, a);
      const angleB = polarAngle(anchor, b);

      if (Math.abs(angleA - angleB) < 1e-10) {
        // Same angle, sort by distance
        return distance(anchor, a) - distance(anchor, b);
      }
      return angleA - angleB;
    });

  // Graham scan
  const hull: Point[] = [anchor];

  for (const point of sorted) {
    // Remove points that make clockwise turn
    while (hull.length >= 2) {
      const top = hull[hull.length - 1];
      const secondTop = hull[hull.length - 2];

      if (crossProduct(secondTop, top, point) <= 0) {
        hull.pop();
      } else {
        break;
      }
    }
    hull.push(point);
  }

  return hull;
}

/**
 * Check if a point is strictly inside a convex polygon (not on boundary)
 * Uses the cross product method - point is inside if it's on the same side of all edges
 * Assumes polygon vertices are in counter-clockwise order (as returned by convexHull)
 */
export function isPointInsidePolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;

  // For a convex polygon in counter-clockwise order,
  // a point is inside if all cross products are positive
  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];

    const cross = crossProduct(current, next, point);

    // If cross product is <= 0, point is outside or on boundary
    if (cross <= 0) {
      return false;
    }
  }

  return true;
}

/**
 * Find all integer lattice points on the line segment from p1 to p2 (excluding endpoints)
 * Uses a parametric approach to find all lattice points
 */
function latticePointsOnSegment(p1: Point, p2: Point): Point[] {
  const points: Point[] = [];

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  // Calculate GCD to find the step size
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

  const g = gcd(dx, dy);
  if (g === 0) return points; // Same point

  const stepX = dx / g;
  const stepY = dy / g;

  // Generate all intermediate lattice points (excluding endpoints)
  for (let i = 1; i < g; i++) {
    points.push({
      x: p1.x + i * stepX,
      y: p1.y + i * stepY
    });
  }

  return points;
}

/**
 * Find all integer lattice points on the edges of a polygon (excluding vertices)
 */
export function edgePointsOfPolygon(polygon: Point[]): Point[] {
  if (polygon.length < 2) return [];

  const edgePoints: Point[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];

    const points = latticePointsOnSegment(current, next);
    edgePoints.push(...points);
  }

  return edgePoints;
}
