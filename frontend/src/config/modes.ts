export type Mode = 'polytopes' | 'multiplicities' | 'rings' | 'projectivity' | 'fans';

export interface ModeConfig {
  id: Mode;
  label: string;
  /** If true, only show in development mode */
  devOnly: boolean;
}

/**
 * Mode configuration
 *
 * To change which modes are visible in production, set devOnly to false.
 * Modes with devOnly=true will only appear when running `npm run dev`
 */
export const MODES: ModeConfig[] = [
  {
    id: 'polytopes',
    label: 'Polytopes',
    devOnly: false  // Always visible
  },
  {
    id: 'rings',
    label: 'Rings',
    devOnly: false  // Always visible
  },
  {
    id: 'projectivity',
    label: 'Projectivity',
    devOnly: true   // Dev only - set to false when ready for production
  },
  {
    id: 'fans',
    label: 'Fans',
    devOnly: true   // Dev only - set to false when ready for production
  },
  {
    id: 'multiplicities',
    label: 'Multiplicities',
    devOnly: true   // Dev only - set to false when ready for production
  }
];

/**
 * Get modes available in current environment
 */
export function getAvailableModes(): ModeConfig[] {
  const isDev = import.meta.env.DEV;
  return MODES.filter(mode => !mode.devOnly || isDev);
}

/**
 * Get default mode for current environment
 */
export function getDefaultMode(): Mode {
  const available = getAvailableModes();
  return available.length > 0 ? available[0].id : 'polytopes';
}
