#!/usr/bin/env python3
"""
NoScreen App Backend API Testing Suite
Tests all backend APIs for the focus timer application
"""

import requests
import json
import time
from datetime import datetime, timedelta
import sys
import os

# Get backend URL from frontend environment
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    base_url = line.split('=', 1)[1].strip()
                    return f"{base_url}/api"
    except Exception as e:
        print(f"Error reading frontend .env: {e}")
    
    # Fallback to localhost for testing
    return "http://localhost:8001/api"

BASE_URL = get_backend_url()
print(f"Testing backend at: {BASE_URL}")

# Test user data - using realistic names instead of dummy data
TEST_USER_1 = "sarah_johnson"
TEST_USER_2 = "mike_chen"

class NoScreenAPITester:
    def __init__(self):
        self.session_ids = []
        self.schedule_ids = []
        self.test_results = {
            "session_management": {"passed": 0, "failed": 0, "errors": []},
            "statistics": {"passed": 0, "failed": 0, "errors": []},
            "schedule_management": {"passed": 0, "failed": 0, "errors": []},
            "quotes": {"passed": 0, "failed": 0, "errors": []}
        }

    def log_result(self, category, test_name, success, error_msg=None):
        if success:
            self.test_results[category]["passed"] += 1
            print(f"✅ {test_name}")
        else:
            self.test_results[category]["failed"] += 1
            self.test_results[category]["errors"].append(f"{test_name}: {error_msg}")
            print(f"❌ {test_name}: {error_msg}")

    def test_quote_api(self):
        """Test the random quote API"""
        print("\n=== Testing Quote API ===")
        
        try:
            response = requests.get(f"{BASE_URL}/quotes", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "quote" in data and isinstance(data["quote"], str) and len(data["quote"]) > 0:
                    self.log_result("quotes", "Get random quote", True)
                else:
                    self.log_result("quotes", "Get random quote", False, "Invalid quote format")
            else:
                self.log_result("quotes", "Get random quote", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("quotes", "Get random quote", False, str(e))

    def test_session_management(self):
        """Test session management APIs"""
        print("\n=== Testing Session Management APIs ===")
        
        # Test 1: Start a session
        try:
            session_data = {
                "duration": 30,
                "userId": TEST_USER_1
            }
            response = requests.post(f"{BASE_URL}/sessions/start", json=session_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["_id", "quote", "startTime", "userId", "duration"]
                if all(field in data for field in required_fields):
                    self.session_ids.append(data["_id"])
                    self.log_result("session_management", "Start session", True)
                else:
                    self.log_result("session_management", "Start session", False, f"Missing fields in response: {data}")
            else:
                self.log_result("session_management", "Start session", False, f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("session_management", "Start session", False, str(e))

        # Test 2: Start another session for testing multiple sessions
        try:
            session_data = {
                "duration": 15,
                "userId": TEST_USER_1
            }
            response = requests.post(f"{BASE_URL}/sessions/start", json=session_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.session_ids.append(data["_id"])
                self.log_result("session_management", "Start second session", True)
            else:
                self.log_result("session_management", "Start second session", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("session_management", "Start second session", False, str(e))

        # Test 3: Complete a session
        if self.session_ids:
            try:
                complete_data = {
                    "sessionId": self.session_ids[0],
                    "userId": TEST_USER_1
                }
                response = requests.post(f"{BASE_URL}/sessions/complete", json=complete_data, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if "message" in data and "duration" in data:
                        self.log_result("session_management", "Complete session", True)
                    else:
                        self.log_result("session_management", "Complete session", False, f"Invalid response format: {data}")
                else:
                    self.log_result("session_management", "Complete session", False, f"HTTP {response.status_code}: {response.text}")
            except Exception as e:
                self.log_result("session_management", "Complete session", False, str(e))

        # Test 4: Get session history
        try:
            response = requests.get(f"{BASE_URL}/sessions/history?userId={TEST_USER_1}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("session_management", "Get session history", True)
                else:
                    self.log_result("session_management", "Get session history", False, f"Expected list, got: {type(data)}")
            else:
                self.log_result("session_management", "Get session history", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("session_management", "Get session history", False, str(e))

        # Test 5: Complete second session for stats testing
        if len(self.session_ids) > 1:
            try:
                complete_data = {
                    "sessionId": self.session_ids[1],
                    "userId": TEST_USER_1
                }
                response = requests.post(f"{BASE_URL}/sessions/complete", json=complete_data, timeout=10)
                
                if response.status_code == 200:
                    self.log_result("session_management", "Complete second session", True)
                else:
                    self.log_result("session_management", "Complete second session", False, f"HTTP {response.status_code}")
            except Exception as e:
                self.log_result("session_management", "Complete second session", False, str(e))

    def test_statistics_api(self):
        """Test statistics API"""
        print("\n=== Testing Statistics API ===")
        
        # Test 1: Get stats for user with sessions
        try:
            response = requests.get(f"{BASE_URL}/stats?userId={TEST_USER_1}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["totalHours", "sessionsCount", "currentStreak", "weeklyData"]
                if all(field in data for field in required_fields):
                    # Verify data types and values
                    if (isinstance(data["totalHours"], (int, float)) and 
                        isinstance(data["sessionsCount"], int) and
                        isinstance(data["currentStreak"], int) and
                        isinstance(data["weeklyData"], list) and
                        len(data["weeklyData"]) == 7):
                        
                        # Check if stats reflect completed sessions
                        if data["sessionsCount"] >= 2 and data["totalHours"] > 0:
                            self.log_result("statistics", "Get user stats with sessions", True)
                        else:
                            self.log_result("statistics", "Get user stats with sessions", False, 
                                          f"Stats don't reflect completed sessions: {data}")
                    else:
                        self.log_result("statistics", "Get user stats with sessions", False, 
                                      f"Invalid data types in response: {data}")
                else:
                    self.log_result("statistics", "Get user stats with sessions", False, 
                                  f"Missing required fields: {data}")
            else:
                self.log_result("statistics", "Get user stats with sessions", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("statistics", "Get user stats with sessions", False, str(e))

        # Test 2: Get stats for new user (should return defaults)
        try:
            response = requests.get(f"{BASE_URL}/stats?userId={TEST_USER_2}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if (data.get("totalHours") == 0.0 and 
                    data.get("sessionsCount") == 0 and
                    data.get("currentStreak") == 0 and
                    len(data.get("weeklyData", [])) == 7):
                    self.log_result("statistics", "Get default stats for new user", True)
                else:
                    self.log_result("statistics", "Get default stats for new user", False, 
                                  f"Expected default values, got: {data}")
            else:
                self.log_result("statistics", "Get default stats for new user", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("statistics", "Get default stats for new user", False, str(e))

    def test_schedule_management(self):
        """Test schedule management APIs"""
        print("\n=== Testing Schedule Management APIs ===")
        
        # Test 1: Create a schedule
        try:
            schedule_data = {
                "name": "Morning Focus",
                "time": "09:00",
                "days": ["Mon", "Wed", "Fri"],
                "userId": TEST_USER_1
            }
            response = requests.post(f"{BASE_URL}/schedules", json=schedule_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["_id", "name", "time", "days", "enabled", "userId"]
                if all(field in data for field in required_fields):
                    self.schedule_ids.append(data["_id"])
                    self.log_result("schedule_management", "Create schedule", True)
                else:
                    self.log_result("schedule_management", "Create schedule", False, 
                                  f"Missing fields in response: {data}")
            else:
                self.log_result("schedule_management", "Create schedule", False, 
                              f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("schedule_management", "Create schedule", False, str(e))

        # Test 2: Create another schedule
        try:
            schedule_data = {
                "name": "Evening Focus",
                "time": "21:00",
                "days": ["Tue", "Thu", "Sat"],
                "userId": TEST_USER_1
            }
            response = requests.post(f"{BASE_URL}/schedules", json=schedule_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.schedule_ids.append(data["_id"])
                self.log_result("schedule_management", "Create second schedule", True)
            else:
                self.log_result("schedule_management", "Create second schedule", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("schedule_management", "Create second schedule", False, str(e))

        # Test 3: Get all schedules
        try:
            response = requests.get(f"{BASE_URL}/schedules?userId={TEST_USER_1}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) >= 2:
                    self.log_result("schedule_management", "Get all schedules", True)
                else:
                    self.log_result("schedule_management", "Get all schedules", False, 
                                  f"Expected list with 2+ items, got: {data}")
            else:
                self.log_result("schedule_management", "Get all schedules", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("schedule_management", "Get all schedules", False, str(e))

        # Test 4: Toggle schedule enabled/disabled
        if self.schedule_ids:
            try:
                response = requests.patch(f"{BASE_URL}/schedules/{self.schedule_ids[0]}/toggle", timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if "enabled" in data and isinstance(data["enabled"], bool):
                        self.log_result("schedule_management", "Toggle schedule", True)
                    else:
                        self.log_result("schedule_management", "Toggle schedule", False, 
                                      f"Invalid response format: {data}")
                else:
                    self.log_result("schedule_management", "Toggle schedule", False, f"HTTP {response.status_code}")
            except Exception as e:
                self.log_result("schedule_management", "Toggle schedule", False, str(e))

        # Test 5: Delete a schedule
        if len(self.schedule_ids) > 1:
            try:
                response = requests.delete(f"{BASE_URL}/schedules/{self.schedule_ids[1]}", timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if "message" in data:
                        self.log_result("schedule_management", "Delete schedule", True)
                    else:
                        self.log_result("schedule_management", "Delete schedule", False, 
                                      f"Invalid response format: {data}")
                else:
                    self.log_result("schedule_management", "Delete schedule", False, f"HTTP {response.status_code}")
            except Exception as e:
                self.log_result("schedule_management", "Delete schedule", False, str(e))

    def test_data_isolation(self):
        """Test that different users have isolated data"""
        print("\n=== Testing Data Isolation ===")
        
        # Get schedules for TEST_USER_2 (should be empty)
        try:
            response = requests.get(f"{BASE_URL}/schedules?userId={TEST_USER_2}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) == 0:
                    self.log_result("schedule_management", "Data isolation - empty schedules for new user", True)
                else:
                    self.log_result("schedule_management", "Data isolation - empty schedules for new user", False, 
                                  f"Expected empty list, got: {data}")
            else:
                self.log_result("schedule_management", "Data isolation - empty schedules for new user", False, 
                              f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("schedule_management", "Data isolation - empty schedules for new user", False, str(e))

    def test_error_handling(self):
        """Test error handling for invalid requests"""
        print("\n=== Testing Error Handling ===")
        
        # Test completing non-existent session
        try:
            complete_data = {
                "sessionId": "507f1f77bcf86cd799439011",  # Valid ObjectId format but non-existent
                "userId": TEST_USER_1
            }
            response = requests.post(f"{BASE_URL}/sessions/complete", json=complete_data, timeout=10)
            
            if response.status_code == 404:
                self.log_result("session_management", "Error handling - non-existent session", True)
            else:
                self.log_result("session_management", "Error handling - non-existent session", False, 
                              f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_result("session_management", "Error handling - non-existent session", False, str(e))

        # Test deleting non-existent schedule
        try:
            response = requests.delete(f"{BASE_URL}/schedules/507f1f77bcf86cd799439011", timeout=10)
            
            if response.status_code == 404:
                self.log_result("schedule_management", "Error handling - non-existent schedule", True)
            else:
                self.log_result("schedule_management", "Error handling - non-existent schedule", False, 
                              f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_result("schedule_management", "Error handling - non-existent schedule", False, str(e))

    def run_all_tests(self):
        """Run all test suites"""
        print(f"Starting NoScreen Backend API Tests")
        print(f"Backend URL: {BASE_URL}")
        print("=" * 50)
        
        # Test in order of priority
        self.test_quote_api()
        self.test_session_management()
        self.test_statistics_api()
        self.test_schedule_management()
        self.test_data_isolation()
        self.test_error_handling()
        
        # Print summary
        print("\n" + "=" * 50)
        print("TEST SUMMARY")
        print("=" * 50)
        
        total_passed = 0
        total_failed = 0
        
        for category, results in self.test_results.items():
            passed = results["passed"]
            failed = results["failed"]
            total_passed += passed
            total_failed += failed
            
            status = "✅ PASS" if failed == 0 else "❌ FAIL"
            print(f"{category.upper()}: {status} ({passed} passed, {failed} failed)")
            
            if results["errors"]:
                for error in results["errors"]:
                    print(f"  - {error}")
        
        print(f"\nOVERALL: {total_passed} passed, {total_failed} failed")
        
        if total_failed == 0:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check the errors above.")
            return False

if __name__ == "__main__":
    tester = NoScreenAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)