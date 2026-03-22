import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { WorkTemplatesScreen } from '../screens/admin/WorkTemplatesScreen';
import { WorkTemplateStationsScreen } from '../screens/admin/WorkTemplateStationsScreen';
import { WorkTemplateStationCreateScreen } from '../screens/admin/WorkTemplateStationCreateScreen';
import { WorkTemplateStationEditScreen } from '../screens/admin/WorkTemplateStationEditScreen';
import { WorkTemplateUserPickerScreen } from '../screens/admin/WorkTemplateUserPickerScreen';
import type { WorkTemplatesStackParamList } from './workTemplatesTypes';

const Stack = createNativeStackNavigator<WorkTemplatesStackParamList>();

export function WorkTemplatesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTitleStyle: { fontWeight: '900' },
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.card },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="WorkTemplatesHome" component={WorkTemplatesScreen} options={{ title: 'תבניות עבודה' }} />
      <Stack.Screen
        name="WorkTemplateStations"
        component={WorkTemplateStationsScreen}
        options={({ route }) => ({ title: `תחנות בתבנית ${route.params.day}` })}
      />
      <Stack.Screen name="WorkTemplateStationCreate" component={WorkTemplateStationCreateScreen} options={{ title: 'הוספת תחנה' }} />
      <Stack.Screen name="WorkTemplateStationEdit" component={WorkTemplateStationEditScreen} options={{ title: 'עריכת תחנה' }} />
      <Stack.Screen
        name="WorkTemplateUserPicker"
        component={WorkTemplateUserPickerScreen}
        options={({ route }) => ({ title: route.params.kind === 'worker' ? 'בחר עובד' : 'בחר לקוח' })}
      />
    </Stack.Navigator>
  );
}

