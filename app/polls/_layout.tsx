import { Stack } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function PollsLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#243c44',
        },
        headerTintColor: '#3dd9d6',
        headerTitleStyle: {
          color: '#3dd9d6',
        },
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => router.back()}
            style={{ marginLeft: 8 }}
          >
            <ChevronLeft size={24} color="#3dd9d6" />
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Active Poll',
          headerShown: true
        }} 
      />
      <Stack.Screen 
        name="new" 
        options={{
          title: 'Create Poll',
        }}
      />
    </Stack>
  );
}