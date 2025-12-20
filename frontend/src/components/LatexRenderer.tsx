import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { ColorPalette } from '../App';
import type { PolytopeAttributes } from '../types/attributes';

// Global KaTeX macros for mathematical notation
const katexMacros = {
  "\\RR": "\\mathbb{R}",
  "\\ZZ": "\\mathbb{Z}",
  "\\NN": "\\mathbb{N}",
  "\\QQ": "\\mathbb{Q}",
  "\\CC": "\\mathbb{C}",
  "\\AA": "\\mathbb{A}",
  "\\TT": "\\mathbb{T}",
  "\\GG": "\\mathbb{G}",
  "\\PP": "\\mathbb{P}",
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
  polytopeStats?: PolytopeAttributes;
}

interface TextSegment {
  type: 'text' | 'inline-math' | 'block-math' | 'polytope-link' | 'polytope-fact' | 'italic' | 'bold' | 'title';
  content: string;
  polytopeName?: string;
  mode?: string;
  displayText?: string;
  // New 3-part structure for polytope facts
  attribute?: string | null;
  attributeIndex?: number | null;
  description?: string | null;
  action?: string | null;
  // Legacy fields (kept for backwards compatibility during migration)
  factKey?: string;
}

function parseLatex(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentPos = 0;

  // Match $...$ (inline), $$...$$ (block), [[...]] (polytope links), {{...}} (polytope facts), [i]...[/i], [b]...[/b], and [title]...[/title]
  const pattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\[\[([^\]]+)\]\]|\{\{([^}]+)\}\}|\[i\]([\s\S]*?)\[\/i\]|\[b\]([\s\S]*?)\[\/b\]|\[title\]([\s\S]*?)\[\/title\])/g;

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
    if (matchContent.startsWith('[i]') && matchContent.endsWith('[/i]')) {
      // Italic text
      segments.push({
        type: 'italic',
        content: match[4] // Captured group 4 contains text inside [i]...[/i]
      });
    } else if (matchContent.startsWith('[b]') && matchContent.endsWith('[/b]')) {
      // Bold text
      segments.push({
        type: 'bold',
        content: match[5] // Captured group 5 contains text inside [b]...[/b]
      });
    } else if (matchContent.startsWith('[title]') && matchContent.endsWith('[/title]')) {
      // Title text (centered, bold, italic)
      segments.push({
        type: 'title',
        content: match[6] // Captured group 6 contains text inside [title]...[/title]
      });
    } else if (matchContent.startsWith('{{') && matchContent.endsWith('}}')) {
      // Polytope fact - new syntax: {{attribute|description|action}}
      const factContent = match[3].trim(); // Everything inside {{...}}

      // Split by | to get up to 3 parts
      const parts = factContent.split('|').map(s => s.trim());

      // Validate: can't skip middle slot (||action is invalid)
      // But {{|description}} and {{|description|action}} are valid global actions
      if (parts.length >= 3 && parts[0] === '' && parts[1] === '' && parts[2] !== '') {
        console.error('Invalid syntax: cannot skip attribute and description slots:', matchContent);
        // Skip this segment
        currentPos = match.index + matchContent.length;
        continue;
      }

      const attributeRaw = parts[0] || null;  // Can be empty for global actions
      const description = parts[1] || null;
      const action = parts[2] || null;

      // Parse index from attribute like "vertices[0]"
      let attribute = attributeRaw;
      let attributeIndex: number | null = null;

      if (attributeRaw && attributeRaw.includes('[')) {
        const indexMatch = attributeRaw.match(/^(\w+)\[(\d+)\]$/);
        if (indexMatch) {
          attribute = indexMatch[1];  // "vertices"
          attributeIndex = parseInt(indexMatch[2], 10);  // 0
        }
      }

      segments.push({
        type: 'polytope-fact',
        content: matchContent,
        attribute,
        attributeIndex,
        description,
        action
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

export default function LatexRenderer({ content, textColor, palette, polytopeStats }: LatexRendererProps) {
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

  // New evaluation function for 3-part attribute syntax
  const evaluateAttribute = (
    attribute: string | null,
    description: string | null,
    stats: PolytopeAttributes | undefined
  ): string => {
    // Handle global actions (no attribute) - these don't need stats
    if (!attribute && description) {
      // Return literal description for global actions
      // Strip quotes if present
      return description.replace(/^["'](.*)["']$/, '$1');
    }

    // Handle empty/null attribute and description
    if (!attribute) return '';

    // Handle missing stats (only needed for attribute-based access)
    if (!stats) return '?';

    // Property access: vertices.count
    if (attribute.includes('.')) {
      const [attrName, propName] = attribute.split('.');
      const attrObj = stats[attrName as keyof PolytopeAttributes];
      if (!attrObj) return '?';
      const value = (attrObj as any)[propName];
      return String(value ?? '?');
    }

    // Get attribute object
    const attrObj = stats[attribute as keyof PolytopeAttributes];
    if (!attrObj) return '?';

    // No description: use default (descr property)
    if (!description) {
      return attrObj.descr;
    }

    // Description is property name: vertices|count
    if (description in attrObj) {
      return String((attrObj as any)[description]);
    }

    // Description is keyword: vertices|descr
    if (description === 'descr') {
      return attrObj.descr;
    }

    // Description is literal string: "click here"
    if (description.startsWith('"') && description.endsWith('"')) {
      return description.slice(1, -1);
    }
    if (description.startsWith("'") && description.endsWith("'")) {
      return description.slice(1, -1);
    }

    // Fallback: return description as-is
    return description;
  };

  const handlePolytopeFactClick = (
    attribute: string | null,
    attributeIndex: number | null,
    action: string | null
  ) => {
    if (!action) return;

    // Parse action for parameters: "blink:200" -> action="blink", params=[200]
    const [actionType, ...paramParts] = action.split(':');
    const params = paramParts.map(p => {
      const num = parseInt(p, 10);
      return isNaN(num) ? p : num;
    });

    // Dispatch event to App with the fact that was clicked
    const event = new CustomEvent('polytopeFactClicked', {
      detail: {
        attribute,           // e.g., "vertices"
        attributeIndex,      // e.g., 0
        action: actionType,  // e.g., "blink" or "select"
        params               // e.g., [200]
      }
    });
    window.dispatchEvent(event);
  }


  const renderSegments = (segments: TextSegment[]) => {
    return segments.map((segment, index) => {
      if (segment.type === 'italic') {
        return <em key={index}>{segment.content}</em>;
      } else if (segment.type === 'bold') {
        return <strong key={index}>{segment.content}</strong>;
      } else if (segment.type === 'title') {
        return (
          <div key={index} style={{ textAlign: 'center', display: 'block', margin: '1.5em 0 1.5em 0' }}>
            <strong><em>{segment.content}</em></strong>
          </div>
        );
      } else if (segment.type === 'polytope-fact') {
        // Use new evaluateAttribute for 3-part syntax
        const value = evaluateAttribute(
          segment.attribute || null,
          segment.description || null,
          polytopeStats
        );
        const hasAction = !!segment.action;

        return (
          <span
            key={index}
            onClick={hasAction ? () => handlePolytopeFactClick(segment.attribute || null, segment.attributeIndex ?? null, segment.action!) : undefined}
            style={{
              fontWeight: '600',
              cursor: hasAction ? 'pointer' : 'default',
              color: palette.selectedPoints
            }}>
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
          <span key={index} style={{ display: 'block', margin: '0.5em 0' }}>
            <Math math={segment.content} displayMode={true} />
          </span>
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
    <>
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
            margin: '0 0 0.5em 0',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            textAlign: paragraph.centered ? 'center' : 'left'
          }}>
            {renderSegments(segments)}
          </p>
        );
      })}
      </div>
    </>
  );
}
