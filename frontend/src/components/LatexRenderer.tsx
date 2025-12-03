import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import type { ColorPalette } from '../App';

interface LatexRendererProps {
  content: string;
  textColor: string;
  palette: ColorPalette;
}

interface TextSegment {
  type: 'text' | 'inline-math' | 'block-math' | 'polytope-link';
  content: string;
  polytopeName?: string;
  mode?: string;
  displayText?: string;
}

function parseLatex(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentPos = 0;

  // Match both $...$ (inline), $$...$$ (block), and [[...]] (polytope links)
  const pattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\[\[([^\]]+)\]\])/g;

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
    if (matchContent.startsWith('[[') && matchContent.endsWith(']]')) {
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

export default function LatexRenderer({ content, textColor, palette }: LatexRendererProps) {
  // Split content into paragraphs
  const paragraphs = content.split('\n\n').filter(p => p.trim());

  const handlePolytopeClick = (name: string, mode: string) => {
    // Dispatch event to load the polytope with mode
    const event = new CustomEvent('loadPolytopeFromLink', {
      detail: { name, mode }
    });
    window.dispatchEvent(event);
  };

  const renderSegments = (segments: TextSegment[]) => {
    return segments.map((segment, index) => {
      if (segment.type === 'inline-math') {
        return (
          <span key={index}>
            <InlineMath math={segment.content} />
          </span>
        );
      } else if (segment.type === 'block-math') {
        return (
          <div key={index} style={{ margin: '0.5em 0' }}>
            <BlockMath math={segment.content} />
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
        const segments = parseLatex(paragraph);
        return (
          <p key={pIndex} style={{
            margin: '0 0 0.75em 0',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}>
            {renderSegments(segments)}
          </p>
        );
      })}
    </div>
  );
}
