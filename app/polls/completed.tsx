import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, TextInput, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, increment, getDocs } from 'firebase/firestore';
import { Timer, Users, CircleCheck as CheckCircle2, CreditCard as Edit2, Save, X, Trash2 } from 'lucide-react-native';
import { db } from '../utils/firebase';
import { useUser } from '../context/UserContext';
import { Poll } from '../types/poll';
import { Timestamp } from "firebase/firestore";
import { User } from '../types/user';
import ParsedText from 'react-native-parsed-text';

export default function CompletedPollsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPoll, setEditingPoll] = useState<string | null>(null);
  const [editedQuestion, setEditedQuestion] = useState('');
  const [users, setUsers] = useState<Record<string, User>>({});

  useEffect(() => {
    if (!user) return;

    const fetchUsers = async () => {
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const usersMap: Record<string, User> = {};
      usersSnapshot.forEach((doc) => {
        usersMap[doc.id] = { id: doc.id, ...doc.data() } as User;
      });
      setUsers(usersMap);
    };

    fetchUsers();

    const q = query(
      collection(db, 'polls'),
      where('isActive', '==', false),
      where('isComplete', '==', true),
      where('deleted', '!=', true)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pollsList: Poll[] = [];
      snapshot.forEach((doc) => {
        pollsList.push({ id: doc.id, ...doc.data() } as Poll);
      });
      const sortedPolls = pollsList.sort((a, b) => {
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });
      setPolls(sortedPolls);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [user]);

  const handleDeletePoll = async (pollId: string) => {
    if (!user || user.role !== 'admin') {
      Alert.alert('Error', 'Only admins can delete completed polls');
      return;
    }

    Alert.alert(
      'Delete Poll',
      'Are you sure you want to delete this completed poll?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'polls', pollId), {
                deleted: true
              });
            } catch (error) {
              console.error('Error deleting poll:', error);
              Alert.alert('Error', 'Failed to delete poll');
            }
          }
        }
      ]
    );
  };

  const getTimeLeft = (endsAt: Timestamp) => {
    const end = endsAt.toDate().getTime();
    const now = new Date().getTime();
    const diff = end - now;
  
    if (diff <= 0) return 'Ended';
  
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const shortenUrl = (url: string) => {
    try {
      const { hostname } = new URL(url);
      return hostname.length > 30 ? hostname.slice(0, 27) + '...' : hostname;
    } catch {
      return url.length > 30 ? url.slice(0, 27) + '...' : url;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading polls...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Completed Polls</Text>
      </View>

      <ScrollView style={styles.content}>
        {polls.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No completed polls</Text>
          </View>
        ) : (
          polls.map((poll) => {
            const voters = poll.options.flatMap(option => option.votes);
            const uniqueVoters = [...new Set(voters)];
            return (
              <View key={poll.id} style={styles.pollCard}>
                <View style={styles.pollHeader}>
                  <ParsedText
                    style={styles.pollQuestion}
                    parse={[
                      {
                        type: 'url',
                        style: { color: '#3dd9d6', textDecorationLine: 'underline' },
                        onPress: async (url) => {
                          const supported = await Linking.canOpenURL(url);
                          if (supported) {
                            Linking.openURL(url);
                          } else {
                            Alert.alert("Can't open this URL:", url);
                          }
                        },
                        renderText: shortenUrl,
                      },
                    ]}
                    childrenProps={{ allowFontScaling: false }}
                  >
                    {poll.question}
                  </ParsedText>
                  {user?.role === 'admin' && (
                    <TouchableOpacity
                      onPress={() => handleDeletePoll(poll.id)}
                      style={styles.deleteButton}
                    >
                      <Trash2 size={20} color="#FF6B4A" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.pollMeta}>
                  <View style={styles.metaItem}>
                    <Timer size={16} color="#3dd9d6" />
                    <Text style={styles.metaText}>{getTimeLeft(poll.endsAt)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Users size={16} color="#3dd9d6" />
                    <Text style={styles.metaText}>{uniqueVoters.length} votes</Text>
                  </View>
                </View>

                <View style={styles.votersList}>
                  {uniqueVoters.length > 0 ? (
                    uniqueVoters.map(voterId => (
                      <View key={voterId} style={styles.voterCard}>
                        <Text style={styles.voterName}>
                          {users[voterId]?.fullName || 'Unknown User'}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noVoters}>No votes recorded</Text>
                  )}
                </View>

                <View style={styles.pollFooter}>
                  <Text style={styles.createdBy}>Created by {poll.createdByName}</Text>
                  <Text style={styles.createdAt}>
                    {poll.createdAt.toDate().toLocaleDateString()}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2f35',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#243c44',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(61, 217, 214, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3dd9d6',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  pollCard: {
    backgroundColor: '#243c44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  pollQuestion: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3dd9d6',
    flex: 1,
    marginRight: 12,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 107, 74, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.8,
  },
  votersList: {
    marginTop: 16,
    gap: 8,
  },
  voterCard: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  voterName: {
    color: '#ffffff',
    fontSize: 14,
  },
  noVoters: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  pollFooter: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createdBy: {
    fontSize: 12,
    color: '#3dd9d6',
  },
  createdAt: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 16,
    color: '#3dd9d6',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#243c44',
    borderRadius: 12,
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
  },
});