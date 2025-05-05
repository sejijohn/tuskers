import { Redirect, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';


export default function Index() {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Listen for notification response (when user taps it)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;

      // Example: route to specific screen based on notification data
      if (data?.chatId) {
        router.push(`/chat/${data.chatId}`);
      } else if (data?.pollId) {
        router.push('/polls');
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);
  return <Redirect href="/auth/login" />;
}