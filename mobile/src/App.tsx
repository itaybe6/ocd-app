import React from 'react';
import { View } from 'react-native';
import { StoreHomeScreen } from './screens/store/StoreHomeScreen';

export default function App() {
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StoreHomeScreen onAdminPress={() => {}} />
    </View>
  );
}

