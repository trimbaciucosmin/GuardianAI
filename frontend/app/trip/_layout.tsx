import React from 'react';
import { Stack } from 'expo-router';

export default function TripLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F172A' },
        animation: 'slide_from_bottom',
      }}
    >
      <Stack.Screen name="active" />
    </Stack>
  );
}
