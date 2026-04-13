// PlantingSuggestions constants - extracted to prevent fast refresh issues

export const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

export const seasonMap: Record<number, string[]> = {
  0: ['winter'],
  1: ['winter', 'spring'],
  2: ['spring'],
  3: ['spring'],
  4: ['spring', 'summer'],
  5: ['summer'],
  6: ['summer'],
  7: ['summer', 'autumn'],
  8: ['autumn'],
  9: ['autumn'],
  10: ['autumn', 'winter'],
  11: ['winter'],
};
