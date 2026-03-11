import React from 'react';
import { Stack } from 'expo-router';

export default function CircleLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F172A' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="create" />
      <Stack.Screen name="join" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
