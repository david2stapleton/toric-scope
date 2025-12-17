import type { Point } from './convexHull';

export interface PolytopeExportData {
  name: string;
  hullVertices: Point[];  // Convex hull in CCW order
  latticeType: 'square' | 'hexagonal';
  allPoints?: Point[];     // Optional: all selected points
}

export interface LatexExportOptions {
  fillColor: string;
  strokeColor: string;
  pointColor: string;
  lineThickness: number;
  latticePointSize: number;
  hullVertexSize: number;
  scale: number;
}

// Helper to convert color to TikZ RGB definition
// Handles both #RRGGBB hex and rgba(r, g, b, a) formats
function hexToTikzRGB(color: string, colorName: string): string {
  // Handle rgba(r, g, b, a) format
  if (color.startsWith('rgba') || color.startsWith('rgb')) {
    // Extract RGB values - match both "rgba(255, 107, 53, 0.15)" and "rgb(255,107,53)"
    const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1]) / 255;
      const g = parseInt(match[2]) / 255;
      const b = parseInt(match[3]) / 255;
      return `\\definecolor{${colorName}}{rgb}{${r.toFixed(3)},${g.toFixed(3)},${b.toFixed(3)}}`;
    }
  }

  // Handle #RRGGBB format
  const cleanHex = color.startsWith('#') ? color : '#' + color;
  const r = parseInt(cleanHex.slice(1, 3), 16) / 255;
  const g = parseInt(cleanHex.slice(3, 5), 16) / 255;
  const b = parseInt(cleanHex.slice(5, 7), 16) / 255;

  // Validate the conversion
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    console.error(`Invalid color format: ${color}`);
    return `\\definecolor{${colorName}}{rgb}{0.000,0.000,0.000}`; // Fallback to black
  }

  return `\\definecolor{${colorName}}{rgb}{${r.toFixed(3)},${g.toFixed(3)},${b.toFixed(3)}}`;
}

export function generateTikZCode(data: PolytopeExportData, options?: LatexExportOptions): string {
  const { hullVertices } = data;

  // Default options
  const opts = options || {
    fillColor: '#4169E1',  // Default to blue hex
    strokeColor: '#0000FF',
    pointColor: '#000000',
    lineThickness: 1.5,
    latticePointSize: 1,
    hullVertexSize: 2,
    scale: 0.8
  };

  // Calculate bounding box for lattice grid
  const minX = Math.min(...hullVertices.map(p => p.x)) - 1;
  const maxX = Math.max(...hullVertices.map(p => p.x)) + 1;
  const minY = Math.min(...hullVertices.map(p => p.y)) - 1;
  const maxY = Math.max(...hullVertices.map(p => p.y)) + 1;

  let tikz = `\\documentclass[border=5pt]{standalone}\n`;
  tikz += `\\usepackage{tikz}\n`;
  tikz += `\\usepackage{xcolor}\n\n`;

  // Define colors from hex values
  tikz += `% Color definitions\n`;
  tikz += `${hexToTikzRGB(opts.fillColor, 'fillcolor')}\n`;
  tikz += `${hexToTikzRGB(opts.strokeColor, 'strokecolor')}\n`;
  tikz += `${hexToTikzRGB(opts.pointColor, 'pointcolor')}\n\n`;

  tikz += `% Customizable parameters\n`;
  tikz += `\\def\\PolytopeScale{${opts.scale}}\n`;
  tikz += `\\def\\FillColor{fillcolor}\n`;
  tikz += `\\def\\StrokeColor{strokecolor}\n`;
  tikz += `\\def\\PointColor{pointcolor}\n`;
  tikz += `\\def\\EdgeThickness{${opts.lineThickness}pt}\n`;
  tikz += `\\def\\LatticePointSize{${opts.latticePointSize}pt}\n`;
  tikz += `\\def\\HullVertexSize{${opts.hullVertexSize}pt}\n\n`;
  tikz += `\\begin{document}\n`;
  tikz += `\\begin{tikzpicture}[scale=\\PolytopeScale]\n\n`;

  // Draw lattice points using foreach loop
  tikz += `  % Lattice points\n`;
  tikz += `  \\foreach \\x in {${minX},...,${maxX}} {\n`;
  tikz += `    \\foreach \\y in {${minY},...,${maxY}} {\n`;
  tikz += `      \\fill[\\PointColor] (\\x,\\y) circle (\\LatticePointSize);\n`;
  tikz += `    }\n`;
  tikz += `  }\n\n`;

  // Draw filled polytope region
  tikz += `  % Filled polytope\n`;
  tikz += `  \\fill[\\FillColor,opacity=0.5] `;
  hullVertices.forEach((p, i) => {
    tikz += i === 0 ? `(${p.x},${p.y})` : ` -- (${p.x},${p.y})`;
  });
  tikz += ` -- cycle;\n\n`;

  // Draw polytope edges
  tikz += `  % Polytope edges\n`;
  tikz += `  \\draw[line width=\\EdgeThickness,\\StrokeColor] `;
  hullVertices.forEach((p, i) => {
    tikz += i === 0 ? `(${p.x},${p.y})` : ` -- (${p.x},${p.y})`;
  });
  tikz += ` -- cycle;\n\n`;

  // Draw hull vertices
  tikz += `  % Hull vertices\n`;
  hullVertices.forEach(p => {
    tikz += `  \\fill[\\StrokeColor] (${p.x},${p.y}) circle (\\HullVertexSize);\n`;
  });
  tikz += `\n`;

  tikz += `\\end{tikzpicture}\n`;
  tikz += `\\end{document}\n`;

  return tikz;
}

export function downloadTexFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
