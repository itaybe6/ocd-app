export const colors = {
  bg: '#F6F7FB',
  elevated: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E5E7EB',
  text: '#0F172A',
  muted: '#64748B',
  primary: '#2563EB',
  /** Dark navy — `AdminHeader`, dashboard hero, matching chrome */
  adminHeader: '#0B2540',
  adminHeaderBorderSoft: 'rgba(11, 37, 64, 0.10)',
  adminHeaderIconSoft: 'rgba(11, 37, 64, 0.10)',
  adminHeaderAccentSoft: 'rgba(11, 37, 64, 0.16)',
  adminHeaderBarTrack: 'rgba(11, 37, 64, 0.12)',
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#F59E0B',
} as const;

export type AppColors = typeof colors;

