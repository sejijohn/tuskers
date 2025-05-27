import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, TextInput, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, increment, getDocs } from 'firebase/firestore';
import { Timer, Users, CheckCircle2, Edit as Edit2, Save, X } from 'lucide-react-native';
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

  const handleVote = async (optionId: string, poll: Poll) => {
        if (!user) return;

        try {
            const isVoting = poll.options.find(option => option.votes.includes(user.id));

            if(isVoting && isVoting.id === optionId){
                await updateDoc(doc(db, 'polls', poll.id), {
                    options: poll.options.map(option => ({
                        ...option,
                        votes: option.id === optionId ? option.votes.filter(userId => userId !== user.id) : option.votes,
                    })),
                });

                // Check if the user is deselecting "Yes, I am joining the ride."
                const previousVote = poll.options.find(option => option.votes.includes(user.id));
                if (
                  poll.ridePoll &&
                  previousVote &&
                  previousVote.text === "Yes, I am joining the ride." &&
                  optionId === previousVote.id
                ) {
                  // Decrement the rideCounter
                  const userDocRef = doc(db, 'users', user.id);
                  const userDoc = await getDoc(userDocRef);
                  if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.rideCounter && userData.rideCounter > 0) {
                      await updateDoc(userDocRef, { rideCounter: increment(-1) });
                    }
                  }
                }
                return;
            }

            await updateDoc(doc(db, 'polls', poll.id), {
                options: poll.options.map(option => ({
                    ...option,
                    votes: option.id === optionId ? [...option.votes, user.id] : option.votes.filter(userId => userId !== user.id),
                })),
            });

            // Handle rideCounter for ride polls
            if (poll.ridePoll) {
                const selectedOption = poll.options.find(option => option.id === optionId);
                // Check if the user is voting for "Yes, I am joining the ride."
                if (selectedOption && selectedOption.text === "Yes, I am joining the ride.") {
                    // Increment the rideCounter
                    const userDocRef = doc(db, 'users', user.id);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                      const userData = userDoc.data();
                      if (userData.rideCounter) {
                        await updateDoc(userDocRef, { rideCounter: increment(1) });
                      } else {
                        await updateDoc(userDocRef, { rideCounter: 1 });
                      }
                    }
                } else {
                    // Check if the user is deselecting "Yes, I am joining the ride."
                    const previousVote = poll.options.find(option => option.votes.includes(user.id));
                    if (
                      poll.ridePoll &&
                      previousVote &&
                      previousVote.text === "Yes, I am joining the ride." &&
                      optionId !== previousVote.id
                    ) {
                      // Decrement the rideCounter
                      const userDocRef = doc(db, 'users', user.id);
                      const userDoc = await getDoc(userDocRef);
                      if (userDoc.exists()) {
                        const userData = userDoc.data();
                        if (userData.rideCounter && userData.rideCounter > 0) {
                          await updateDoc(userDocRef, { rideCounter: increment(-1) });
                        }
                      }
                    }
                }
            }
        
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to submit vote. Please try again.');
    }
  };

  const startEditing = (poll: Poll) => {
    if (user?.id !== poll.createdBy && user?.role !== 'admin') {
      Alert.alert('Error', 'You do not have permission to edit this poll');
      return;
    }
    setEditingPoll(poll.id);
    setEditedQuestion(poll.question);
  };

  const saveEdit = async (pollId: string) => {
    try {
      if (!editedQuestion.trim()) {
        Alert.alert('Error', 'Question cannot be empty');
        return;
      }

      await updateDoc(doc(db, 'polls', pollId), {
        question: editedQuestion.trim(),
      });

      setEditingPoll(null);
      setEditedQuestion('');
    } catch (error) {
      console.error('Error updating poll:', error);
      Alert.alert('Error', 'Failed to update poll');
    }
  };
    const [users, setUsers] = useState<Record<string, User>>({});

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

  const hasVoted = (poll: Poll) => {
    return poll.options.some(option => option.votes.includes(user?.id || ''));
  };

  const getUserVote = (poll: Poll) => {
    return poll.options.find(option => option.votes.includes(user?.id || ''));
  };

  const getTotalVotes = (poll: Poll) => {
    return poll.options.reduce((sum, option) => sum + option.votes.length, 0);
  };

  const getVotePercentage = (votes: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
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
            const totalVotes = getTotalVotes(poll);
            const userVote = getUserVote(poll);
            const hasUserVoted = hasVoted(poll);
            const isActive = poll.endsAt.toDate().getTime() > new Date().getTime();
            const canEdit = user?.id === poll.createdBy || user?.role === 'admin';
            const voters = poll.options.flatMap(option => option.votes);
            const uniqueVoters = [...new Set(voters)];
            return (
              <View key={poll.id} style={styles.pollCard}>
                <View style={styles.pollHeader}>
                  {editingPoll === poll.id ? (
                    <View style={styles.editContainer}>
                      <TextInput
                        style={styles.editInput}
                        value={editedQuestion}
                        onChangeText={setEditedQuestion}
                        multiline
                      />
                      <View style={styles.editActions}>
                        <TouchableOpacity
                          onPress={() => saveEdit(poll.id)}
                          style={styles.editButton}
                        >
                          <Save size={20} color="#3dd9d6" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setEditingPoll(null)}
                          style={[styles.editButton, styles.cancelButton]}
                        >
                          <X size={20} color="#FF6B4A" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      {/* <Text style={styles.pollQuestion}>{poll.question}</Text> */}
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
                      {canEdit && (
                        <TouchableOpacity
                          onPress={() => startEditing(poll)}
                          style={styles.editButton}
                        >
                          <Edit2 size={20} color="#3dd9d6" />
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                  <View style={styles.pollMeta}>
                    <View style={styles.metaItem}>
                      <Timer size={16} color="#3dd9d6" />
                      <Text style={styles.metaText}>{getTimeLeft(poll.endsAt)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Users size={16} color="#3dd9d6" />
                      <Text style={styles.metaText}>{totalVotes} votes</Text>
                    </View>
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
                    <Text style={styles.noVoters}>No votes yet</Text>
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
    marginBottom: 16,
  },
  pollQuestion: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3dd9d6',
    marginBottom: 8,
  },
  pollMeta: {
    flexDirection: 'row',
    gap: 16,
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
  options: {
    gap: 12,
  },
  option: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(61, 217, 214, 0.2)',
  },
  selectedOption: {
    backgroundColor: 'rgba(61, 217, 214, 0.2)',
    borderColor: '#3dd9d6',
  },
  inactiveOption: {
    opacity: 0.7,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
  },
  selectedOptionText: {
    color: '#3dd9d6',
    fontWeight: '600',
  },
  resultBar: {
    height: 24,
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  resultFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(61, 217, 214, 0.2)',
    borderRadius: 12,
  },
  percentage: {
    position: 'absolute',
    right: 8,
    top: 2,
    fontSize: 14,
    color: '#ffffff',
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
  editContainer: {
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 107, 74, 0.1)',
  },
  votersList: {
    marginTop: 16,
    gap: 8,
  },
  voterName: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 16,
  },
  noVoters: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
  },
  voterCard: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
});

