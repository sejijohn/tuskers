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

  // ... [Previous useEffect hooks and helper functions remain exactly the same until handleEmergencySOS] ...

  const handleEmergencySOS = async () => {
    if (!user) return;

    // First confirmation
    Alert.alert(
      '🚨 Emergency SOS',
      'This will alert all members. Are you sure you need emergency assistance?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              '⚠️ Confirm Emergency',
              'This will create an emergency chat and notify ALL members. Please confirm this is a real emergency.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'SEND SOS',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      // Get all approved members
                      const membersQuery = query(
                        collection(db, 'users'),
                        where('approved', '==', true),
                        where('deleted', '==', false)
                      );
                      const membersSnapshot = await getDocs(membersQuery);
                      const memberIds = membersSnapshot.docs.map(doc => doc.id);

                      // Check for existing emergency chat
                      const existingChatQuery = query(
                        collection(db, 'chats'),
                        where('name', '==', '🚨 EMERGENCY SOS'),
                        where('participants', 'array-contains', user.id)
                      );
                      const existingChats = await getDocs(existingChatQuery);

                      let chatId;
                      if (!existingChats.empty) {
                        // Use existing emergency chat
                        chatId = existingChats.docs[0].id;
                      } else {
                        // Create new emergency group chat
                        const chatData = {
                          type: 'group',
                          name: '🚨 EMERGENCY SOS',
                          participants: memberIds,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        };
                        const chatRef = await addDoc(collection(db, 'chats'), chatData);
                        chatId = chatRef.id;
                      }

                      // Get user's location if available
                      let locationStr = '';
                      try {
                        const { status } = await Location.requestForegroundPermissionsAsync();
                        if (status === 'granted') {
                          const location = await Location.getCurrentPositionAsync({});
                          locationStr = `\n\nLocation: https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;
                        }
                      } catch (error) {
                        console.log('Error getting location:', error);
                      }

                      // Add emergency message
                      const messageData = {
                        content: `🚨 EMERGENCY SOS: PLEASE CALL ${user.phoneNumber || ''}\n\nEmergency assistance needed by ${user.fullName}.${locationStr}`,
                        senderId: user.id,
                        senderName: user.fullName,
                        senderPhotoURL: user.photoURL,
                        timestamp: new Date().toISOString(),
                        type: 'text',
                        statusMap: {
                          [user.id]: 'sent'
                        }
                      };

                      await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);

                      // Update chat's last message
                      await updateDoc(doc(db, 'chats', chatId), {
                        lastMessage: messageData,
                        updatedAt: new Date().toISOString(),
                      });

                      // Navigate to the emergency chat
                      router.push(`/chat/${chatId}`);
                    } catch (error) {
                      console.error('Error sending SOS:', error);
                      Alert.alert('Error', 'Failed to send SOS. Please try again.');
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  // ... [Previous render code and return statement remain exactly the same, but with updated SOS button handler] ...

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        <ScrollView style={styles.content}>
          {/* Previous content remains exactly the same */}
        </ScrollView>
        <TouchableOpacity
          style={styles.sosButton}
          onPress={handleEmergencySOS}
        >
          <AlertOctagon size={24} color="#ffffff" />
          <Text style={styles.sosButtonText}>Emergency SOS</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // ... [All previous styles remain exactly the same] ...
});