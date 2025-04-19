import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Image } from 'react-native';
import { doc, getDoc, collection, query, where, getDocs, orderBy, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { auth, db } from '../utils/firebase';
import { User } from '../types/user';
import { Update } from '../types/update';
import { KeyboardAvoidingWrapper } from '../components/KeyboardAvoidingWrapper';
import { Send, Trash2, Cloud, CloudRain, Sun, Wind, CloudLightning, CloudSnow, CloudFog } from 'lucide-react-native';
import * as Location from 'expo-location';

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

// Unit conversion functions
const celsiusToFahrenheit = (celsius: number) => Math.round(celsius * 9/5 + 32);
const kmhToMph = (kmh: number) => Math.round(kmh * 0.621371);
const mmToInches = (mm: number) => Number((mm * 0.0393701).toFixed(2));

export default function MemberDashboard() {
  const router = useRouter();
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

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as User);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((current) => 
        current === motorcycleImages.length - 1 ? 0 : current + 1
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Subscribe to updates
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






  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setWeatherLoading(true);
        setWeatherError(null);

        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setWeatherError('Location permission not granted');
          setWeatherLoading(false);
          return;
        }

        // Get current location
        const location = await Location.getCurrentPositionAsync({});
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

    fetchWeather();
  }, []);

  const getWeatherCondition = (code: number) => {
    // WMO Weather interpretation codes (WW)
    if (code === 0) return 'Clear sky';
    if (code === 1) return 'Mainly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code >= 45 && code <= 48) return 'Foggy';
    if (code >= 51 && code <= 55) return 'Drizzle';
    if (code >= 61 && code <= 65) return 'Rain';
    if (code >= 71 && code <= 77) return 'Snow';
    if (code >= 80 && code <= 82) return 'Rain showers';
    if (code >= 95 && code <= 99) return 'Thunderstorm';
    return 'Unknown';
  };

  const getRidingCondition = (weather: Weather) => {
    const condition = getWeatherCondition(weather.weatherCode);
    const tempF = celsiusToFahrenheit(weather.temperature);
    const windMph = kmhToMph(weather.windSpeed);
    const precipInches = mmToInches(weather.precipitation);
    
    if (tempF < 40) return {
      status: 'Poor',
      message: 'Very cold conditions. Consider postponing your ride.',
      color: '#FF6B4A'
    };
    if (tempF > 95) return {
      status: 'Poor',
      message: 'Extremely hot. Take frequent breaks and stay hydrated.',
      color: '#FF6B4A'
    };
    if (windMph > 20) return {
      status: 'Poor',
      message: 'High winds make riding dangerous. Better to wait.',
      color: '#FF6B4A'
    };
    if (precipInches > 0.2) return {
      status: 'Poor',
      message: 'Heavy precipitation. Not recommended for riding.',
      color: '#FF6B4A'
    };
    if (condition.includes('Rain') || condition.includes('Drizzle')) return {
      status: 'Moderate',
      message: 'Wet conditions. Ride with caution if necessary.',
      color: '#FFA500'
    };
    if (condition.includes('Clear')) return {
      status: 'Excellent',
      message: 'Perfect conditions for a ride!',
      color: '#3dd9d6'
    };
    return {
      status: 'Good',
      message: 'Decent conditions for riding. Stay alert.',
      color: '#3dd9d6'
    };
  };



  const handlePostUpdate = async () => {
    if (!user || !newUpdate.trim()) return;

    try {
      setPosting(true);

      const updateData = {
        content: newUpdate.trim(),
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.fullName,
      };

      await addDoc(collection(db, 'updates'), updateData);
      setNewUpdate('');
    } catch (error) {
      console.error('Error posting update:', error);
      Alert.alert('Error', 'Failed to post update. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteUpdate = async (updateId: string) => {
    try {
      setDeleting(updateId);
      const updateRef = doc(db, 'updates', updateId);
      await deleteDoc(updateRef);
    } catch (error) {
      console.error('Error deleting update:', error);
      Alert.alert('Error', 'Failed to delete update. Please try again.');
    } finally {
      setDeleting(null);
    }
  };


  const renderWeatherIcon = (code: number) => {
    const condition = getWeatherCondition(code).toLowerCase();
    
    if (condition.includes('thunderstorm')) {
      return <CloudLightning size={24} color="#3dd9d6" />;
    }
    if (condition.includes('rain') || condition.includes('drizzle')) {
      return <CloudRain size={24} color="#3dd9d6" />;
    }
    if (condition.includes('snow')) {
      return <CloudSnow size={24} color="#3dd9d6" />;
    }
    if (condition.includes('fog')) {
      return <CloudFog size={24} color="#3dd9d6" />;
    }
    if (condition.includes('clear')) {
      return <Sun size={24} color="#3dd9d6" />;
    }
    return <Cloud size={24} color="#3dd9d6" />;
  };

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

  return (
    <KeyboardAvoidingWrapper>
      <View style={styles.container}>
        <ScrollView style={styles.content}>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: motorcycleImages[currentImageIndex].url }}
              style={styles.backgroundImage}
            />
            <View style={styles.imageOverlay}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.nameText}>{user.fullName}</Text>
              <View style={styles.imageIndicators}>
                {motorcycleImages.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.indicator,
                      index === currentImageIndex && styles.indicatorActive
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>



          {weatherLoading ? (
            <View style={styles.weatherCard}>
              <Text style={styles.loadingText}>Loading weather data...</Text>
            </View>
          ) : weatherError ? (
            <View style={styles.weatherCard}>
              <Text style={styles.errorText}>{weatherError}</Text>
            </View>
          ) : weather && (
            <View style={styles.weatherCard}>
              <View style={styles.weatherHeader}>
                <View style={styles.weatherMain}>
                  {renderWeatherIcon(weather.weatherCode)}
                  <Text style={styles.temperature}>
                    {celsiusToFahrenheit(weather.temperature)}°F
                  </Text>
                </View>
                <Text style={styles.weatherCondition}>
                  {getWeatherCondition(weather.weatherCode)}
                </Text>
              </View>
              
              <View style={styles.weatherDetails}>
                <View style={styles.weatherDetail}>
                  <Wind size={16} color="#3dd9d6" />
                  <Text style={styles.weatherDetailText}>
                    Wind: {kmhToMph(weather.windSpeed)} mph
                  </Text>
                </View>
                <View style={styles.weatherDetail}>
                  <Cloud size={16} color="#3dd9d6" />
                  <Text style={styles.weatherDetailText}>
                    Humidity: {weather.humidity}%
                  </Text>
                </View>
                {weather.precipitation > 0 && (
                  <View style={styles.weatherDetail}>
                    <CloudRain size={16} color="#3dd9d6" />
                    <Text style={styles.weatherDetailText}>
                      Rain: {mmToInches(weather.precipitation)}"
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.ridingCondition}>
                <Text style={[
                  styles.ridingStatus,
                  { color: getRidingCondition(weather).color }
                ]}>
                  Riding Conditions: {getRidingCondition(weather).status}
                </Text>
                <Text style={styles.ridingMessage}>
                  {getRidingCondition(weather).message}
                </Text>
              </View>
            </View>
          )}






          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Updates</Text>
            {user.role === 'admin' && (
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={newUpdate}
                  onChangeText={setNewUpdate}
                  placeholder="Share an update..."
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  multiline
                />
                <TouchableOpacity
                  style={[
                    styles.postButton,
                    (!newUpdate.trim() || posting) && styles.postButtonDisabled
                  ]}
                  onPress={handlePostUpdate}
                  disabled={!newUpdate.trim() || posting}
                >
                  <Send size={20} color={!newUpdate.trim() || posting ? 'rgba(61, 217, 214, 0.5)' : '#3dd9d6'} />
                </TouchableOpacity>
              </View>
            )}
            <ScrollView style={styles.updatesList}>
              {updates.map((update) => (
                <View key={update.id} style={styles.updateItem}>
                  <View style={styles.updateHeader}>
                    <View style={styles.updateInfo}>
                      <Text style={styles.updateContent}>{update.content}</Text>
                      <Text style={styles.updateMeta}>
                        By {update.createdByName} • {new Date(update.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    {user.role === 'admin' && (
                      <TouchableOpacity
                        style={[
                          styles.deleteButton,
                          deleting === update.id && styles.deleteButtonDisabled
                        ]}
                        onPress={() => {
                          Alert.alert(
                            'Delete Update',
                            'Are you sure you want to delete this update?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { 
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => handleDeleteUpdate(update.id)
                              }
                            ]
                          );
                        }}
                        disabled={deleting === update.id}
                      >
                        <Trash2 
                          size={18} 
                          color={deleting === update.id ? 'rgba(255, 107, 74, 0.5)' : '#FF6B4A'} 
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2f35',
  },
  content: {
    flex: 1,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 16,
    color: '#3dd9d6',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 16,
    color: '#FF6B4A',
  },
  imageContainer: {
    height: 200,
    position: 'relative',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  welcomeText: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3dd9d6',
    marginBottom: 12,
  },
  imageIndicators: {
    flexDirection: 'row',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  indicatorActive: {
    backgroundColor: '#3dd9d6',
    width: 24,
  },
  card: {
    backgroundColor: '#243c44',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3dd9d6',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    minHeight: 40,
    maxHeight: 100,
  },
  postButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  updatesList: {
    maxHeight: 300,
  },
  updateItem: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  updateInfo: {
    flex: 1,
    marginRight: 12,
  },
  updateContent: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
  },
  updateMeta: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 74, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  weatherCard: {
    backgroundColor: '#243c44',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 8,
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  weatherMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  temperature: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3dd9d6',
  },
  weatherCondition: {
    fontSize: 18,
    color: '#ffffff',
    opacity: 0.8,
  },
  weatherDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(61, 217, 214, 0.1)',
  },
  weatherDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weatherDetailText: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.8,
  },
  ridingCondition: {
    alignItems: 'center',
  },
  ridingStatus: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  ridingMessage: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.8,
    textAlign: 'center',
  },
});