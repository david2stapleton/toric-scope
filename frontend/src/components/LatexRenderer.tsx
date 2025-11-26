import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  content: string;
  textColor: string;
}

interface TextSegment {
  type: 'text' | 'inline-math' | 'block-math';
  content: string;
}

function parseLatex(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentPos = 0;

  // Match both $...$ (inline) and $$...$$ (block)
  const mathPattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

  let match;
  while ((match = mathPattern.exec(text)) !== null) {
    // Add text before the math
    if (match.index > currentPos) {
      segments.push({
        type: 'text',
        content: text.slice(currentPos, match.index)
      });
    }

    // Add the math segment
    const mathContent = match[0];
    if (mathContent.startsWith('$$') && mathContent.endsWith('$$')) {
      // Block math
      segments.push({
        type: 'block-math',
        content: mathContent.slice(2, -2)
      });
    } else {
      // Inline math
      segments.push({
        type: 'inline-math',
        content: mathContent.slice(1, -1)
      });
    }

    currentPos = match.index + mathContent.length;
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

export default function LatexRenderer({ content, textColor }: LatexRendererProps) {
  const segments = parseLatex(content);

  return (
    <div style={{
      color: textColor,
      fontSize: '14px',
      lineHeight: '1.8',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word'
    }}>
      {segments.map((segment, index) => {
        if (segment.type === 'inline-math') {
          return (
            <span key={index}>
              <InlineMath math={segment.content} />
            </span>
          );
        } else if (segment.type === 'block-math') {
          return (
            <div key={index} style={{ margin: '10px 0' }}>
              <BlockMath math={segment.content} />
            </div>
          );
        } else {
          return <span key={index}>{segment.content}</span>;
        }
      })}
    </div>
  );
}
