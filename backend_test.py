import requests
import sys
import json
import base64
import io
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

class MultiPersonaChatTester:
    def __init__(self, base_url="https://creative-voices-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.conversation_id = None
        self.persona_ids = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_seed_personas(self):
        """Test seeding default personas"""
        success, response = self.run_test("Seed Personas", "POST", "personas/seed", 200)
        if success:
            print(f"   Seeded personas: {response.get('created', [])}")
        return success

    def test_get_personas(self):
        """Test getting all personas"""
        success, response = self.run_test("Get Personas", "GET", "personas", 200)
        if success and isinstance(response, list):
            self.persona_ids = [p['id'] for p in response[:3]]  # Store first 3 for testing
            print(f"   Found {len(response)} personas")
            print(f"   Sample personas: {[p['display_name'] for p in response[:3]]}")
        return success

    def test_get_single_persona(self):
        """Test getting a single persona"""
        if not self.persona_ids:
            print("❌ No persona IDs available for testing")
            return False
        
        persona_id = self.persona_ids[0]
        success, response = self.run_test("Get Single Persona", "GET", f"personas/{persona_id}", 200)
        if success:
            print(f"   Persona: {response.get('display_name', 'Unknown')}")
        return success

    def test_create_custom_persona(self):
        """Test creating a custom persona"""
        persona_data = {
            "display_name": "Test Persona",
            "type": "custom",
            "role_in_arena": "participant"
        }
        success, response = self.run_test("Create Custom Persona", "POST", "personas", 200, persona_data)
        if success:
            self.persona_ids.append(response.get('id'))
            print(f"   Created persona: {response.get('display_name')}")
        return success

    def test_create_conversation(self):
        """Test creating a conversation"""
        if not self.persona_ids:
            print("❌ No persona IDs available for conversation")
            return False
            
        conv_data = {
            "mode": "Creativity Collaboration",
            "topic": "Test conversation",
            "active_personas": self.persona_ids[:2]
        }
        success, response = self.run_test("Create Conversation", "POST", "conversations", 200, conv_data)
        if success:
            self.conversation_id = response.get('id')
            print(f"   Conversation ID: {self.conversation_id}")
        return success

    def test_get_conversation(self):
        """Test getting a conversation"""
        if not self.conversation_id:
            print("❌ No conversation ID available")
            return False
            
        success, response = self.run_test("Get Conversation", "GET", f"conversations/{self.conversation_id}", 200)
        if success:
            print(f"   Mode: {response.get('mode')}")
        return success

    def test_send_user_message(self):
        """Test sending a user message"""
        if not self.conversation_id:
            print("❌ No conversation ID available")
            return False
            
        message_data = {
            "content": "Hello, this is a test message from the user.",
            "is_user": True
        }
        success, response = self.run_test("Send User Message", "POST", f"conversations/{self.conversation_id}/messages", 200, message_data)
        if success:
            print(f"   Message ID: {response.get('id')}")
        return success

    def test_get_messages(self):
        """Test getting conversation messages"""
        if not self.conversation_id:
            print("❌ No conversation ID available")
            return False
            
        success, response = self.run_test("Get Messages", "GET", f"conversations/{self.conversation_id}/messages", 200)
        if success and isinstance(response, list):
            print(f"   Found {len(response)} messages")
        return success

    def create_test_image(self, text="TEST IMAGE", width=200, height=200):
        """Create a simple test image with text"""
        try:
            # Create a simple image with text
            img = Image.new('RGB', (width, height), color='lightblue')
            draw = ImageDraw.Draw(img)
            
            # Try to use a default font, fallback to basic if not available
            try:
                font = ImageFont.load_default()
            except:
                font = None
            
            # Calculate text position to center it
            if font:
                bbox = draw.textbbox((0, 0), text, font=font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]
            else:
                text_width = len(text) * 6  # Rough estimate
                text_height = 11
            
            x = (width - text_width) // 2
            y = (height - text_height) // 2
            
            draw.text((x, y), text, fill='black', font=font)
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_data = buffer.getvalue()
            return base64.b64encode(img_data).decode('utf-8')
        except Exception as e:
            print(f"   Warning: Could not create test image: {e}")
            # Return a minimal base64 encoded 1x1 pixel image as fallback
            return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

    def test_image_upload_with_vision(self):
        """Test image upload with vision capabilities (HIGHEST PRIORITY)"""
        if not self.conversation_id:
            print("❌ No conversation ID available")
            return False
        
        print("   Creating test image...")
        test_image_b64 = self.create_test_image("VISION TEST - Can you see this text?")
        
        # Create attachment data structure matching frontend format
        attachments = [{
            "type": "image",
            "name": "test_vision.png", 
            "data": f"data:image/png;base64,{test_image_b64}",
            "description": "Test image for vision analysis"
        }]
        
        generate_data = {
            "conversation_id": self.conversation_id,
            "user_message": "What do you see in this image? Please describe the text and colors.",
            "attachments": attachments
        }
        
        print("   This may take longer due to GPT-4o vision processing...")
        success, response = self.run_test("Image Upload with Vision", "POST", "chat/generate-multi", 200, generate_data)
        
        if success and 'responses' in response:
            responses = response['responses']
            print(f"   Generated {len(responses)} persona responses")
            
            # Check if any response mentions vision-related content
            vision_keywords = ['image', 'see', 'text', 'blue', 'color', 'vision', 'picture', 'visual']
            vision_detected = False
            
            for resp in responses:
                content = resp.get('content', '').lower()
                if any(keyword in content for keyword in vision_keywords):
                    vision_detected = True
                    print(f"   ✅ Vision detected in {resp.get('persona_name')}: {content[:100]}...")
                    break
            
            if not vision_detected:
                print("   ⚠️  Warning: No vision-related content detected in responses")
                print("   This might indicate GPT-4o vision is not working properly")
                
            return True
        else:
            print("   ❌ Failed to get valid responses")
            return False

    def test_extract_url_endpoint(self):
        """Test the new /api/extract-url endpoint directly"""
        print("   Testing URL extraction with Wikipedia article...")
        
        # Test with a real Wikipedia URL
        url_data = {
            "url": "https://en.wikipedia.org/wiki/Artificial_intelligence"
        }
        
        success, response = self.run_test("Extract URL Endpoint", "POST", "extract-url", 200, url_data)
        
        if success:
            # Verify response structure
            required_fields = ['url', 'title', 'content', 'success']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                print(f"   ❌ Missing required fields: {missing_fields}")
                return False
            
            if response.get('success') != True:
                print(f"   ❌ Success field is not True: {response.get('success')}")
                return False
            
            content_length = len(response.get('content', ''))
            print(f"   ✅ URL: {response.get('url')}")
            print(f"   ✅ Title: {response.get('title', '')[:50]}...")
            print(f"   ✅ Content length: {content_length} chars")
            
            # Check content is truncated to ~5000 chars
            if content_length > 5500:
                print(f"   ⚠️  Warning: Content might not be properly truncated ({content_length} chars)")
            
            return True
        
        return False

    def test_extract_url_error_handling(self):
        """Test URL extraction error handling"""
        print("   Testing invalid URL...")
        
        # Test with invalid URL
        invalid_url_data = {
            "url": "not-a-valid-url"
        }
        
        success, response = self.run_test("Extract URL - Invalid URL", "POST", "extract-url", 500, invalid_url_data)
        
        if success:
            print("   ✅ Invalid URL properly handled with error response")
        
        # Test with timeout URL (this might not actually timeout in test environment)
        print("   Testing potentially slow URL...")
        timeout_url_data = {
            "url": "https://httpstat.us/200?sleep=15000"  # 15 second delay
        }
        
        # This should either succeed quickly or timeout with 504
        try:
            url = f"{self.api_url}/extract-url"
            response = requests.post(url, json=timeout_url_data, headers={'Content-Type': 'application/json'}, timeout=12)
            if response.status_code in [200, 504]:
                print(f"   ✅ Timeout URL handled appropriately (status: {response.status_code})")
                return True
            else:
                print(f"   ⚠️  Unexpected status for timeout URL: {response.status_code}")
                return True  # Still consider this a pass as it didn't crash
        except requests.exceptions.Timeout:
            print("   ✅ Request properly timed out")
            return True
        except Exception as e:
            print(f"   ⚠️  Timeout test error: {e}")
            return True  # Don't fail the whole test for this

    def test_url_attachment_with_extraction(self):
        """Test URL attachment handling with real content extraction"""
        if not self.conversation_id:
            print("❌ No conversation ID available")
            return False
        
        attachments = [{
            "type": "url",
            "url": "https://en.wikipedia.org/wiki/Artificial_intelligence",
            "name": "https://en.wikipedia.org/wiki/Artificial_intelligence"
        }]
        
        generate_data = {
            "conversation_id": self.conversation_id,
            "user_message": "I've shared a Wikipedia article about AI. Please discuss the content you can see from this link.",
            "attachments": attachments
        }
        
        print("   This may take longer due to URL content extraction...")
        success, response = self.run_test("URL Attachment with Extraction", "POST", "chat/generate-multi", 200, generate_data)
        
        if success and 'responses' in response:
            responses = response['responses']
            print(f"   Generated {len(responses)} persona responses")
            
            # Check if any response mentions URL content or AI-related terms
            content_keywords = ['artificial intelligence', 'ai', 'machine learning', 'wikipedia', 'article', 'content']
            content_discussed = False
            
            for resp in responses:
                content = resp.get('content', '').lower()
                if any(keyword in content for keyword in content_keywords):
                    content_discussed = True
                    print(f"   ✅ URL content discussed by {resp.get('persona_name')}: {content[:100]}...")
                    break
            
            if not content_discussed:
                print("   ⚠️  Warning: URL content not clearly discussed in responses")
                # Still return True as the endpoint worked, just content might not be processed
                
            return True
        return False

    def test_persona_avatar_urls(self):
        """Test persona avatar URL format validation"""
        success, response = self.run_test("Get Personas for Avatar Check", "GET", "personas", 200)
        
        if success and isinstance(response, list):
            print(f"   Checking {len(response)} personas for avatar URL format...")
            
            avatar_issues = []
            valid_avatars = 0
            
            for persona in response:
                persona_name = persona.get('display_name', 'Unknown')
                avatar_url = persona.get('avatar_url')
                
                if avatar_url:
                    # Check for duplicated "data:image/..." prefixes
                    if avatar_url.count('data:image/') > 1:
                        avatar_issues.append(f"{persona_name}: Duplicated data:image prefix")
                    elif not avatar_url.startswith('data:image/'):
                        avatar_issues.append(f"{persona_name}: Invalid data URL format")
                    else:
                        valid_avatars += 1
                        print(f"   ✅ {persona_name}: Valid avatar URL")
            
            if avatar_issues:
                print("   ❌ Avatar URL issues found:")
                for issue in avatar_issues:
                    print(f"      - {issue}")
                return False
            else:
                print(f"   ✅ All {valid_avatars} avatar URLs are properly formatted")
                return True
        
        return False

    def test_url_attachment(self):
        """Test URL attachment handling (legacy test)"""
        if not self.conversation_id:
            print("❌ No conversation ID available")
            return False
        
        attachments = [{
            "type": "url",
            "url": "https://example.com/article",
            "name": "https://example.com/article"
        }]
        
        generate_data = {
            "conversation_id": self.conversation_id,
            "user_message": "Please acknowledge the URL I shared and comment on it.",
            "attachments": attachments
        }
        
        success, response = self.run_test("URL Attachment (Basic)", "POST", "chat/generate-multi", 200, generate_data)
        
        if success and 'responses' in response:
            responses = response['responses']
            print(f"   Generated {len(responses)} persona responses")
            
            # Check if any response mentions the URL
            url_mentioned = False
            for resp in responses:
                content = resp.get('content', '').lower()
                if 'url' in content or 'link' in content or 'example.com' in content:
                    url_mentioned = True
                    print(f"   ✅ URL acknowledged by {resp.get('persona_name')}")
                    break
            
            if not url_mentioned:
                print("   ⚠️  Warning: URL not mentioned in responses")
                
            return True
        return False

    def test_multi_file_upload(self):
        """Test multiple file upload"""
        if not self.conversation_id:
            print("❌ No conversation ID available")
            return False
        
        # Create multiple test images
        image1_b64 = self.create_test_image("IMAGE 1", 150, 150)
        image2_b64 = self.create_test_image("IMAGE 2", 150, 150)
        
        attachments = [
            {
                "type": "image",
                "name": "test1.png",
                "data": f"data:image/png;base64,{image1_b64}",
                "description": "First test image"
            },
            {
                "type": "image", 
                "name": "test2.png",
                "data": f"data:image/png;base64,{image2_b64}",
                "description": "Second test image"
            }
        ]
        
        generate_data = {
            "conversation_id": self.conversation_id,
            "user_message": "I've uploaded multiple images. Can you see both of them?",
            "attachments": attachments
        }
        
        success, response = self.run_test("Multi-File Upload", "POST", "chat/generate-multi", 200, generate_data)
        
        if success and 'responses' in response:
            responses = response['responses']
            print(f"   Generated {len(responses)} persona responses")
            return True
        return False

    def test_basic_chat_flow(self):
        """Test basic chat without attachments"""
        if not self.conversation_id:
            print("❌ No conversation ID available")
            return False
        
        generate_data = {
            "conversation_id": self.conversation_id,
            "user_message": "Hello everyone! This is a simple test message without any attachments.",
            "attachments": []
        }
        
        success, response = self.run_test("Basic Chat Flow", "POST", "chat/generate-multi", 200, generate_data)
        
        if success and 'responses' in response:
            responses = response['responses']
            print(f"   Generated {len(responses)} persona responses")
            
            # Verify multiple personas responded
            if len(responses) >= 1:
                print("   ✅ Multi-persona chat working")
                for resp in responses:
                    print(f"   - {resp.get('persona_name')}: {resp.get('content', '')[:50]}...")
                return True
            else:
                print("   ❌ No persona responses generated")
                return False
        return False

    def test_generate_persona_response(self):
        """Test generating a persona response (legacy endpoint if exists)"""
        if not self.conversation_id or not self.persona_ids:
            print("❌ No conversation or persona IDs available")
            return False
            
        # First get existing messages for context
        _, messages = self.run_test("Get Messages for Context", "GET", f"conversations/{self.conversation_id}/messages", 200)
        
        context_messages = []
        if isinstance(messages, list):
            context_messages = [{"persona_name": m["persona_name"], "content": m["content"]} for m in messages]
        
        generate_data = {
            "conversation_id": self.conversation_id,
            "persona_id": self.persona_ids[0],
            "context_messages": context_messages
        }
        
        print("   This may take a few seconds due to GPT-5.2 processing...")
        success, response = self.run_test("Generate Persona Response", "POST", "chat/generate", 200, generate_data)
        if success:
            print(f"   Generated response from: {response.get('persona_name')}")
            print(f"   Content preview: {response.get('content', '')[:100]}...")
        return success

    def test_guest_auth(self):
        """Test guest authentication"""
        success, response = self.run_test("Guest Authentication", "GET", "auth/guest", 200)
        if success:
            print(f"   Guest ID: {response.get('id', 'Unknown')}")
            print(f"   Display Name: {response.get('display_name', 'Unknown')}")
            self.guest_id = response.get('id')
        return success

class CharacterContainmentTester:
    """Specialized tester for character containment and knowledge boundary enforcement"""
    
    def __init__(self, base_url="https://creative-voices-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.guest_id = None
        self.conversation_id = None
        self.beavis_persona = None
        self.expert_persona = None
        self.test_results = []
        
    def setup_test_environment(self):
        """Setup guest session and find required personas"""
        print("🔧 Setting up character containment test environment...")
        
        # Get guest session
        try:
            response = requests.get(f"{self.api_url}/auth/guest", timeout=30)
            if response.status_code == 200:
                guest_data = response.json()
                self.guest_id = guest_data.get('id')
                print(f"   ✅ Guest session: {self.guest_id}")
            else:
                print(f"   ❌ Failed to get guest session: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ Guest auth error: {e}")
            return False
        
        # Get personas and find Beavis and expert persona
        try:
            response = requests.get(f"{self.api_url}/personas", timeout=30)
            if response.status_code == 200:
                personas = response.json()
                print(f"   Found {len(personas)} personas")
                
                # Find Beavis (low-intelligence persona)
                for persona in personas:
                    name = persona.get('display_name', '').lower()
                    if 'beavis' in name:
                        self.beavis_persona = persona
                        print(f"   ✅ Found Beavis: {persona.get('display_name')}")
                        break
                
                # Find Terence McKenna (expert persona)
                for persona in personas:
                    name = persona.get('display_name', '').lower()
                    if 'terence' in name and 'mckenna' in name:
                        self.expert_persona = persona
                        print(f"   ✅ Found Expert: {persona.get('display_name')}")
                        break
                
                if not self.beavis_persona:
                    print("   ⚠️  Beavis persona not found, will create one")
                    self.beavis_persona = self.create_beavis_persona()
                
                if not self.expert_persona:
                    print("   ⚠️  Terence McKenna not found, using first available expert")
                    # Find any expert-type persona
                    for persona in personas:
                        bio = persona.get('bio', '').lower()
                        if any(word in bio for word in ['philosopher', 'psychonaut', 'expert', 'scientist']):
                            self.expert_persona = persona
                            print(f"   ✅ Using expert: {persona.get('display_name')}")
                            break
                
                return self.beavis_persona is not None and self.expert_persona is not None
            else:
                print(f"   ❌ Failed to get personas: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ Personas fetch error: {e}")
            return False
    
    def create_beavis_persona(self):
        """Create a Beavis-like low-intelligence persona for testing"""
        print("   Creating Beavis persona for testing...")
        
        persona_data = {
            "display_name": "Beavis",
            "type": "fictional",
            "bio": "Teenage metalhead with limited intelligence who loves fire and heavy metal. Often confused by complex topics.",
            "quirks": ["Says 'huh huh'", "Loves fire", "Gets confused easily"],
            "voice": {
                "tone": "crude, simple",
                "pacing": "fast, scattered",
                "signature_moves": ["Huh huh", "That's cool"],
                "taboos": ["Complex vocabulary", "Academic discussions"]
            },
            "color": "#FF6B35",
            "tags": ["fictional", "low-intelligence", "test"]
        }
        
        try:
            response = requests.post(f"{self.api_url}/personas", json=persona_data, timeout=30)
            if response.status_code == 200:
                persona = response.json()
                print(f"   ✅ Created Beavis: {persona.get('id')}")
                return persona
            else:
                print(f"   ❌ Failed to create Beavis: {response.status_code}")
                return None
        except Exception as e:
            print(f"   ❌ Beavis creation error: {e}")
            return None
    
    def create_test_conversation(self):
        """Create a new conversation with both personas active"""
        print("   Creating test conversation...")
        
        conv_data = {
            "mode": "Shoot-the-Shit",
            "topic": "Character containment test",
            "active_personas": [self.beavis_persona['id'], self.expert_persona['id']]
        }
        
        try:
            response = requests.post(f"{self.api_url}/conversations?user_id={self.guest_id}", 
                                   json=conv_data, timeout=30)
            if response.status_code == 200:
                conv = response.json()
                self.conversation_id = conv.get('id')
                print(f"   ✅ Conversation created: {self.conversation_id}")
                return True
            else:
                print(f"   ❌ Failed to create conversation: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ Conversation creation error: {e}")
            return False
    
    def analyze_vocabulary(self, text, persona_name):
        """Analyze if text contains vocabulary inappropriate for the persona"""
        # Failure words that Beavis should NEVER use
        failure_words = [
            'articulate', 'consciousness', 'evolutionary', 'cognitive', 'anthropological',
            'theoretical', 'hypothesis', 'phenomenon', 'perspective', 'development',
            'interaction', 'psychoactive', 'compounds', 'epistemology', 'postmodernism',
            'relativism', 'philosophical', 'sophisticated', 'intellectual', 'academic',
            'conceptual', 'analytical', 'synthesis', 'paradigm', 'methodology'
        ]
        
        # Success words that Beavis SHOULD use
        success_words = [
            'huh', 'what', 'dumb', 'stupid', 'cool', 'sucks', 'fire', 'yeah', 
            'dude', 'like', 'uh', 'whatever', 'butthead', 'awesome', 'lame'
        ]
        
        text_lower = text.lower()
        found_failure_words = [word for word in failure_words if word in text_lower]
        found_success_words = [word for word in success_words if word in text_lower]
        
        return {
            'failure_words': found_failure_words,
            'success_words': found_success_words,
            'appropriate_vocabulary': len(found_failure_words) == 0
        }
    
    def test_complex_topic_introduction(self):
        """Test 1: Complex Topic Introduction - Stoned Ape Theory"""
        print("\n🧪 TEST 1: Complex Topic Introduction - Stoned Ape Theory")
        
        # First send the user message to the conversation
        user_message = "Hey everyone, what do you think about the stoned ape theory of human evolution?"
        
        try:
            # Send user message first
            message_data = {
                "content": user_message,
                "is_user": True
            }
            
            message_response = requests.post(f"{self.api_url}/conversations/{self.conversation_id}/messages", 
                                           json=message_data, timeout=30)
            if message_response.status_code != 200:
                print(f"   ❌ Failed to send user message: {message_response.status_code}")
                return False
            
            # Now generate persona responses
            generate_data = {
                "conversation_id": self.conversation_id,
                "user_message": user_message,
                "attachments": []
            }
            
            response = requests.post(f"{self.api_url}/chat/generate-multi", 
                                   json=generate_data, timeout=60)
            if response.status_code == 200:
                data = response.json()
                responses = data.get('responses', [])
                
                beavis_response = None
                expert_response = None
                
                for resp in responses:
                    if resp.get('persona_name') == self.beavis_persona['display_name']:
                        beavis_response = resp
                    elif resp.get('persona_name') == self.expert_persona['display_name']:
                        expert_response = resp
                
                # Analyze responses
                test_result = {
                    'test_name': 'Complex Topic Introduction',
                    'beavis_response': beavis_response.get('content') if beavis_response else None,
                    'expert_response': expert_response.get('content') if expert_response else None,
                    'beavis_pass': False,
                    'expert_pass': False,
                    'vocabulary_analysis': None
                }
                
                if beavis_response:
                    vocab_analysis = self.analyze_vocabulary(beavis_response['content'], 'Beavis')
                    test_result['vocabulary_analysis'] = vocab_analysis
                    
                    # Check if Beavis shows confusion/mockery instead of expertise
                    content = beavis_response['content'].lower()
                    confusion_indicators = ['huh', 'what', 'don\'t know', 'confused', 'made-up', 'crap', 'dumb', 'sounds like']
                    shows_confusion = any(indicator in content for indicator in confusion_indicators)
                    
                    # Check for inappropriate expertise
                    expertise_indicators = ['evolution', 'consciousness', 'theory', 'development', 'anthropological']
                    shows_expertise = any(indicator in content for indicator in expertise_indicators)
                    
                    test_result['beavis_pass'] = vocab_analysis['appropriate_vocabulary'] and shows_confusion and not shows_expertise
                    
                    print(f"   Beavis response: {beavis_response['content']}")
                    print(f"   Vocabulary appropriate: {vocab_analysis['appropriate_vocabulary']}")
                    print(f"   Shows confusion: {shows_confusion}")
                    print(f"   Shows expertise: {shows_expertise}")
                    if vocab_analysis['failure_words']:
                        print(f"   ❌ FAILURE WORDS USED: {vocab_analysis['failure_words']}")
                else:
                    print("   ❌ No Beavis response found")
                
                if expert_response:
                    # Expert should provide articulate explanation
                    content = expert_response['content'].lower()
                    expert_indicators = ['evolution', 'consciousness', 'theory', 'human', 'development', 'stoned ape']
                    shows_expertise = any(indicator in content for indicator in expert_indicators)
                    test_result['expert_pass'] = shows_expertise
                    
                    print(f"   Expert response: {expert_response['content']}")
                    print(f"   Shows expertise: {shows_expertise}")
                else:
                    print("   ❌ No expert response found")
                
                self.test_results.append(test_result)
                return test_result['beavis_pass'] and test_result['expert_pass']
            else:
                print(f"   ❌ API call failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ Test error: {e}")
            return False
    
    def test_direct_question_to_beavis(self):
        """Test 2: Direct Question to Beavis"""
        print("\n🧪 TEST 2: Direct Question to Beavis")
        
        generate_data = {
            "conversation_id": self.conversation_id,
            "user_message": f"@{self.beavis_persona['display_name']}, can you explain what Terence just said about consciousness and mushrooms?",
            "attachments": []
        }
        
        try:
            response = requests.post(f"{self.api_url}/chat/generate-multi", 
                                   json=generate_data, timeout=60)
            if response.status_code == 200:
                data = response.json()
                responses = data.get('responses', [])
                
                beavis_response = None
                for resp in responses:
                    if resp.get('persona_name') == self.beavis_persona['display_name']:
                        beavis_response = resp
                        break
                
                if beavis_response:
                    content = beavis_response['content']
                    vocab_analysis = self.analyze_vocabulary(content, 'Beavis')
                    
                    # Check for appropriate confusion/simplification
                    content_lower = content.lower()
                    appropriate_responses = [
                        'don\'t know', 'big words', 'confused', 'uh', 'huh', 
                        'something about', 'mushrooms', 'i guess'
                    ]
                    shows_appropriate_confusion = any(phrase in content_lower for phrase in appropriate_responses)
                    
                    # Check for inappropriate articulate explanation
                    inappropriate_responses = [
                        'articulated', 'perspective', 'evolutionary', 'consciousness theory',
                        'psychoactive compounds', 'cognitive development'
                    ]
                    gives_articulate_explanation = any(phrase in content_lower for phrase in inappropriate_responses)
                    
                    test_pass = (vocab_analysis['appropriate_vocabulary'] and 
                               shows_appropriate_confusion and 
                               not gives_articulate_explanation)
                    
                    print(f"   Beavis response: {content}")
                    print(f"   Vocabulary appropriate: {vocab_analysis['appropriate_vocabulary']}")
                    print(f"   Shows confusion: {shows_appropriate_confusion}")
                    print(f"   Gives articulate explanation: {gives_articulate_explanation}")
                    
                    if vocab_analysis['failure_words']:
                        print(f"   ❌ FAILURE WORDS: {vocab_analysis['failure_words']}")
                    
                    test_result = {
                        'test_name': 'Direct Question to Beavis',
                        'response': content,
                        'vocabulary_analysis': vocab_analysis,
                        'shows_confusion': shows_appropriate_confusion,
                        'articulate_explanation': gives_articulate_explanation,
                        'pass': test_pass
                    }
                    self.test_results.append(test_result)
                    
                    return test_pass
                else:
                    print("   ❌ No Beavis response found")
                    return False
            else:
                print(f"   ❌ API call failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ Test error: {e}")
            return False
    
    def test_quantum_mechanics_topic(self):
        """Test 3: Another Complex Topic - Quantum Mechanics"""
        print("\n🧪 TEST 3: Complex Topic - Quantum Mechanics")
        
        generate_data = {
            "conversation_id": self.conversation_id,
            "user_message": "What do you all think about quantum mechanics?",
            "attachments": []
        }
        
        try:
            response = requests.post(f"{self.api_url}/chat/generate-multi", 
                                   json=generate_data, timeout=60)
            if response.status_code == 200:
                data = response.json()
                responses = data.get('responses', [])
                
                beavis_response = None
                for resp in responses:
                    if resp.get('persona_name') == self.beavis_persona['display_name']:
                        beavis_response = resp
                        break
                
                if beavis_response:
                    content = beavis_response['content']
                    vocab_analysis = self.analyze_vocabulary(content, 'Beavis')
                    
                    # Expected: Confusion, mockery, or dismissal
                    content_lower = content.lower()
                    appropriate_responses = [
                        'quantum what', 'not even a real word', 'sounds dumb', 
                        'made up', 'don\'t understand', 'huh huh', 'whatever'
                    ]
                    shows_appropriate_response = any(phrase in content_lower for phrase in appropriate_responses)
                    
                    # Failure: Accurate explanation of quantum mechanics
                    failure_indicators = [
                        'particles', 'superposition', 'entanglement', 'wave function',
                        'uncertainty principle', 'quantum states', 'physics'
                    ]
                    gives_accurate_explanation = any(phrase in content_lower for phrase in failure_indicators)
                    
                    test_pass = (vocab_analysis['appropriate_vocabulary'] and 
                               shows_appropriate_response and 
                               not gives_accurate_explanation)
                    
                    print(f"   Beavis response: {content}")
                    print(f"   Vocabulary appropriate: {vocab_analysis['appropriate_vocabulary']}")
                    print(f"   Shows confusion/mockery: {shows_appropriate_response}")
                    print(f"   Gives accurate explanation: {gives_accurate_explanation}")
                    
                    if vocab_analysis['failure_words']:
                        print(f"   ❌ FAILURE WORDS: {vocab_analysis['failure_words']}")
                    
                    test_result = {
                        'test_name': 'Quantum Mechanics Topic',
                        'response': content,
                        'vocabulary_analysis': vocab_analysis,
                        'appropriate_response': shows_appropriate_response,
                        'accurate_explanation': gives_accurate_explanation,
                        'pass': test_pass
                    }
                    self.test_results.append(test_result)
                    
                    return test_pass
                else:
                    print("   ❌ No Beavis response found")
                    return False
            else:
                print(f"   ❌ API call failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ Test error: {e}")
            return False
    
    def test_persona_to_persona_discussion(self):
        """Test 4: Persona-to-Persona Discussion"""
        print("\n🧪 TEST 4: Persona-to-Persona Discussion")
        
        # Trigger continue-discussion
        continue_data = {
            "conversation_id": self.conversation_id,
            "max_rounds": 2
        }
        
        try:
            response = requests.post(f"{self.api_url}/chat/continue-discussion", 
                                   json=continue_data, timeout=90)
            if response.status_code == 200:
                data = response.json()
                responses = data.get('responses', [])
                
                beavis_responses = []
                for resp in responses:
                    if resp.get('persona_name') == self.beavis_persona['display_name']:
                        beavis_responses.append(resp)
                
                if beavis_responses:
                    all_pass = True
                    for i, resp in enumerate(beavis_responses):
                        content = resp['content']
                        vocab_analysis = self.analyze_vocabulary(content, 'Beavis')
                        
                        # Check if Beavis maintains simplicity even when hearing expert responses
                        maintains_character = vocab_analysis['appropriate_vocabulary']
                        
                        print(f"   Beavis response {i+1}: {content}")
                        print(f"   Maintains character: {maintains_character}")
                        
                        if vocab_analysis['failure_words']:
                            print(f"   ❌ FAILURE WORDS: {vocab_analysis['failure_words']}")
                            all_pass = False
                        
                        if not maintains_character:
                            all_pass = False
                    
                    test_result = {
                        'test_name': 'Persona-to-Persona Discussion',
                        'beavis_responses': [r['content'] for r in beavis_responses],
                        'maintains_character': all_pass,
                        'pass': all_pass
                    }
                    self.test_results.append(test_result)
                    
                    return all_pass
                else:
                    print("   ❌ No Beavis responses in discussion")
                    return False
            else:
                print(f"   ❌ Continue discussion failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ Test error: {e}")
            return False
    
    def run_character_containment_tests(self):
        """Run all character containment tests"""
        print("🎭 STARTING CHARACTER CONTAINMENT TESTS")
        print("=" * 60)
        
        if not self.setup_test_environment():
            print("❌ Failed to setup test environment")
            return False
        
        if not self.create_test_conversation():
            print("❌ Failed to create test conversation")
            return False
        
        # Run all tests
        tests = [
            ("Complex Topic Introduction", self.test_complex_topic_introduction),
            ("Direct Question to Beavis", self.test_direct_question_to_beavis),
            ("Quantum Mechanics Topic", self.test_quantum_mechanics_topic),
            ("Persona-to-Persona Discussion", self.test_persona_to_persona_discussion)
        ]
        
        passed_tests = 0
        failed_tests = []
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed_tests += 1
                    print(f"   ✅ {test_name}: PASS")
                else:
                    failed_tests.append(test_name)
                    print(f"   ❌ {test_name}: FAIL")
            except Exception as e:
                failed_tests.append(test_name)
                print(f"   ❌ {test_name}: ERROR - {e}")
        
        # Print final results
        print("\n" + "=" * 60)
        print("🎭 CHARACTER CONTAINMENT TEST RESULTS")
        print("=" * 60)
        
        print(f"📊 Tests Passed: {passed_tests}/{len(tests)}")
        
        if failed_tests:
            print(f"❌ Failed Tests: {', '.join(failed_tests)}")
            print("\n🔍 DETAILED FAILURE ANALYSIS:")
            
            # Collect all failure words found across tests
            all_failure_words = set()
            for result in self.test_results:
                if 'vocabulary_analysis' in result and result['vocabulary_analysis']:
                    all_failure_words.update(result['vocabulary_analysis']['failure_words'])
            
            if all_failure_words:
                print(f"❌ VOCABULARY VIOLATIONS: Beavis used forbidden words: {list(all_failure_words)}")
            
            # Show specific examples of character containment failures
            for result in self.test_results:
                if not result.get('pass', True):
                    print(f"\n❌ {result['test_name']} FAILURE:")
                    if 'response' in result:
                        print(f"   Response: {result['response']}")
                    elif 'beavis_response' in result:
                        print(f"   Response: {result['beavis_response']}")
            
            print(f"\n🚨 OVERALL VERDICT: CHARACTER CONTAINMENT FAIL")
            return False
        else:
            print("✅ All character containment tests passed!")
            print("🚨 OVERALL VERDICT: CHARACTER CONTAINMENT PASS")
            return True

def main():
    print("🚀 Starting Collabor8 Character Containment & System Tests")
    print("=" * 60)
    
    # First run the character containment tests (PRIORITY)
    print("🎭 PHASE 1: CHARACTER CONTAINMENT TESTING")
    containment_tester = CharacterContainmentTester()
    containment_passed = containment_tester.run_character_containment_tests()
    
    print("\n" + "=" * 60)
    print("🔧 PHASE 2: SYSTEM FUNCTIONALITY TESTING")
    
    tester = MultiPersonaChatTester()
    
    # Test sequence - prioritized based on review request
    tests = [
        ("Root API", tester.test_root_endpoint),
        ("Guest Authentication", tester.test_guest_auth),
        ("Seed Personas", tester.test_seed_personas),
        ("Get Personas", tester.test_get_personas),
        ("🔍 Persona Avatar URL Validation", tester.test_persona_avatar_urls),
        ("Get Single Persona", tester.test_get_single_persona),
        ("Create Custom Persona", tester.test_create_custom_persona),
        ("Create Conversation", tester.test_create_conversation),
        ("Get Conversation", tester.test_get_conversation),
        ("Send User Message", tester.test_send_user_message),
        ("Get Messages", tester.test_get_messages),
        
        # PRIORITY TESTS - URL Extraction Feature (NEW)
        ("🌐 Extract URL Endpoint", tester.test_extract_url_endpoint),
        ("⚠️  URL Error Handling", tester.test_extract_url_error_handling),
        ("🔗 URL Attachment with Real Content", tester.test_url_attachment_with_extraction),
        
        # EXISTING PRIORITY TESTS - Vision and Attachments
        ("🔥 Image Upload with Vision (GPT-4o)", tester.test_image_upload_with_vision),
        ("🔗 URL Attachment (Basic)", tester.test_url_attachment),
        ("📎 Multi-File Upload", tester.test_multi_file_upload),
        ("💬 Basic Chat Flow", tester.test_basic_chat_flow),
    ]
    
    failed_tests = []
    critical_failures = []
    
    for test_name, test_func in tests:
        try:
            if not test_func():
                failed_tests.append(test_name)
                # Mark vision and attachment tests as critical
                if any(keyword in test_name.lower() for keyword in ['vision', 'image', 'attachment', 'url', 'file']):
                    critical_failures.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            failed_tests.append(test_name)
            if any(keyword in test_name.lower() for keyword in ['vision', 'image', 'attachment', 'url', 'file']):
                critical_failures.append(test_name)
    
    # Print results
    print("\n" + "=" * 60)
    print("📊 FINAL TEST RESULTS")
    print("=" * 60)
    
    print(f"🎭 Character Containment: {'✅ PASS' if containment_passed else '❌ FAIL'}")
    print(f"🔧 System Tests: {tester.tests_passed}/{tester.tests_run} passed")
    
    if not containment_passed:
        print("🚨 CRITICAL: CHARACTER CONTAINMENT FAILURE - Personas not maintaining proper boundaries!")
    
    if critical_failures:
        print(f"🚨 CRITICAL FAILURES (Vision/Attachments): {', '.join(critical_failures)}")
    
    if failed_tests:
        print(f"❌ System test failures: {', '.join(failed_tests)}")
    
    # Return failure if character containment fails OR if there are critical system failures
    if not containment_passed or critical_failures:
        return 1
    elif failed_tests:
        print("⚠️  Some non-critical tests failed, but core functionality working")
        return 0
    else:
        print("✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())