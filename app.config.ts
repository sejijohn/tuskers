
export default ({ config }) => ({
    ...config,
    owner: 'sejijohn', // Replace with your Expo username or organization name
    slug: 'tuskers', // Replace with your project slug
    android: {
      package: 'com.tuskers.app', // Replace with your unique package name
      googleServicesFile: './google-services.json', // Uncomment and provide the path if you use Firebase
    },
    version: process.env.APP_VERSION ?? "1.0.0",
    extra: {
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      eas: {
        projectId: "fd5eb028-000f-415b-a8ef-39a6efa42a91",
      },
    },
  });