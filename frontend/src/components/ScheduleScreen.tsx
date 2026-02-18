import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Modal,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Schedule {
  _id: string;
  name: string;
  time: string;
  days: string[];
  enabled: boolean;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function ScheduleScreen() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleTime, setScheduleTime] = useState('21:00');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    requestNotificationPermissions();
    fetchSchedules();
  }, []);

  const requestNotificationPermissions = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Alert.alert(
        'Notifications Disabled',
        'Please enable notifications to receive focus session reminders.'
      );
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_URL}/api/schedules?userId=default_user`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch schedules');
      }

      const data = await response.json();
      setSchedules(data);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const createSchedule = async () => {
    if (!scheduleName.trim()) {
      Alert.alert('Error', 'Please enter a schedule name');
      return;
    }

    if (selectedDays.length === 0) {
      Alert.alert('Error', 'Please select at least one day');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: scheduleName,
          time: scheduleTime,
          days: selectedDays,
          userId: 'default_user',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create schedule');
      }

      await scheduleNotifications(scheduleName, scheduleTime, selectedDays);
      
      setModalVisible(false);
      setScheduleName('');
      setSelectedDays([]);
      setScheduleTime('21:00');
      fetchSchedules();
      
      Alert.alert('Success', 'Schedule created successfully');
    } catch (error) {
      console.error('Error creating schedule:', error);
      Alert.alert('Error', 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  const scheduleNotifications = async (
    name: string,
    time: string,
    days: string[]
  ) => {
    const [hours, minutes] = time.split(':').map(Number);
    
    // Schedule notification 5 minutes before
    const notificationTime = new Date();
    notificationTime.setHours(hours, minutes - 5, 0, 0);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Focus Session Reminder',
        body: `Your "${name}" focus session starts in 5 minutes`,
        sound: true,
      },
      trigger: {
        hour: notificationTime.getHours(),
        minute: notificationTime.getMinutes(),
        repeats: true,
      },
    });
  };

  const deleteSchedule = async (scheduleId: string) => {
    Alert.alert(
      'Delete Schedule',
      'Are you sure you want to delete this schedule?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${EXPO_PUBLIC_BACKEND_URL}/api/schedules/${scheduleId}`,
                { method: 'DELETE' }
              );

              if (!response.ok) {
                throw new Error('Failed to delete schedule');
              }

              fetchSchedules();
            } catch (error) {
              console.error('Error deleting schedule:', error);
              Alert.alert('Error', 'Failed to delete schedule');
            }
          },
        },
      ]
    );
  };

  const toggleSchedule = async (scheduleId: string) => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_URL}/api/schedules/${scheduleId}/toggle`,
        { method: 'PATCH' }
      );

      if (!response.ok) {
        throw new Error('Failed to toggle schedule');
      }

      fetchSchedules();
    } catch (error) {
      console.error('Error toggling schedule:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Schedules</Text>
          <Text style={styles.subtitle}>Set recurring focus times</Text>
        </View>

        {/* Schedules List */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {schedules.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color="#E3F2FD" />
              <Text style={styles.emptyStateTitle}>No schedules yet</Text>
              <Text style={styles.emptyStateText}>
                Create a schedule to get reminders for your focus sessions
              </Text>
            </View>
          ) : (
            schedules.map((schedule) => (
              <View key={schedule._id} style={styles.scheduleCard}>
                <View style={styles.scheduleHeader}>
                  <View style={styles.scheduleInfo}>
                    <Text style={styles.scheduleName}>{schedule.name}</Text>
                    <Text style={styles.scheduleTime}>{schedule.time}</Text>
                  </View>
                  <Switch
                    value={schedule.enabled}
                    onValueChange={() => toggleSchedule(schedule._id)}
                    trackColor={{ false: '#E3F2FD', true: '#4A90E2' }}
                    thumbColor={schedule.enabled ? '#FFFFFF' : '#95a5a6'}
                  />
                </View>
                <View style={styles.scheduleDays}>
                  {schedule.days.map((day) => (
                    <View key={day} style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>{day}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteSchedule(schedule._id)}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        {/* Add Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Schedule</Text>
        </TouchableOpacity>

        {/* Add Schedule Modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Schedule</Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={28} color="#2C3E50" />
                </TouchableOpacity>
              </View>

              <ScrollView>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Schedule Name</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., Evening Focus"
                    placeholderTextColor="#95a5a6"
                    value={scheduleName}
                    onChangeText={setScheduleName}
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Time</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="HH:MM (e.g., 21:00)"
                    placeholderTextColor="#95a5a6"
                    value={scheduleTime}
                    onChangeText={setScheduleTime}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Repeat on</Text>
                  <View style={styles.daysGrid}>
                    {DAYS.map((day) => (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.dayButton,
                          selectedDays.includes(day) && styles.dayButtonSelected,
                        ]}
                        onPress={() => toggleDay(day)}
                      >
                        <Text
                          style={[
                            styles.dayButtonText,
                            selectedDays.includes(day) && styles.dayButtonTextSelected,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={[styles.createButton, loading && styles.createButtonDisabled]}
                onPress={createSchedule}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.createButtonText}>
                  {loading ? 'Creating...' : 'Create Schedule'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F9FC',
  },
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E3F2FD',
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
  },
  scheduleTime: {
    fontSize: 16,
    color: '#4A90E2',
    marginTop: 4,
    fontWeight: '500',
  },
  scheduleDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  dayBadge: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  dayBadgeText: {
    color: '#4A90E2',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#4A90E2',
    margin: 20,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  modalField: {
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F5F9FC',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 2,
    borderColor: '#E3F2FD',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  dayButton: {
    backgroundColor: '#F5F9FC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E3F2FD',
    minWidth: 80,
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  dayButtonTextSelected: {
    color: '#FFFFFF',
  },
  createButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
