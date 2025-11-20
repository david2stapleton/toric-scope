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
