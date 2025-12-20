import type { ReactNode } from 'react';

interface ToggleProps {
  isLeft: boolean;
  onToggle: () => void;
  leftIcon: ReactNode;
  rightIcon: ReactNode;
  title: string;
  palette: {
    border: string;
    background: string;
  };
  borderThickness: number;
  borderOpacity: number;
  buttonHeight: number;
}

// Helper to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function Toggle({
  isLeft,
  onToggle,
  leftIcon,
  rightIcon,
  title,
  palette,
  borderThickness,
  borderOpacity,
  buttonHeight
}: ToggleProps) {
  return (
    <div
      onClick={onToggle}
      style={{
        position: 'relative',
        width: '70px',
        height: `${buttonHeight}px`,
        backgroundColor: hexToRgba(palette.border, borderOpacity),
        borderRadius: '16px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        border: `${borderThickness}px solid ${hexToRgba(palette.border, borderOpacity)}`
      }}
      title={title}
    >
      {/* Sliding knob */}
      <div
        style={{
          position: 'absolute',
          top: '2px',
          ...(isLeft ? { left: '2px' } : { right: '2px' }),
          width: '30px',
          height: `${buttonHeight - 8}px`,
          backgroundColor: palette.background,
          borderRadius: `${(buttonHeight - 8) / 2}px`,
          transition: 'all 0.2s ease-in-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isLeft ? leftIcon : rightIcon}
      </div>
    </div>
  );
}
