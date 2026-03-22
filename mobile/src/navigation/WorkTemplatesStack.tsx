import React from 'react';
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
  return (
    <Stack.Navigator
      screenOptions={{
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
