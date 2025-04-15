import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { PlusCircle, Timer, Users, CheckCircle2 } from 'lucide-react-native';
import { db } from '../../utils/firebase';
import { useUser } from '../../context/UserContext';
import { Poll } from '../../types/poll';

export default function PollsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'polls'),
      orderBy('createdAt', 'desc')
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

  const handleVote = async (pollId: string, optionId: string) => {
    if (!user) return;

    try {
      const pollRef = doc(db, 'polls', pollId);
      const poll = polls.find(p => p.id === pollId);
      
      if (!poll) return;

      // Remove user's vote from all options first
      const updatedOptions = poll.options.map(option => ({
        ...option,
        votes: option.votes.filter(voterId => voterId !== user.id)
      }));

      // Add vote to selected option
      const finalOptions = updatedOptions.map(option => 
        option.id === optionId
          ? { ...option, votes: [...option.votes, user.id] }
          : option
      );

      await updateDoc(pollRef, {
        options: finalOptions,
      });
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to submit vote. Please try again.');
    }
  };

  const getTimeLeft = (endsAt: string) => {
    const end = new Date(endsAt).getTime();
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
        <Text style={styles.title}>Polls</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/polls/new')}
        >
          <PlusCircle size={24} color="#3dd9d6" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {polls.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No polls available</Text>
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={() => router.push('/polls/new')}
            >
              <Text style={styles.createFirstButtonText}>Create First Poll</Text>
            </TouchableOpacity>
          </View>
        ) : (
          polls.map((poll) => {
            const totalVotes = getTotalVotes(poll);
            const userVote = getUserVote(poll);
            const hasUserVoted = hasVoted(poll);
            const isActive = new Date(poll.endsAt).getTime() > new Date().getTime();

            return (
              <View key={poll.id} style={styles.pollCard}>
                <View style={styles.pollHeader}>
                  <Text style={styles.pollQuestion}>{poll.question}</Text>
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
                        onPress={() => isActive && handleVote(poll.id, option.id)}
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
                    {new Date(poll.createdAt).toLocaleDateString()}
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
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
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
  createFirstButton: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3dd9d6',
  },
  createFirstButtonText: {
    color: '#3dd9d6',
    fontSize: 16,
    fontWeight: '500',
  },
});