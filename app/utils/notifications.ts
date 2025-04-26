import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  console.log("registerForPushNotificationsAsync function called");
  let token;

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    token = (await Notifications.getExpoPushTokenAsync({ projectId: 'fd5eb028-000f-415b-a8ef-39a6efa42a91' })).data;
    console.log("FCM token received:", token); // Add this line
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
}

// utils/notifications.ts
// import * as Notifications from 'expo-notifications';
// import * as Device from 'expo-device';
// import Constants from 'expo-constants';

// export async function registerForPushNotificationsAsync(): Promise<string | null> {
//   if (!Device.isDevice) {
//     console.warn("Push notifications only work on physical devices.");
//     return null;
//   }

//   const { status: existingStatus } = await Notifications.getPermissionsAsync();
//   let finalStatus = existingStatus;

//   if (existingStatus !== 'granted') {
//     const { status } = await Notifications.requestPermissionsAsync();
//     finalStatus = status;
//   }

//   if (finalStatus !== 'granted') {
//     console.warn("Push notification permissions not granted.");
//     return null;
//   }
//   const projectId = Constants.expoConfig?.extra?.eas?.projectId;
// console.log("Project ID:", projectId);

//   try {
//     const tokenResponse = await Notifications.getExpoPushTokenAsync({
//       projectId: Constants.expoConfig?.extra?.eas?.projectId,
//     });
//     console.log("Expo Push Token:", tokenResponse.data);
//     return tokenResponse.data;
//   } catch (error) {
//     console.error("Failed to get Expo push token:", error);
//     return null;
//   }
// }
