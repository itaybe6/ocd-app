import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pendingNavigation: { name: keyof RootStackParamList; params?: any } | null = null;

export function safeNavigate<Name extends keyof RootStackParamList>(name: Name, params?: RootStackParamList[Name]) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as any, params as any);
    return;
  }
  pendingNavigation = { name, params };
}

export function flushPendingNavigation() {
  if (!pendingNavigation) return;
  if (!navigationRef.isReady()) return;
  const { name, params } = pendingNavigation;
  pendingNavigation = null;
  navigationRef.navigate(name as any, params as any);
}

