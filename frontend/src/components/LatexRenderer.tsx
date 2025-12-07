import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { ColorPalette } from '../App';

// Global KaTeX macros for mathematical notation
const katexMacros = {
  "\\RR": "\\mathbb{R}",
  "\\ZZ": "\\mathbb{Z}",
  "\\NN": "\\mathbb{N}",
  "\\QQ": "\\mathbb{Q}",
  "\\CC": "\\mathbb{C}",
};

// Custom Math component using KaTeX directly
function Math({ math, displayMode }: { math: string; displayMode: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(math, ref.current, {
          displayMode,
          throwOnError: false,
          macros: katexMacros,
          strict: false
        });
      } catch (error) {
        console.error('KaTeX rendering error:', error);
      }
    }
  }, [math, displayMode]);

  return <span ref={ref} />;
}

interface LatexRendererProps {
  content: string;
  textColor: string;
  palette: ColorPalette;
  polytopeStats?: Record<string, string | number>;
}

interface TextSegment {
  type: 'text' | 'inline-math' | 'block-math' | 'polytope-link' | 'polytope-fact';
  content: string;
  polytopeName?: string;
  mode?: string;
  displayText?: string;
  factKey?: string;
}

function parseLatex(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentPos = 0;

  // Match $...$ (inline), $$...$$ (block), [[...]] (polytope links), and {{...}} (polytope facts)
  const pattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\[\[([^\]]+)\]\]|\{\{([^}]+)\}\})/g;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > currentPos) {
      segments.push({
        type: 'text',
        content: text.slice(currentPos, match.index)
      });
    }

    // Add the matched segment
    const matchContent = match[0];
    if (matchContent.startsWith('{{') && matchContent.endsWith('}}')) {
      // Polytope fact - {{property}}
      const factKey = match[3].trim(); // Captured group contains the property name
      segments.push({
        type: 'polytope-fact',
        content: matchContent,
        factKey
      });
    } else if (matchContent.startsWith('[[') && matchContent.endsWith(']]')) {
      // Polytope link - parse [[name:mode|display_text]]
      const linkContent = match[2]; // Captured group contains everything inside [[...]]

      // Split by | to separate display text
      const [nameAndMode, displayText] = linkContent.split('|').map(s => s.trim());

      // Split by : to separate name and mode
      const [polytopeName, mode] = nameAndMode.split(':').map(s => s.trim());

      segments.push({
        type: 'polytope-link',
        content: linkContent,
        polytopeName,
        mode: mode || 'polytopes', // Default to polytopes if no mode specified
        displayText: displayText || polytopeName // Use polytope name if no display text
      });
    } else if (matchContent.startsWith('$$') && matchContent.endsWith('$$')) {
      // Block math
      segments.push({
        type: 'block-math',
        content: matchContent.slice(2, -2)
      });
    } else {
      // Inline math
      segments.push({
        type: 'inline-math',
        content: matchContent.slice(1, -1)
      });
    }

    currentPos = match.index + matchContent.length;
  }

  // Add remaining text
  if (currentPos < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(currentPos)
    });
  }

  return segments;
}

export default function LatexRenderer({ content, textColor, palette, polytopeStats = {} }: LatexRendererProps) {
  // Process content to handle [center] blocks
  const processParagraphs = (text: string): Array<{ content: string; centered: boolean }> => {
    const results: Array<{ content: string; centered: boolean }> = [];

    // Split by [center]...[/center] blocks
    const centerPattern = /\[center\]([\s\S]*?)\[\/center\]/g;
    let lastIndex = 0;
    let match;

    while ((match = centerPattern.exec(text)) !== null) {
      // Add non-centered content before this block
      if (match.index > lastIndex) {
        const beforeContent = text.slice(lastIndex, match.index);
        beforeContent.split('\n\n').filter(p => p.trim()).forEach(p => {
          results.push({ content: p, centered: false });
        });
      }

      // Add centered content
      const centeredContent = match[1].trim();
      centeredContent.split('\n\n').filter(p => p.trim()).forEach(p => {
        results.push({ content: p, centered: true });
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining non-centered content
    if (lastIndex < text.length) {
      const remainingContent = text.slice(lastIndex);
      remainingContent.split('\n\n').filter(p => p.trim()).forEach(p => {
        results.push({ content: p, centered: false });
      });
    }

    return results;
  };

  const paragraphs = processParagraphs(content);

  const handlePolytopeClick = (name: string, mode: string) => {
    // Dispatch event to load the polytope with mode
    const event = new CustomEvent('loadPolytopeFromLink', {
      detail: { name, mode }
    });
    window.dispatchEvent(event);
  };

  const getDescription = (property: string): string => {
    const descriptions: Record<string, [string, string]> = {
      vertices: ['vertex', 'vertices'],
      edges: ['edge', 'edges'],
      points: ['point', 'points'],
      faces: ['face', 'faces'],
      interior: ['interior point', 'interior points'],
      boundary: ['boundary point', 'boundary points']
    };

    const value = polytopeStats[property];
    if (value === undefined) return '?';

    const [singular, plural] = descriptions[property] || [property, property + 's'];
    const word = value === 1 ? singular : plural;
    return `${value} ${word}`;
  };

  const evaluateExpression = (expr: string): string | number => {
    try {
      // Check if this is a description request (property|descr)
      if (expr.includes('|descr')) {
        const property = expr.split('|')[0].trim();
        return getDescription(property);
      }

      // Replace variable names with their values
      let evaluatedExpr = expr;
      for (const [key, value] of Object.entries(polytopeStats)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        evaluatedExpr = evaluatedExpr.replace(regex, String(value));
      }

      // Safely evaluate the expression using Function constructor
      // Only allow basic math operations
      const result = new Function(`return ${evaluatedExpr}`)();

      // Round to reasonable precision if it's a number
      if (typeof result === 'number') {
        return Number.isInteger(result) ? result : Number(result.toFixed(6));
      }
      return result;
    } catch (error) {
      console.error('Error evaluating expression:', expr, error);
      return '?';
    }
  };

  const renderSegments = (segments: TextSegment[]) => {
    return segments.map((segment, index) => {
      if (segment.type === 'polytope-fact') {
        // Evaluate the expression (could be simple variable or math expression)
        const value = evaluateExpression(segment.factKey!);
        return (
          <span key={index} style={{ fontWeight: '600', color: palette.selectedPoints }}>
            {value}
          </span>
        );
      } else if (segment.type === 'inline-math') {
        return (
          <span key={index}>
            <Math math={segment.content} displayMode={false} />
          </span>
        );
      } else if (segment.type === 'block-math') {
        return (
          <div key={index} style={{ margin: '0.5em 0' }}>
            <Math math={segment.content} displayMode={true} />
          </div>
        );
      } else if (segment.type === 'polytope-link') {
        return (
          <span
            key={index}
            onClick={() => handlePolytopeClick(segment.polytopeName!, segment.mode!)}
            style={{
              color: palette.selectedPoints,
              cursor: 'pointer',
              fontWeight: '600'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = palette.hullStroke;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = palette.selectedPoints;
            }}
          >
            [{segment.displayText}]
          </span>
        );
      } else {
        return <span key={index}>{segment.content}</span>;
      }
    });
  };

  return (
    <div style={{
      color: textColor,
      fontSize: '18px',
      lineHeight: '1.2',
      textAlign: 'left'
    }}>
      {paragraphs.map((paragraph, pIndex) => {
        const segments = parseLatex(paragraph.content);
        return (
          <p key={pIndex} style={{
            margin: '0 0 0.75em 0',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            textAlign: paragraph.centered ? 'center' : 'left'
          }}>
            {renderSegments(segments)}
          </p>
        );
      })}
    </div>
  );
}
