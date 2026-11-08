import React from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import { PAGE_TRANSITION } from '../theme/sheetMotion';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { AdminHeader } from '../components/AdminHeader';
import { WorkTemplatesScreen } from '../screens/admin/WorkTemplatesScreen';
import { WorkTemplateStationsScreen } from '../screens/admin/WorkTemplateStationsScreen';
import { WorkTemplateStationCreateScreen } from '../screens/admin/WorkTemplateStationCreateScreen';
import { WorkTemplateStationEditScreen } from '../screens/admin/WorkTemplateStationEditScreen';

import type { WorkTemplatesStackParamList } from './workTemplatesTypes';

const Stack = createNativeStackNavigator<WorkTemplatesStackParamList>();

export function WorkTemplatesStack() {
  const reducedMotion = useReducedMotion();
  return (
    <Stack.Navigator
      screenOptions={{
        ...PAGE_TRANSITION,
        ...(reducedMotion ? { animation: 'none' as const } : {}),
        contentStyle: { backgroundColor: colors.bg },
        header: ({ navigation, back }) => (
          <AdminHeader
            onMenuPress={() => (navigation.getParent() as any)?.openDrawer?.()}
            onBackPress={back ? () => navigation.goBack() : undefined}
          />
        ),
      }}
    >
      <Stack.Screen name="WorkTemplatesHome" component={WorkTemplatesScreen} />
      <Stack.Screen name="WorkTemplateStations" component={WorkTemplateStationsScreen} />
      <Stack.Screen name="WorkTemplateStationCreate" component={WorkTemplateStationCreateScreen} />
      <Stack.Screen name="WorkTemplateStationEdit" component={WorkTemplateStationEditScreen} />
    </Stack.Navigator>
  );
}
