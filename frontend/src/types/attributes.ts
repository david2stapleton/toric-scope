export interface BaseAttribute {
  count: number;
  descr: string;
}

export interface VerticesAttribute extends BaseAttribute {
  // Methods will be handled by action system, not actually callable
  cycle?(rate?: number): void;
}

export interface EdgesAttribute extends BaseAttribute {
  cycle?(rate?: number): void;
  highlight?(): void;
}

export interface PolytopeAttributes {
  vertices: VerticesAttribute;
  edges: EdgesAttribute;
  faces: BaseAttribute;
  points: BaseAttribute;
  interior: BaseAttribute;
  boundary: BaseAttribute;
  strata: BaseAttribute;
  [key: string]: BaseAttribute | VerticesAttribute | EdgesAttribute;
}

/**
 * Helper function to generate description with proper singular/plural
 */
function getDescr(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Build polytope attribute objects from raw count statistics
 */
export function buildPolytopeAttributes(
  stats: Record<string, number>
): PolytopeAttributes {
  const strataCount = 1 + (stats.vertices || 0) + (stats.edges || 0) + (stats.faces || 0);

  return {
    vertices: {
      count: stats.vertices || 0,
      descr: getDescr(stats.vertices || 0, 'vertex', 'vertices')
    },
    edges: {
      count: stats.edges || 0,
      descr: getDescr(stats.edges || 0, 'edge', 'edges')
    },
    faces: {
      count: stats.faces || 0,
      descr: getDescr(stats.faces || 0, 'face', 'faces')
    },
    points: {
      count: stats.points || 0,
      descr: getDescr(stats.points || 0, 'point', 'points')
    },
    interior: {
      count: stats.interior || 0,
      descr: getDescr(stats.interior || 0, 'interior point', 'interior points')
    },
    boundary: {
      count: stats.boundary || 0,
      descr: getDescr(stats.boundary || 0, 'boundary point', 'boundary points')
    },
    strata: {
      count: strataCount,
      descr: getDescr(strataCount, 'stratum', 'strata')
    }
  };
}
