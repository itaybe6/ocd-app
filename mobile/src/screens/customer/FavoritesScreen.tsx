import React from 'react';
import { safeNavigate } from '../../navigation/navigationRef';
import { StoreFavoritesScreen } from '../store/StoreFavoritesScreen';
import type { StoreBottomTabId } from '../store/StoreHomeScreen';

export function CustomerFavoritesScreen({ onTabPress }: { onTabPress: (tabId: StoreBottomTabId) => void }) {
  return <StoreFavoritesScreen
    onTabPress={onTabPress}
    onOpenProduct={handle => safeNavigate('Product', { handle })}
    onLoginPress={() => safeNavigate('Login')}
  />;
}
