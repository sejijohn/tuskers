import { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Image, AppState, Linking, KeyboardAvoidingView, Platform} from 'react-native';
import { doc, getDoc, collection, query, where, getDocs, orderBy, onSnapshot, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Send, Trash2, Cloud, CloudRain, Sun, Wind, CloudLightning, CloudSnow, CloudFog, Users, Calendar, OctagonAlert as AlertOctagon } from 'lucide-react-native';
import { auth, db } from '../utils/firebase';
import { User } from '../types/user';
import { Update } from '../types/update';
import { Poll } from '../types/poll';
import { KeyboardAvoidingWrapper } from '../components/KeyboardAvoidingWrapper';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import ParsedText from 'react-native-parsed-text';
import { useUser } from '../context/UserContext';

const motorcycleImages = [
  {
    url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80',
    title: 'Classic Cafe Racer'
  },
  {
    url: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&fit=crop&q=80',
    title: 'Modern Sport Bike'
  },
  {
    url: 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=800&auto=format&fit=crop&q=80',
    title: 'Vintage Cruiser'
  },
  {
    url: 'https://images.unsplash.com/photo-1622185135505-2d795003994a?w=800&auto=format&fit=crop&q=80',
    title: 'Adventure Tourer'
  }
];

interface Weather {
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  humidity: number;
  precipitation: number;
}

const celsiusToFahrenheit = (celsius: number) => Math.round(celsius * 9 / 5 + 32);
const kmhToMph = (kmh: number) => Math.round(kmh * 0.621371);
const mmToInches = (mm: number) => Number((mm * 0.0393701).toFixed(2));

export default function MemberDashboard() {
  const router = useRouter();
  const { user: contextUser } = useUser();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [newUpdate, setNewUpdate] = useState('');
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [activeRidePoll, setActiveRidePoll] = useState<Poll | null>(null);
  const [loadingPoll, setLoadingPoll] = useState(true);
  const appState = useRef(AppState.currentState);

  // Initialize user data from context
  useEffect(() => {
    if (contextUser) {
      setUser(contextUser);
      setLoading(false);
    }
  }, [contextUser]);

  // Image carousel interval
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((current) =>
        current === motorcycleImages.length - 1 ? 0 : current + 1
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Fetch updates
  useEffect(() => {
    if (!user) return;

    const updatesQuery = query(
      collection(db, 'updates'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeUpdates = onSnapshot(updatesQuery, (snapshot) => {
      const updatesList: Update[] = [];
      snapshot.forEach((doc) => {
        updatesList.push({ id: doc.id, ...doc.data() } as Update);
      });
      setUpdates(updatesList);
    });

    return () => {
      unsubscribeUpdates();
    };
  }, [user]);

  // Fetch weather data
  useFocusEffect(
    useCallback(() => {
      fetchWeather();
    }, [])
  );

  // Weather and app state handling
  useEffect(() => {
    fetchWeather();
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        fetchWeather();
      }
      appState.current = nextAppState;
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Fetch active ride poll
  useEffect(() => {
    if (!user) return;

    const pollQuery = query(
      collection(db, 'polls'),
      where('isActive', '==', true),
      where('isComplete', '==', false),
      where('ridePoll', '==', true)
    );

    const unsubscribe = onSnapshot(pollQuery, (snapshot) => {
      if (!snapshot.empty) {
        const pollData = snapshot.docs[0].data() as Poll;
        const hasEnded = pollData.endsAt.toDate().getTime() <= new Date().getTime();
        if (!hasEnded) {
          setActiveRidePoll({ ...pollData, id: snapshot.docs[0].id });
        } else {
          setActiveRidePoll(null);
        }
      } else {
        setActiveRidePoll(null);
      }
      setLoadingPoll(false);
    });

    return () => unsubscribe();
  }, [user]);

  const fetchWeather = async () => {
    try {
      setWeatherLoading(true);
      setWeatherError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setWeatherError('Location permission not granted');
        setWeatherLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      const { latitude, longitude } = location.coords;

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m`
      );

      if (!response.ok) throw new Error('Weather data not available');

      const data = await response.json();
      setWeather({
        temperature: Math.round(data.current.temperature_2m),
        weatherCode: data.current.weather_code,
        windSpeed: Math.round(data.current.wind_speed_10m),
        humidity: data.current.relative_humidity_2m,
        precipitation: data.current.precipitation
      });
    } catch (error) {
      console.error('Error fetching weather:', error);
      setWeatherError('Unable to fetch weather data');
    } finally {
      setWeatherLoading(false);
    }
  };

  // ... [Rest of the code remains the same] ...

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Please log in to view the dashboard</Text>
      </View>
    );
  }

  // ... [Rest of the code remains exactly the same] ...