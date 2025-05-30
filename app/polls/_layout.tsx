import { Stack } from 'expo-router';
import { TouchableOpacity,View, Pressable } from 'react-native';
import { ArrowBigLeft } from 'lucide-react-native';
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
          <Pressable
            onPress={() => router.back()}
             style={{
                  marginLeft: 8,
                  marginRight: 8,
                  borderWidth: 1,
                  borderColor: '#FF6B4A',
                  padding: 10,
                }}
          >
            <ArrowBigLeft size={24} color="#3dd9d6" />
          </Pressable>
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