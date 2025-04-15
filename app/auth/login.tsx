import { useState } from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { User } from '../types/user';
import { useUser } from '../context/UserContext';
import { KeyboardAvoidingWrapper } from '../components/KeyboardAvoidingWrapper';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useUser();

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      const userData = userDoc.data() as User;

      if (!userData.approved && userData.role === 'member') {
        await auth.signOut();
        router.replace('/auth/pending');
        return;
      }

      setUser(userData);
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Login error:', err);
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80' }}
            style={styles.backgroundImage}
            resizeMode="cover"
          />
          <View style={styles.overlay} />
          <View style={styles.headerContent}>
            <Text style={styles.title}>Welcome Back Tusker!</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputsContainer}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          <View style={styles.buttonsContainer}>
            <Button
              title={loading ? 'Signing in...' : 'Sign In'}
              onPress={handleLogin}
              disabled={loading}
              style={styles.button}
            />

            <Button
              title="Create an Account"
              variant="secondary"
              onPress={() => router.replace('/auth/signup')}
              style={styles.signupButton}
            />
          </View>
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
  header: {
    height: 280,
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  headerContent: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3dd9d6',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 18,
    color: '#ffffff',
    opacity: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  formContainer: {
    flex: 1,
    padding: 24,
    paddingTop: 32,
    minHeight: 400,
    justifyContent: 'space-between',
  },
  inputsContainer: {
    flex: 1,
    marginBottom: 24,
  },
  buttonsContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  error: {
    color: '#FF6B4A',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    marginBottom: 16,
  },
  signupButton: {
    marginBottom: 8,
  },
});