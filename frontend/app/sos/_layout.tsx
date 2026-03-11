import React from 'react';
import { Stack } from 'expo-router';

export default function SOSLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F172A' },
        animation: 'fade',
        presentation: 'fullScreenModal',
      }}
    >
      <Stack.Screen name="active" />
    </Stack>
  );
}
