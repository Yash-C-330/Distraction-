import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  AppState,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width, height } = Dimensions.get('window');

export default function FocusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { sessionId, duration, quote } = params;

  const [remainingTime, setRemainingTime] = useState(parseInt(duration as string) * 60);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockProgress, setUnlockProgress] = useState(0);
  const unlockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const [leftAppCount, setLeftAppCount] = useState(0);

  useEffect(() => {
    // Start countdown timer
    countdownTimerRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          completeSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = (nextAppState: string) => {
    if (
      appStateRef.current.match(/active/) &&
      nextAppState.match(/inactive|background/)
    ) {
      // User left the app
      setLeftAppCount((prev) => prev + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    appStateRef.current = nextAppState;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const completeSession = async () => {
    try {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/sessions/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          userId: 'default_user',
        }),
      });

      await AsyncStorage.removeItem('activeSessionId');
      await AsyncStorage.removeItem('sessionDuration');
      await AsyncStorage.removeItem('sessionQuote');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Session Complete! 🎉',
        `Great work! You've completed your focus session.${leftAppCount > 0 ? `\n\nNote: You left the app ${leftAppCount} time(s) during this session.` : ''}`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Error completing session:', error);
      Alert.alert('Error', 'Failed to save session data');
      router.back();
    }
  };

  const handleEmergencyUnlockStart = () => {
    setIsUnlocking(true);
    setUnlockProgress(0);
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let progress = 0;
    unlockTimerRef.current = setInterval(() => {
      progress += 20;
      setUnlockProgress(progress);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (progress >= 100) {
        if (unlockTimerRef.current) {
          clearInterval(unlockTimerRef.current);
          unlockTimerRef.current = null;
        }
        handleEmergencyUnlock();
      }
    }, 1000);
  };

  const handleEmergencyUnlockEnd = () => {
    setIsUnlocking(false);
    setUnlockProgress(0);
    
    if (unlockTimerRef.current) {
      clearInterval(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
  };

  const handleEmergencyUnlock = async () => {
    // Clear all timers first
    if (unlockTimerRef.current) {
      clearInterval(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    // Clean up storage
    await AsyncStorage.removeItem('activeSessionId');
    await AsyncStorage.removeItem('sessionDuration');
    await AsyncStorage.removeItem('sessionQuote');

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    Alert.alert(
      'Session Cancelled',
      'Your focus session was cancelled. This session will not count towards your statistics.',
      [
        {
          text: 'OK',
          onPress: () => {
            router.back();
          },
        },
      ],
      { cancelable: false }
    );
  };

  const progressPercentage = 
    ((parseInt(duration as string) * 60 - remainingTime) / (parseInt(duration as string) * 60)) * 100;

  return (
    <LinearGradient
      colors={['#4A90E2', '#64B5F6', '#E3F2FD']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.content}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
          </View>
        </View>

        {/* Timer Display */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>Time Remaining</Text>
          <Text style={styles.timerText}>{formatTime(remainingTime)}</Text>
        </View>

        {/* Quote */}
        <View style={styles.quoteContainer}>
          <Ionicons name="leaf" size={32} color="#FFFFFF" />
          <Text style={styles.quoteText}>{quote}</Text>
        </View>

        {/* App Exit Warning */}
        {leftAppCount > 0 && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={24} color="#FFD700" />
            <Text style={styles.warningText}>
              You left the app {leftAppCount} time(s)
            </Text>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Ionicons name="information-circle-outline" size={24} color="rgba(255, 255, 255, 0.8)" />
          <Text style={styles.instructionsText}>
            Stay in this screen to complete your focus session
          </Text>
        </View>

        {/* Emergency Unlock Button */}
        <View style={styles.unlockContainer}>
          <TouchableOpacity
            style={[
              styles.unlockButton,
              isUnlocking && styles.unlockButtonActive,
            ]}
            onPressIn={handleEmergencyUnlockStart}
            onPressOut={handleEmergencyUnlockEnd}
            activeOpacity={0.8}
          >
            {isUnlocking ? (
              <View style={styles.unlockProgress}>
                <View
                  style={[
                    styles.unlockProgressFill,
                    { width: `${unlockProgress}%` },
                  ]}
                />
                <Text style={styles.unlockButtonText}>
                  Hold to unlock... {Math.ceil((100 - unlockProgress) / 20)}s
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="lock-open-outline" size={20} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.unlockButtonText}>Emergency Unlock</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.unlockHint}>Hold for 5 seconds to cancel session</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  timerContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  timerLabel: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    marginBottom: 16,
  },
  timerText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  quoteContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 60,
  },
  quoteText: {
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 36,
    marginTop: 16,
    fontWeight: '300',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  warningText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  instructionsText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 8,
    textAlign: 'center',
    flex: 1,
  },
  unlockContainer: {
    alignItems: 'center',
    marginTop: 'auto',
  },
  unlockButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    minWidth: 240,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  unlockButtonActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.3)',
    borderColor: 'rgba(255, 107, 107, 0.5)',
  },
  unlockProgress: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
  },
  unlockProgressFill: {
    position: 'absolute',
    left: 0,
    top: -16,
    bottom: -16,
    backgroundColor: 'rgba(255, 107, 107, 0.4)',
  },
  unlockButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  unlockHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 12,
    textAlign: 'center',
  },
});
