import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChevronLeft, Menu } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { WorkTemplatesScreen } from '../screens/admin/WorkTemplatesScreen';
import { WorkTemplateStationsScreen } from '../screens/admin/WorkTemplateStationsScreen';
import { WorkTemplateStationCreateScreen } from '../screens/admin/WorkTemplateStationCreateScreen';
import { WorkTemplateStationEditScreen } from '../screens/admin/WorkTemplateStationEditScreen';
import { WorkTemplateUserPickerScreen } from '../screens/admin/WorkTemplateUserPickerScreen';
import type { WorkTemplatesStackParamList } from './workTemplatesTypes';

const Stack = createNativeStackNavigator<WorkTemplatesStackParamList>();

const ADMIN_HEADER_LOGO = require('../../assets/logopng/OCDLOGO-04.png');

function AdminHeaderTitle() {
  return (
    <View pointerEvents="none" style={styles.headerTitleWrap}>
      <Image source={ADMIN_HEADER_LOGO} resizeMode="contain" style={styles.headerLogo} />
    </View>
  );
}

export function WorkTemplatesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTitleStyle: { fontWeight: '900' },
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.card },
        contentStyle: { backgroundColor: colors.bg },
        headerTitle: () => <AdminHeaderTitle />,
        headerTitleAlign: 'center',
        headerTitleContainerStyle: styles.headerTitleContainer,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="WorkTemplatesHome"
        component={WorkTemplatesScreen}
        options={({ navigation }) => ({
          title: 'תבניות עבודה',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="פתח תפריט"
              hitSlop={12}
              onPress={() => (navigation.getParent() as any)?.openDrawer?.()}
              style={({ pressed }) => ({
                padding: 6,
                borderRadius: 12,
                backgroundColor: pressed ? '#0F172A06' : 'transparent',
              })}
            >
              <Menu size={22} color={colors.text} />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        name="WorkTemplateStations"
        component={WorkTemplateStationsScreen}
        options={({ navigation }) => ({
          title: ``,
          headerBackTitle: '',
          headerBackTitleVisible: false,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="חזור"
              hitSlop={12}
              onPress={() => navigation.goBack()}
              style={({ pressed }) => ({
                padding: 6,
                borderRadius: 12,
                backgroundColor: pressed ? '#0F172A06' : 'transparent',
              })}
            >
              <ChevronLeft size={26} color={colors.text} />
            </Pressable>
          ),
        })}
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

const styles = StyleSheet.create({
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headerTitleWrap: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    width: 176,
    height: 40,
  },
});

