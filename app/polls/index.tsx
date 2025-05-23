import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, TextInput, Modal, FlatList, Image, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, increment } from 'firebase/firestore';
import { Timer, Users, CheckCircle2, CreditCard as Edit2, Save, X, ListMinus } from 'lucide-react-native';
import { db } from '../utils/firebase';
import { useUser } from '../context/UserContext';
import { Poll } from '../types/poll';
import { Timestamp } from "firebase/firestore";
import { User, UserWithVote } from '../types/user';
import ParsedText from 'react-native-parsed-text';



export default function PollsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPoll, setEditingPoll] = useState<string | null>(null);
  const [editedQuestion, setEditedQuestion] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  //const [members, setMembers] = useState<User[]>([]);
  const [members, setMembers] = useState<UserWithVote[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'polls'),
      where('isActive', '==', true),
      where('isComplete', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pollsList: Poll[] = [];
      snapshot.forEach((doc) => {
        pollsList.push({ id: doc.id, ...doc.data() } as Poll);
      });
      setPolls(pollsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // useEffect(() => {
  //   const getVotersFromPoll = async () => {
  //     const voterIds = Array.from(
  //       new Set(polls.flatMap(poll => poll.options.flatMap(option => option.votes || [])))
  //     );
  //     const userPromises = voterIds.map(async (id) => {
  //       const userDoc = await getDoc(doc(db, "users", id));
  //       return userDoc.exists() ? { id: id, ...userDoc.data() } as User : null;
  //     });

  //     const users = (await Promise.all(userPromises)).filter(Boolean) as User[];
  //     setMembers(users);
  //   };
  //   if (polls) getVotersFromPoll();
  // }, [polls]);

  useEffect(() => {
    const getVotersFromPoll = async () => {
      const voterMap: { [userId: string]: string } = {};
      // Build a map from userId to their voted option text
      polls.forEach(poll => {
        poll.options.forEach(option => {
          (option.votes || []).forEach(userId => {
            voterMap[userId] = option.text;
          });
        });
      });
      const voterIds = Object.keys(voterMap);
      const userPromises = voterIds.map(async (id) => {
        const userDoc = await getDoc(doc(db, "users", id));
        if (!userDoc.exists()) return null;
        return {
          id,
          ...userDoc.data(),
          votedOptionText: voterMap[id],
        } as UserWithVote;
      });
      const users = (await Promise.all(userPromises)).filter(Boolean) as UserWithVote[];
      setMembers(users);
    };
    if (polls.length > 0) {
      getVotersFromPoll();
    }
  }, [polls]);



  const handleVote = async (optionId: string, poll: Poll) => {
    if (!user) return;

    try {
      const isVoting = poll.options.find(option => option.votes.includes(user.id));

      if (isVoting && isVoting.id === optionId) {
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

  // const getTimeLeft = (endsAt: string) => {
  //   const end = new Date(endsAt).getTime();
  //   const now = new Date().getTime();
  //   const diff = end - now;

  //   if (diff <= 0) return 'Ended';

  //   const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  //   const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  //   const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  //   if (days > 0) return `${days}d ${hours}h left`;
  //   if (hours > 0) return `${hours}h ${minutes}m left`;
  //   return `${minutes}m left`;
  // };



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

  const shortenUrl = (url: string) => {
    try {
      const { hostname } = new URL(url);
      return hostname.length > 30 ? hostname.slice(0, 27) + '...' : hostname;
    } catch {
      return url.length > 30 ? url.slice(0, 27) + '...' : url;
    }
  };




  const getVotePercentage = (votes: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading polls...</Text>
      </View>
    );
  }

  const renderMemberItem = ({ item }: { item: UserWithVote }) => (
    <View style={styles.memberItem}>
      <Image
        source={{ uri: item.photoURL || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80' }}
        style={styles.memberAvatar}
      />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.fullName}</Text>
        <Text style={styles.memberRole}>{item.role}</Text>
        <Text style={styles.memberOption}>Option: {item.votedOptionText}</Text>
      </View>
    </View>
  );



  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Active Poll</Text>
      </View>

      <ScrollView style={styles.content}>
        {polls.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No active polls</Text>
          </View>
        ) : (
          polls.map((poll) => {
            const totalVotes = getTotalVotes(poll);
            const userVote = getUserVote(poll);
            const hasUserVoted = hasVoted(poll);
            //const isActive = new Date(poll.endsAt).getTime() > new Date().getTime();
            const isActive = poll.endsAt.toDate().getTime() > new Date().getTime();
            const canEdit = user?.id === poll.createdBy || user?.role === 'admin';

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
                      <TouchableOpacity
                        style={styles.membersButton}
                        onPress={() => setShowMembers(true)}
                      >
                        <Users size={16} color="#3dd9d6" />
                        <Text style={styles.metaText}> {totalVotes} votes</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.options}>
                  {poll.options.map((option) => {
                    const percentage = getVotePercentage(option.votes.length, totalVotes);
                    const isSelected = userVote?.id === option.id;

                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[
                          styles.option,
                          isSelected && styles.selectedOption,
                          !isActive && styles.inactiveOption
                        ]}
                        onPress={() => isActive && handleVote(option.id, poll)}
                        disabled={!isActive}
                      >
                        <View style={styles.optionContent}>
                          <Text style={[
                            styles.optionText,
                            isSelected && styles.selectedOptionText
                          ]}>
                            {option.text}
                          </Text>
                          {isSelected && (
                            <CheckCircle2 size={20} color="#3dd9d6" />
                          )}
                        </View>
                        {(hasUserVoted || !isActive) && (
                          <View style={styles.resultBar}>
                            <View
                              style={[
                                styles.resultFill,
                                { width: `${percentage}%` }
                              ]}
                            />
                            <Text style={styles.percentage}>{percentage}%</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.pollFooter}>
                  <Text style={styles.createdBy}>Created by {poll.createdByName}</Text>
                  <Text style={styles.createdAt}>
                    {/* {new Date(poll.createdAt).toLocaleDateString()} */}
                    {poll.createdAt.toDate().toLocaleDateString()}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        <Modal
          visible={showMembers}
          transparent
          animationType="slide"
          onRequestClose={() => setShowMembers(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Poll Members</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowMembers(false)}
                >
                  <X size={24} color="#3dd9d6" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={members}
                renderItem={renderMemberItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.membersList}
              />
            </View>
          </View>
        </Modal>



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
  membersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    padding: 8,
    borderRadius: 20,
    margin: 8,
    alignSelf: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a2f35',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(61, 217, 214, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3dd9d6',
  },
  closeButton: {
    padding: 4,
  },
  membersList: {
    padding: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#243c44',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3dd9d6',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'capitalize',
  },
  memberOption: {
    fontSize: 14,
    color: 'rgba(236, 78, 42, 0.86)',
    textTransform: 'capitalize',
  },
});