import { StyleSheet, View, Text } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../components/Button';

export default function PendingApproval() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Account Pending</Text>
        <Text style={styles.message}>
          Your account is pending approval from an administrator. You'll be able to login once your account has been approved.
        </Text>

        <Button
          title="Back to Login"
          onPress={() => router.replace('/auth/login')}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2f35',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#3dd9d6',
  },
  message: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    width: '100%',
  },
});