import { useState } from 'react';
import { StyleSheet, View, Text, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { KeyboardAvoidingWrapper } from '../components/KeyboardAvoidingWrapper';

export default function SignUp() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    myRides: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    try {
      setLoading(true);
      setError('');

      if (!formData.fullName || !formData.email || !formData.password) {
        setError('All fields are required');
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }

      if (!formData.fullName || !formData.email || !formData.password || !formData.myRides) {
        setError('All fields are required');
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const userDocRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userDocRef, {
        id: userCredential.user.uid,
        fullName: formData.fullName,
        email: formData.email,
        role: 'member',
        approved: false,
        deleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        photoURL: null,
        bio: '',
        rideCounter: 0,
        myRides: formData.myRides,
      });

      await auth.signOut();
      router.replace('/auth/pending');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else {
        setError('Failed to create account. Please try again.');
        console.error('Signup error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingWrapper>
        <View style={styles.content}>
          <View style={styles.header}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?w=800&auto=format&fit=crop&q=80' }}
              style={styles.backgroundImage}
              resizeMode="cover"
            />
            <View style={styles.overlay} />
            <View style={styles.headerContent}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join our community today</Text>
            </View>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputsContainer}>
              <Input
                label="Full Name"
                value={formData.fullName}
                onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                placeholder="Enter your full name"
                autoCapitalize="words"
              />

              <Input
                label="Email"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Input
                label="Password"
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                placeholder="Create a password"
                secureTextEntry
              />

              <Input
                label="Confirm Password"
                value={formData.confirmPassword}
                onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                placeholder="Confirm your password"
                secureTextEntry
              />

              <Input
                label="Rides I own"
                value={formData.myRides}
                onChangeText={(text) => setFormData({ ...formData, myRides: text })}
                placeholder="Enter your rides or 'NA' if you don't own one"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>

            <View style={styles.buttonsContainer}>
              <Button
                title={loading ? 'Creating Account...' : 'Create Account'}
                onPress={handleSignUp}
                disabled={loading}
                style={styles.button}
              />

              <Button
                title="Already have an account? Sign In"
                variant="secondary"
                onPress={() => router.replace('/auth/login')}
                style={styles.signInButton}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>
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
  },
  header: {
    height: 300,
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
  },
  inputsContainer: {
    marginBottom: 24,
  },
  buttonsContainer: {
    width: '100%',
    marginTop: 'auto',
    paddingBottom: Platform.OS === 'ios' ? 16 : 24,
  },
  error: {
    color: '#FF6B4A',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    marginBottom: 16,
  },
  signInButton: {
    marginBottom: 8,
  },
});