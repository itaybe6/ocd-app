import React from 'react';
import { Armchair, BrushCleaning, Gift, Grid2X2, House, SprayCan, WashingMachine, type LucideIcon } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { storeAccent } from '../theme/storeAccent';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'חומרי-ניקיון': SprayCan,
  'מרככי-כביסה-וטקסטיל': WashingMachine,
  'אביזרי-נקיון': BrushCleaning,
  'אביזרי-ניקיון': BrushCleaning,
  'עיצוב-הבית': Armchair,
  'מבצעי-פסח': Gift,
  'מארזי-ניקיון-משתלמים-copy': House,
};

export function HomeCategoryIcon({ id, title }: { id: string; title: string }) {
  const knownCategory = Object.prototype.hasOwnProperty.call(CATEGORY_ICONS, id);
  if (id === 'בישום-חללים' || (!knownCategory && /בישום|ריח/.test(title))) {
    return <Svg width={27} height={27} viewBox="0 0 24 24" fill="none" stroke={storeAccent.ink} strokeWidth={1.45} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
      <Path d="M10 11 6 2M12 11V1.5M14 11l4-8" />
      <Path d="M9 11h6v3l2 2v4a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-4l2-2z" />
      <Path d="M10 18h4" />
    </Svg>;
  }
  // Exact handles keep "מוצרים לבית" distinct from bundles despite its old slug.
  const Icon = knownCategory ? CATEGORY_ICONS[id]
    : /כביסה|טקסטיל/.test(title) ? WashingMachine
    : /אביזרי/.test(title) ? BrushCleaning
    : /מארז/.test(title) ? Gift
    : /ניקיון|ניקוי/.test(title) ? SprayCan
    : /עיצוב/.test(title) ? Armchair
    : /בית/.test(title) ? House : Grid2X2;
  return <Icon size={27} strokeWidth={1.45} color={storeAccent.ink} accessible={false} />;
}
