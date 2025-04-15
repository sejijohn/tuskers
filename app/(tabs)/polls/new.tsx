import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, addDoc } from 'firebase/firestore';
import { Plus, Minus } from 'lucide-react-native';
import { db } from '../../utils/firebase';
import { useUser } from '../../context/UserContext';
import { Button } from '../../components/Button';
import { KeyboardAvoidingWrapper } from '../../components/KeyboardAvoidingWrapper';
import { v4 as uuidv4 } from 'uuid';

export default function CreatePollScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [duration, setDuration] = useState('24'); // Duration in hours
  const [creating, setCreating] = useState(false);

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const updateOption = (text: string, index: number) => {
    const newOptions = [...options];
    newOptions[index] = text;
    setOptions(newOptions);
  };

  const handleCreate = async () => {
    if (!user) return;

    // Validate inputs
    if (!question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    const validOptions = options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      Alert.alert('Error', 'Please enter at least 2 options');
      return;
    }

    const durationNum = parseInt(duration);
    if (isNaN(durationNum) || durationNum < 1 || durationNum > 168) {
      Alert.alert('Error', 'Duration must be between 1 and 168 hours');
      return;
    }

    try {
      setCreating(true);

      const pollData = {
        question: question.trim(),
        options: validOptions.map(text => ({
          id: uuidv4(),
          text: text.trim(),
          votes: [],
        })),
        createdBy: user.id,
        createdByName: user.fullName,
        createdAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + durationNum * 60 * 60 * 1000).toISOString(),
        isActive: true,
      };

      await addDoc(collection(db, 'polls'), pollData);
      router.back();
    } catch (error) {
      console.error('Error creating poll:', error);
      Alert.alert('Error', 'Failed to create poll. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <KeyboardAvoidingWrapper>
      <View style={styles.container}>
        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.label}>Question</Text>
            <TextInput
              style={styles.questionInput}
              value={question}
              onChangeText={setQuestion}
              placeholder="Enter your question"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              multiline
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Options</Text>
            {options.map((option, index) => (
              <View key={index} style={styles.optionContainer}>
                <TextInput
                  style={styles.optionInput}
                  value={option}
                  onChangeText={(text) => updateOption(text, index)}
                  placeholder={`Option ${index + 1}`}
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                />
                {options.length > 2 && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeOption(index)}
                  >
                    <Minus size={20} color="#FF6B4A" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {options.length < 5 && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={addOption}
              >
                <Plus size={20} color="#3dd9d6" />
                <Text style={styles.addButtonText}>Add Option</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Duration (hours)</Text>
            <TextInput
              style={styles.durationInput}
              value={duration}
              onChangeText={setDuration}
              placeholder="Enter duration in hours"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              keyboardType="number-pad"
            />
            <Text style={styles.hint}>
              Poll will be active for {duration} hours (max 168 hours / 7 days)
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={creating ? "Creating Poll..." : "Create Poll"}
            onPress={handleCreate}
            disabled={creating}
          />
        </View>
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
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3dd9d6',
    marginBottom: 8,
  },
  questionInput: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionInput: {
    flex: 1,
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 74, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  addButtonText: {
    color: '#3dd9d6',
    fontSize: 16,
    marginLeft: 8,
  },
  durationInput: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  footer: {
    padding: 16,
    backgroundColor: '#243c44',
    borderTopWidth: 1,
    borderTopColor: 'rgba(61, 217, 214, 0.1)',
  },
});