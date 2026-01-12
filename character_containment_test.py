#!/usr/bin/env python3
"""
CRITICAL CHARACTER CONTAINMENT TESTING

This test verifies that personas properly stay in character and respect their knowledge boundaries.
Specifically testing "dumb" vs "expert" persona knowledge limits.
"""

import requests
import json
import sys
import time
from typing import List, Dict, Any

class CharacterContainmentTester:
    def __init__(self, base_url="https://creative-voices-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.conversation_id = None
        self.guest_user = None
        self.beavis_persona = None
        self.mckenna_persona = None
        self.test_results = []
        
    def log_result(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   {details}")
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, timeout: int = 30) -> tuple:
        """Make API request and return (success, response_data)"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            else:
                return False, {"error": f"Unsupported method: {method}"}
                
            if response.status_code in [200, 201]:
                return True, response.json()
            else:
                return False, {"error": f"Status {response.status_code}: {response.text}"}
                
        except Exception as e:
            return False, {"error": str(e)}
    
    def setup_guest_session(self) -> bool:
        """Step 1: Sign in as guest"""
        print("\n🔐 Setting up guest session...")
        success, response = self.make_request('GET', 'auth/guest')
        
        if success:
            self.guest_user = response
            self.log_result("Guest Authentication", True, f"Guest ID: {response.get('id', 'Unknown')}")
            return True
        else:
            self.log_result("Guest Authentication", False, f"Error: {response.get('error')}")
            return False
    
    def find_test_personas(self) -> bool:
        """Step 2: Find Beavis (limited intelligence) and Terence McKenna (expert) personas"""
        print("\n🎭 Finding test personas...")
        success, response = self.make_request('GET', 'personas')
        
        if not success:
            self.log_result("Find Test Personas", False, f"Error: {response.get('error')}")
            return False
            
        personas = response
        
        # Find Beavis (limited intelligence persona)
        for persona in personas:
            name = persona.get('display_name', '').lower()
            if 'beavis' in name:
                self.beavis_persona = persona
                break
                
        # Find Terence McKenna (expert persona)  
        for persona in personas:
            name = persona.get('display_name', '')
            if 'terence mckenna' in name.lower() and persona.get('type') == 'historical':
                self.mckenna_persona = persona
                break
        
        if not self.beavis_persona:
            self.log_result("Find Beavis Persona", False, "Beavis persona not found")
            return False
            
        if not self.mckenna_persona:
            self.log_result("Find McKenna Persona", False, "Terence McKenna persona not found")
            return False
            
        self.log_result("Find Test Personas", True, 
                       f"Found Beavis: {self.beavis_persona['display_name']} and McKenna: {self.mckenna_persona['display_name']}")
        return True
    
    def create_test_conversation(self) -> bool:
        """Step 3: Create conversation with both personas active"""
        print("\n💬 Creating test conversation...")
        
        conv_data = {
            "mode": "Creativity Collaboration",
            "topic": "Character Containment Test",
            "active_personas": [self.beavis_persona['id'], self.mckenna_persona['id']]
        }
        
        # Add user_id as query parameter for guest users
        endpoint = f"conversations?user_id={self.guest_user['id']}"
        success, response = self.make_request('POST', endpoint, conv_data)
        
        if success:
            self.conversation_id = response.get('id')
            self.log_result("Create Test Conversation", True, f"Conversation ID: {self.conversation_id}")
            return True
        else:
            self.log_result("Create Test Conversation", False, f"Error: {response.get('error')}")
            return False
    
    def test_complex_topic_introduction(self) -> bool:
        """Test 1: Complex Topic Introduction - Stoned Ape Theory"""
        print("\n🧠 Test 1: Complex Topic Introduction...")
        
        generate_data = {
            "conversation_id": self.conversation_id,
            "user_message": "Hey everyone, what do you think about the stoned ape theory of human evolution?",
            "attachments": []
        }
        
        success, response = self.make_request('POST', 'chat/generate-multi', generate_data, timeout=45)
        
        if not success:
            self.log_result("Complex Topic Test", False, f"API Error: {response.get('error')}")
            return False
            
        responses = response.get('responses', [])
        if len(responses) < 2:
            self.log_result("Complex Topic Test", False, f"Expected 2 responses, got {len(responses)}")
            return False
        
        # Analyze responses
        beavis_response = None
        mckenna_response = None
        
        for resp in responses:
            persona_name = resp.get('persona_name', '').lower()
            content = resp.get('content', '')
            
            if 'beavis' in persona_name:
                beavis_response = content
            elif 'terence' in persona_name or 'mckenna' in persona_name:
                mckenna_response = content
        
        # Check McKenna's response (should be knowledgeable)
        mckenna_pass = False
        if mckenna_response:
            mckenna_lower = mckenna_response.lower()
            expert_indicators = ['stoned ape', 'theory', 'evolution', 'consciousness', 'psilocybin', 'mushroom', 'human development']
            if any(indicator in mckenna_lower for indicator in expert_indicators):
                mckenna_pass = True
                
        # Check Beavis's response (should be confused/simple)
        beavis_pass = False
        if beavis_response:
            beavis_lower = beavis_response.lower()
            
            # FAILURE indicators - complex vocabulary Beavis shouldn't use
            failure_words = ['articulate', 'consciousness', 'evolutionary', 'cognitive', 'anthropological', 'theoretical', 'hypothesis']
            has_failure_words = any(word in beavis_lower for word in failure_words)
            
            # SUCCESS indicators - appropriate Beavis responses
            success_indicators = ['huh', 'what', 'dumb', 'stupid', 'cool', 'sucks', 'butthead', 'fire', 'yeah']
            has_success_indicators = any(indicator in beavis_lower for indicator in success_indicators)
            
            # Check for confusion/dismissal
            confusion_indicators = ['don\'t get it', 'confused', 'what are you talking about', 'sounds dumb', 'whatever']
            has_confusion = any(indicator in beavis_lower for indicator in confusion_indicators)
            
            # Beavis passes if he shows confusion/dismissal OR uses his typical vocabulary, AND doesn't use complex terms
            if (has_success_indicators or has_confusion) and not has_failure_words:
                beavis_pass = True
        
        # Print detailed analysis
        print(f"\n📝 RESPONSE ANALYSIS:")
        print(f"McKenna Response: {mckenna_response[:200]}...")
        print(f"McKenna Knowledge Check: {'✅ PASS' if mckenna_pass else '❌ FAIL'}")
        print(f"Beavis Response: {beavis_response[:200]}...")
        print(f"Beavis Character Check: {'✅ PASS' if beavis_pass else '❌ FAIL'}")
        
        overall_pass = mckenna_pass and beavis_pass
        details = f"McKenna: {'Expert' if mckenna_pass else 'Failed'}, Beavis: {'In-character' if beavis_pass else 'Out-of-character'}"
        self.log_result("Complex Topic Introduction", overall_pass, details)
        
        return overall_pass
    
    def test_persona_to_persona_discussion(self) -> bool:
        """Test 2: Trigger continue-discussion to see persona-to-persona interaction"""
        print("\n🗣️ Test 2: Persona-to-Persona Discussion...")
        
        continue_data = {
            "conversation_id": self.conversation_id,
            "max_rounds": 2
        }
        
        success, response = self.make_request('POST', 'chat/continue-discussion', continue_data, timeout=60)
        
        if not success:
            self.log_result("Persona Discussion Test", False, f"API Error: {response.get('error')}")
            return False
            
        responses = response.get('responses', [])
        rounds_completed = response.get('rounds_completed', 0)
        
        if len(responses) == 0:
            self.log_result("Persona Discussion Test", False, "No responses generated in discussion")
            return False
        
        # Analyze if Beavis maintains character when responding to McKenna
        beavis_maintained_character = True
        beavis_responses = []
        
        for resp in responses:
            persona_name = resp.get('persona_name', '').lower()
            content = resp.get('content', '')
            
            if 'beavis' in persona_name:
                beavis_responses.append(content)
                
                # Check if Beavis suddenly became articulate
                content_lower = content.lower()
                complex_words = ['articulate', 'consciousness', 'evolutionary', 'cognitive', 'sophisticated', 'theoretical']
                if any(word in content_lower for word in complex_words):
                    beavis_maintained_character = False
        
        details = f"Rounds: {rounds_completed}, Responses: {len(responses)}, Beavis maintained character: {beavis_maintained_character}"
        self.log_result("Persona-to-Persona Discussion", beavis_maintained_character, details)
        
        return beavis_maintained_character
    
    def test_direct_question_to_beavis(self) -> bool:
        """Test 3: Ask Beavis directly to explain what McKenna said"""
        print("\n❓ Test 3: Direct Question to Beavis...")
        
        generate_data = {
            "conversation_id": self.conversation_id,
            "user_message": "@Beavis, can you explain what Terence just said about consciousness and evolution?",
            "attachments": []
        }
        
        success, response = self.make_request('POST', 'chat/generate-multi', generate_data, timeout=45)
        
        if not success:
            self.log_result("Direct Question Test", False, f"API Error: {response.get('error')}")
            return False
            
        responses = response.get('responses', [])
        beavis_response = None
        
        # Find Beavis's response (he should be the primary responder since he was mentioned)
        for resp in responses:
            persona_name = resp.get('persona_name', '').lower()
            if 'beavis' in persona_name:
                beavis_response = resp.get('content', '')
                break
        
        if not beavis_response:
            self.log_result("Direct Question Test", False, "Beavis did not respond to direct question")
            return False
        
        # Check if Beavis responds appropriately (confused, dismissive, or oversimplified)
        beavis_lower = beavis_response.lower()
        
        # FAILURE: If Beavis accurately paraphrases complex concepts
        failure_indicators = ['consciousness evolves', 'evolutionary theory', 'cognitive development', 'human consciousness']
        has_failures = any(indicator in beavis_lower for indicator in failure_indicators)
        
        # SUCCESS: Confusion, dismissal, or oversimplification
        success_indicators = [
            'huh', 'what', 'don\'t get it', 'sounds dumb', 'whatever', 'i don\'t know', 
            'confused', 'makes no sense', 'boring', 'stupid', 'butthead'
        ]
        has_success = any(indicator in beavis_lower for indicator in success_indicators)
        
        # Check for inappropriate vocabulary
        complex_vocab = ['articulate', 'consciousness', 'evolutionary', 'cognitive', 'sophisticated']
        has_complex_vocab = any(word in beavis_lower for word in complex_vocab)
        
        character_maintained = has_success and not has_failures and not has_complex_vocab
        
        print(f"Beavis Response: {beavis_response}")
        print(f"Character Analysis: Confusion/Dismissal: {has_success}, Complex Paraphrasing: {has_failures}, Complex Vocab: {has_complex_vocab}")
        
        details = f"Response shows appropriate confusion/dismissal: {character_maintained}"
        self.log_result("Direct Question to Beavis", character_maintained, details)
        
        return character_maintained
    
    def test_vocabulary_consistency(self) -> bool:
        """Test 4: Check vocabulary consistency across all responses"""
        print("\n📚 Test 4: Vocabulary Consistency Check...")
        
        # Get all messages from the conversation
        success, response = self.make_request('GET', f'conversations/{self.conversation_id}/messages')
        
        if not success:
            self.log_result("Vocabulary Check", False, f"Error getting messages: {response.get('error')}")
            return False
        
        messages = response
        beavis_messages = []
        mckenna_messages = []
        
        for msg in messages:
            persona_name = msg.get('persona_name', '').lower()
            content = msg.get('content', '')
            
            if 'beavis' in persona_name:
                beavis_messages.append(content)
            elif 'terence' in persona_name or 'mckenna' in persona_name:
                mckenna_messages.append(content)
        
        # Check Beavis vocabulary violations
        beavis_violations = []
        forbidden_words = ['articulate', 'consciousness', 'evolutionary', 'cognitive', 'anthropological', 'theoretical', 'sophisticated', 'hypothesis']
        
        for msg in beavis_messages:
            msg_lower = msg.lower()
            for word in forbidden_words:
                if word in msg_lower:
                    beavis_violations.append(f"Used '{word}' in: {msg[:50]}...")
        
        # Check McKenna has appropriate expertise
        mckenna_shows_expertise = False
        expertise_indicators = ['consciousness', 'evolution', 'theory', 'psychedelic', 'mushroom', 'human development']
        
        for msg in mckenna_messages:
            msg_lower = msg.lower()
            if any(indicator in msg_lower for indicator in expertise_indicators):
                mckenna_shows_expertise = True
                break
        
        vocabulary_pass = len(beavis_violations) == 0 and mckenna_shows_expertise
        
        details = f"Beavis violations: {len(beavis_violations)}, McKenna expertise: {mckenna_shows_expertise}"
        if beavis_violations:
            details += f" | Violations: {beavis_violations[:2]}"  # Show first 2 violations
            
        self.log_result("Vocabulary Consistency", vocabulary_pass, details)
        
        return vocabulary_pass
    
    def run_all_tests(self) -> bool:
        """Run the complete character containment test suite"""
        print("🎯 CRITICAL CHARACTER CONTAINMENT TESTING")
        print("=" * 60)
        print("Testing if personas stay in character and respect knowledge boundaries")
        print("Scenario: 'Dumb' (Beavis) vs 'Expert' (Terence McKenna) persona knowledge test")
        print("=" * 60)
        
        # Setup phase
        if not self.setup_guest_session():
            return False
            
        if not self.find_test_personas():
            return False
            
        if not self.create_test_conversation():
            return False
        
        # Core tests
        test1_pass = self.test_complex_topic_introduction()
        time.sleep(2)  # Brief pause between tests
        
        test2_pass = self.test_persona_to_persona_discussion()
        time.sleep(2)
        
        test3_pass = self.test_direct_question_to_beavis()
        time.sleep(1)
        
        test4_pass = self.test_vocabulary_consistency()
        
        # Final assessment
        all_tests_passed = test1_pass and test2_pass and test3_pass and test4_pass
        
        print("\n" + "=" * 60)
        print("📊 CHARACTER CONTAINMENT TEST RESULTS")
        print("=" * 60)
        
        for result in self.test_results:
            status = "✅ PASS" if result['passed'] else "❌ FAIL"
            print(f"{status}: {result['test']}")
            if result['details']:
                print(f"   └─ {result['details']}")
        
        print(f"\n🎯 OVERALL VERDICT: {'✅ CHARACTER CONTAINMENT WORKING' if all_tests_passed else '❌ CHARACTER CONTAINMENT FAILED'}")
        
        if not all_tests_passed:
            print("\n🚨 CRITICAL ISSUES FOUND:")
            print("   - Personas are not maintaining proper character boundaries")
            print("   - Knowledge leakage detected between persona types")
            print("   - Aggressive character containment prompts may need adjustment")
        
        return all_tests_passed

def main():
    """Main test execution"""
    tester = CharacterContainmentTester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️ Test interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Test failed with exception: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())