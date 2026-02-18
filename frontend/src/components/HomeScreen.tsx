import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function HomeScreen() {
  const router = useRouter();
  const [customDuration, setCustomDuration] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);

  useEffect(() => {
    checkActiveSession();
  }, []);

  const checkActiveSession = async () => {
    try {
      const sessionId = await AsyncStorage.getItem('activeSessionId');
      if (sessionId) {
        setActiveSessionId(sessionId);
        setIsSessionActive(true);
      }
    } catch (error) {
      console.error('Error checking active session:', error);
    }
  };

  const startFocusSession = async (duration: number) => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/sessions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          duration,
          userId: 'default_user',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start session');
      }

      const data = await response.json();
      await AsyncStorage.setItem('activeSessionId', data._id);
      await AsyncStorage.setItem('sessionDuration', duration.toString());
      await AsyncStorage.setItem('sessionQuote', data.quote);
      
      setActiveSessionId(data._id);
      setIsSessionActive(true);

      // Navigate to focus screen
      router.push({
        pathname: '/focus',
        params: {
          sessionId: data._id,
          duration: duration.toString(),
          quote: data.quote,
        },
      });
    } catch (error) {
      console.error('Error starting session:', error);
      Alert.alert('Error', 'Failed to start focus session');
    }
  };

  const handlePresetPress = (minutes: number) => {
    startFocusSession(minutes);
  };

  const handleCustomDuration = () => {
    const duration = parseInt(customDuration);
    if (isNaN(duration) || duration <= 0) {
      Alert.alert('Invalid Duration', 'Please enter a valid number of minutes');
      return;
    }
    if (duration > 480) {
      Alert.alert('Duration Too Long', 'Maximum duration is 480 minutes (8 hours)');
      return;
    }
    startFocusSession(duration);
    setCustomDuration('');
  };

  const resumeSession = async () => {
    if (activeSessionId) {
      const duration = await AsyncStorage.getItem('sessionDuration');
      const quote = await AsyncStorage.getItem('sessionQuote');
      
      router.push({
        pathname: '/focus',
        params: {
          sessionId: activeSessionId,
          duration: duration || '25',
          quote: quote || 'Stay focused, be present',
        },
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="leaf-outline" size={40} color="#4A90E2" />
            <Text style={styles.title}>NoScreen</Text>
            <Text style={styles.subtitle}>Focus & Be Present</Text>
          </View>

          {/* Active Session Indicator */}
          {isSessionActive && (
            <TouchableOpacity style={styles.activeSessionBanner} onPress={resumeSession}>
              <Ionicons name="time" size={24} color="#4A90E2" />
              <View style={styles.activeSessionText}>
                <Text style={styles.activeSessionTitle}>Session in Progress</Text>
                <Text style={styles.activeSessionSubtitle}>Tap to resume</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#4A90E2" />
            </TouchableOpacity>
          )}

          {/* Preset Durations */}
          <View style={styles.presetsContainer}>
            <Text style={styles.sectionTitle}>Quick Start</Text>
            <View style={styles.presetButtonsRow}>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => handlePresetPress(15)}
                activeOpacity={0.7}
              >
                <Ionicons name="timer-outline" size={32} color="#4A90E2" />
                <Text style={styles.presetButtonText}>15 min</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.presetButton, styles.presetButtonPrimary]}
                onPress={() => handlePresetPress(30)}
                activeOpacity={0.7}
              >
                <Ionicons name="timer-outline" size={32} color="#FFFFFF" />
                <Text style={[styles.presetButtonText, styles.presetButtonTextPrimary]}>
                  30 min
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => handlePresetPress(60)}
                activeOpacity={0.7}
              >
                <Ionicons name="timer-outline" size={32} color="#4A90E2" />
                <Text style={styles.presetButtonText}>1 hour</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Custom Duration */}
          <View style={styles.customContainer}>
            <Text style={styles.sectionTitle}>Custom Duration</Text>
            <View style={styles.customInputRow}>
              <TextInput
                style={styles.customInput}
                placeholder="Enter minutes"
                placeholderTextColor="#95a5a6"
                keyboardType="number-pad"
                value={customDuration}
                onChangeText={setCustomDuration}
                maxLength={3}
              />
              <TouchableOpacity
                style={styles.customButton}
                onPress={handleCustomDuration}
                activeOpacity={0.7}
              >
                <Text style={styles.customButtonText}>Start</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={24} color="#4A90E2" />
            <Text style={styles.infoText}>
              During your focus session, stay in the app to maintain your streak and build better habits.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F9FC',
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 4,
  },
  activeSessionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  activeSessionText: {
    flex: 1,
    marginLeft: 12,
  },
  activeSessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  activeSessionSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  presetsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  presetButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: '#E3F2FD',
    minHeight: 120,
    justifyContent: 'center',
  },
  presetButtonPrimary: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  presetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
    marginTop: 8,
  },
  presetButtonTextPrimary: {
    color: '#FFFFFF',
  },
  customContainer: {
    marginBottom: 32,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 2,
    borderColor: '#E3F2FD',
    marginRight: 12,
  },
  customButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 100,
    justifyContent: 'center',
  },
  customButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#2C3E50',
    marginLeft: 12,
    lineHeight: 20,
  },
});
