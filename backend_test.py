import requests
import sys
import json
import base64
import io
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

class MultiPersonaChatTester:
    def __init__(self, base_url="https://multiverse-chat-1.preview.emergentagent.com"):
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

    def test_url_attachment(self):
        """Test URL attachment handling"""
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
        
        success, response = self.run_test("URL Attachment", "POST", "chat/generate-multi", 200, generate_data)
        
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
        return success

def main():
    print("🚀 Starting Multi-Persona Chat Arena API Tests")
    print("=" * 60)
    
    tester = MultiPersonaChatTester()
    
    # Test sequence
    tests = [
        ("Root API", tester.test_root_endpoint),
        ("Seed Personas", tester.test_seed_personas),
        ("Get Personas", tester.test_get_personas),
        ("Get Single Persona", tester.test_get_single_persona),
        ("Create Custom Persona", tester.test_create_custom_persona),
        ("Create Conversation", tester.test_create_conversation),
        ("Get Conversation", tester.test_get_conversation),
        ("Send User Message", tester.test_send_user_message),
        ("Get Messages", tester.test_get_messages),
        ("Generate Persona Response", tester.test_generate_persona_response),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"❌ Failed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())