import { Stack } from 'expo-router';

export default function PollsLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="new" 
        options={{
          presentation: 'modal',
          headerStyle: {
            backgroundColor: '#243c44',
          },
          headerTintColor: '#3dd9d6',
          headerTitleStyle: {
            color: '#3dd9d6',
          },
          title: 'Create Poll',
        }}
      />
    </Stack>
  );
}