import { Redirect, router } from 'expo-router';
//import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';


export default function Index() {
  return <Redirect href="/auth/login" />;
}