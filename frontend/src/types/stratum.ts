import type { Point } from '../utils/convexHull';

/**
 * Base interface for all strata in a toric surface.
 * A stratum represents a geometric component of the stratification.
 */
export interface Stratum {
  id: string;                           // Unique identifier for this stratum
  dimension: 0 | 1 | 2;                 // 0 = vertex, 1 = edge, 2 = face

  // Monomial tracking - lattice points associated with this stratum
  vertexMonomials: Set<string>;         // Monomials at vertices (pointKey format)
  edgeMonomials: Set<string>;           // Monomials on edges (not vertices)
  interiorMonomials: Set<string>;       // Monomials strictly inside

  // Containment relationships
  substrata: Set<string>;               // IDs of lower-dimensional strata contained in this one
  superstrata: Set<string>;             // IDs of higher-dimensional strata containing this one
}

/**
 * 0-dimensional stratum (vertex/point)
 */
export interface VertexStratum extends Stratum {
  dimension: 0;
  point: Point;                         // Lattice coordinates of the vertex
}

/**
 * 1-dimensional stratum (edge)
 */
export interface EdgeStratum extends Stratum {
  dimension: 1;
  vertices: [string, string];           // IDs of the two endpoint vertices
  primitiveNormal: Point;               // Primitive normal vector (perpendicular to edge)
}

/**
 * 2-dimensional stratum (face/interior)
 */
export interface FaceStratum extends Stratum {
  dimension: 2;
  hullVertices: string[];               // IDs of vertices on the convex hull (CCW order)
}

/**
 * Type guard for VertexStratum
 */
export function isVertexStratum(stratum: Stratum): stratum is VertexStratum {
  return stratum.dimension === 0;
}

/**
 * Type guard for EdgeStratum
 */
export function isEdgeStratum(stratum: Stratum): stratum is EdgeStratum {
  return stratum.dimension === 1;
}

/**
 * Type guard for FaceStratum
 */
export function isFaceStratum(stratum: Stratum): stratum is FaceStratum {
  return stratum.dimension === 2;
}

/**
 * Central registry for managing all strata and their relationships.
 * Provides efficient lookup and traversal of the stratification.
 */
export class StratumRegistry {
  private vertices: Map<string, VertexStratum> = new Map();
  private edges: Map<string, EdgeStratum> = new Map();
  private faces: Map<string, FaceStratum> = new Map();

  /**
   * Add a vertex stratum to the registry
   */
  addVertex(vertex: VertexStratum): void {
    this.vertices.set(vertex.id, vertex);
  }

  /**
   * Add an edge stratum to the registry
   */
  addEdge(edge: EdgeStratum): void {
    this.edges.set(edge.id, edge);
  }

  /**
   * Add a face stratum to the registry
   */
  addFace(face: FaceStratum): void {
    this.faces.set(face.id, face);
  }

  /**
   * Get a stratum by ID (searches all dimensions)
   */
  getStratum(id: string): Stratum | undefined {
    return this.vertices.get(id) || this.edges.get(id) || this.faces.get(id);
  }

  /**
   * Get a vertex stratum by ID
   */
  getVertex(id: string): VertexStratum | undefined {
    return this.vertices.get(id);
  }

  /**
   * Get an edge stratum by ID
   */
  getEdge(id: string): EdgeStratum | undefined {
    return this.edges.get(id);
  }

  /**
   * Get a face stratum by ID
   */
  getFace(id: string): FaceStratum | undefined {
    return this.faces.get(id);
  }

  /**
   * Get all vertices in the registry
   */
  getAllVertices(): VertexStratum[] {
    return Array.from(this.vertices.values());
  }

  /**
   * Get all edges in the registry
   */
  getAllEdges(): EdgeStratum[] {
    return Array.from(this.edges.values());
  }

  /**
   * Get all faces in the registry
   */
  getAllFaces(): FaceStratum[] {
    return Array.from(this.faces.values());
  }

  /**
   * Get all substrata (lower-dimensional strata) of a given stratum
   */
  getSubstrata(stratumId: string): Stratum[] {
    const stratum = this.getStratum(stratumId);
    if (!stratum) return [];

    return Array.from(stratum.substrata)
      .map(id => this.getStratum(id))
      .filter((s): s is Stratum => s !== undefined);
  }

  /**
   * Get all superstrata (higher-dimensional strata) of a given stratum
   */
  getSuperstrata(stratumId: string): Stratum[] {
    const stratum = this.getStratum(stratumId);
    if (!stratum) return [];

    return Array.from(stratum.superstrata)
      .map(id => this.getStratum(id))
      .filter((s): s is Stratum => s !== undefined);
  }

  /**
   * Get all monomials (of all types) associated with a stratum
   */
  getAllMonomials(stratumId: string): Set<string> {
    const stratum = this.getStratum(stratumId);
    if (!stratum) return new Set();

    return new Set([
      ...stratum.vertexMonomials,
      ...stratum.edgeMonomials,
      ...stratum.interiorMonomials
    ]);
  }

  /**
   * Clear all strata from the registry
   */
  clear(): void {
    this.vertices.clear();
    this.edges.clear();
    this.faces.clear();
  }

  /**
   * Get total count of all strata
   */
  getTotalCount(): number {
    return this.vertices.size + this.edges.size + this.faces.size;
  }

  /**
   * Export to JSON-serializable format
   */
  toJSON(): SerializedStratumRegistry {
    return {
      vertices: Array.from(this.vertices.values()).map(serializeStratum) as SerializedVertexStratum[],
      edges: Array.from(this.edges.values()).map(serializeStratum) as SerializedEdgeStratum[],
      faces: Array.from(this.faces.values()).map(serializeStratum) as SerializedFaceStratum[]
    };
  }

  /**
   * Import from JSON format
   */
  static fromJSON(data: SerializedStratumRegistry): StratumRegistry {
    const registry = new StratumRegistry();

    data.vertices.forEach(v => registry.addVertex(deserializeVertexStratum(v)));
    data.edges.forEach(e => registry.addEdge(deserializeEdgeStratum(e)));
    data.faces.forEach(f => registry.addFace(deserializeFaceStratum(f)));

    return registry;
  }
}

/**
 * JSON-serializable format for StratumRegistry
 */
export interface SerializedStratumRegistry {
  vertices: SerializedVertexStratum[];
  edges: SerializedEdgeStratum[];
  faces: SerializedFaceStratum[];
}

/**
 * JSON-serializable format for strata
 */
interface SerializedStratum {
  id: string;
  dimension: 0 | 1 | 2;
  vertexMonomials: string[];
  edgeMonomials: string[];
  interiorMonomials: string[];
  substrata: string[];
  superstrata: string[];
}

interface SerializedVertexStratum extends SerializedStratum {
  dimension: 0;
  point: Point;
}

interface SerializedEdgeStratum extends SerializedStratum {
  dimension: 1;
  vertices: [string, string];
  primitiveNormal: Point;
}

interface SerializedFaceStratum extends SerializedStratum {
  dimension: 2;
  hullVertices: string[];
}

/**
 * Helper functions for serialization
 */
function serializeStratum(stratum: Stratum): SerializedVertexStratum | SerializedEdgeStratum | SerializedFaceStratum {
  const base = {
    id: stratum.id,
    dimension: stratum.dimension,
    vertexMonomials: Array.from(stratum.vertexMonomials),
    edgeMonomials: Array.from(stratum.edgeMonomials),
    interiorMonomials: Array.from(stratum.interiorMonomials),
    substrata: Array.from(stratum.substrata),
    superstrata: Array.from(stratum.superstrata)
  };

  if (isVertexStratum(stratum)) {
    return { ...base, dimension: 0 as const, point: stratum.point };
  } else if (isEdgeStratum(stratum)) {
    return { ...base, dimension: 1 as const, vertices: stratum.vertices, primitiveNormal: stratum.primitiveNormal };
  } else {
    return { ...base, dimension: 2 as const, hullVertices: (stratum as FaceStratum).hullVertices };
  }
}

function deserializeVertexStratum(data: SerializedVertexStratum): VertexStratum {
  return {
    id: data.id,
    dimension: 0,
    point: data.point,
    vertexMonomials: new Set(data.vertexMonomials),
    edgeMonomials: new Set(data.edgeMonomials),
    interiorMonomials: new Set(data.interiorMonomials),
    substrata: new Set(data.substrata),
    superstrata: new Set(data.superstrata)
  };
}

function deserializeEdgeStratum(data: SerializedEdgeStratum): EdgeStratum {
  return {
    id: data.id,
    dimension: 1,
    vertices: data.vertices,
    primitiveNormal: data.primitiveNormal,
    vertexMonomials: new Set(data.vertexMonomials),
    edgeMonomials: new Set(data.edgeMonomials),
    interiorMonomials: new Set(data.interiorMonomials),
    substrata: new Set(data.substrata),
    superstrata: new Set(data.superstrata)
  };
}

function deserializeFaceStratum(data: SerializedFaceStratum): FaceStratum {
  return {
    id: data.id,
    dimension: 2,
    hullVertices: data.hullVertices,
    vertexMonomials: new Set(data.vertexMonomials),
    edgeMonomials: new Set(data.edgeMonomials),
    interiorMonomials: new Set(data.interiorMonomials),
    substrata: new Set(data.substrata),
    superstrata: new Set(data.superstrata)
  };
}
