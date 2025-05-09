import { useEffect } from 'react';
import { Stack, useSegments, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { useUser, UserProvider } from './context/UserContext';
import { ActivityIndicator, View } from 'react-native';
import * as Notifications from 'expo-notifications';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const segments = useSegments();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;

      if (data?.chatId) {
        router.push(`/chat/${data.chatId}`);
      } else if (data?.pollId) {
        router.push('/polls');
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (user && !user.approved && user.role === 'member') {
      router.replace('/auth/pending');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <UserProvider>
      <AuthGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
        <Stack.Screen name="auth/pending" options={{ headerShown: false }} />
        <Stack.Screen name="polls" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
      </Stack>
      <StatusBar style="auto" />
      </AuthGate>
    </UserProvider>
  );
}