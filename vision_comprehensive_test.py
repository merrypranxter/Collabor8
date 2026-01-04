#!/usr/bin/env python3
"""
Comprehensive Vision Testing for Collabor8
Tests the corrected GPT-4o vision implementation
"""

import requests
import base64
import io
import json
from PIL import Image, ImageDraw, ImageFont
import time

class VisionTester:
    def __init__(self):
        self.base_url = "https://multiverse-chat-1.preview.emergentagent.com"
        self.api_url = f"{self.base_url}/api"
        self.conversation_id = None
        self.test_results = []

    def create_detailed_test_image(self, text="VISION TEST", shapes=True):
        """Create a detailed test image with text and shapes"""
        img = Image.new('RGB', (300, 200), color='lightblue')
        draw = ImageDraw.Draw(img)
        
        # Add text
        try:
            font = ImageFont.load_default()
        except:
            font = None
        
        draw.text((20, 20), text, fill='black', font=font)
        
        if shapes:
            # Add shapes for better vision testing
            draw.rectangle([20, 60, 80, 100], fill='red', outline='black')
            draw.ellipse([100, 60, 160, 100], fill='green', outline='black')
            draw.polygon([(180, 60), (220, 60), (200, 100)], fill='yellow', outline='black')
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        img_data = buffer.getvalue()
        return base64.b64encode(img_data).decode('utf-8')

    def setup_conversation(self):
        """Setup a test conversation"""
        # Get personas
        response = requests.get(f"{self.api_url}/personas")
        if response.status_code != 200:
            raise Exception("Failed to get personas")
        
        personas = response.json()
        if len(personas) < 2:
            raise Exception("Need at least 2 personas for testing")
        
        # Create conversation
        conv_data = {
            "mode": "Creativity Collaboration",
            "topic": "Vision Testing",
            "active_personas": [p['id'] for p in personas[:2]]
        }
        
        response = requests.post(f"{self.api_url}/conversations", json=conv_data)
        if response.status_code != 200:
            raise Exception("Failed to create conversation")
        
        self.conversation_id = response.json()['id']
        print(f"✅ Created conversation: {self.conversation_id}")

    def test_vision_with_text(self):
        """Test vision with text recognition"""
        print("\n🔍 Testing Vision with Text Recognition...")
        
        image_b64 = self.create_detailed_test_image("CAN YOU READ THIS?", shapes=False)
        
        data = {
            "conversation_id": self.conversation_id,
            "user_message": "What text do you see in this image? Please read it exactly.",
            "attachments": [{
                "type": "image",
                "name": "text_test.png",
                "data": f"data:image/png;base64,{image_b64}",
                "description": "Text recognition test"
            }]
        }
        
        response = requests.post(f"{self.api_url}/chat/generate-multi", json=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            responses = result.get('responses', [])
            
            text_recognized = False
            for resp in responses:
                content = resp.get('content', '').upper()
                if 'CAN YOU READ THIS' in content or 'READ THIS' in content:
                    text_recognized = True
                    print(f"✅ Text recognized by {resp.get('persona_name')}")
                    print(f"   Response: {resp.get('content', '')[:100]}...")
                    break
            
            if not text_recognized:
                print("❌ Text not recognized in responses")
                for resp in responses:
                    print(f"   {resp.get('persona_name')}: {resp.get('content', '')[:100]}...")
                return False
            
            return True
        else:
            print(f"❌ Request failed: {response.status_code}")
            return False

    def test_vision_with_shapes(self):
        """Test vision with shape recognition"""
        print("\n🔍 Testing Vision with Shape Recognition...")
        
        image_b64 = self.create_detailed_test_image("SHAPES", shapes=True)
        
        data = {
            "conversation_id": self.conversation_id,
            "user_message": "What shapes and colors do you see in this image? Describe them.",
            "attachments": [{
                "type": "image",
                "name": "shapes_test.png",
                "data": f"data:image/png;base64,{image_b64}",
                "description": "Shape recognition test"
            }]
        }
        
        response = requests.post(f"{self.api_url}/chat/generate-multi", json=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            responses = result.get('responses', [])
            
            shape_keywords = ['rectangle', 'circle', 'triangle', 'red', 'green', 'yellow', 'shape']
            shapes_recognized = False
            
            for resp in responses:
                content = resp.get('content', '').lower()
                if any(keyword in content for keyword in shape_keywords):
                    shapes_recognized = True
                    print(f"✅ Shapes recognized by {resp.get('persona_name')}")
                    print(f"   Response: {resp.get('content', '')[:150]}...")
                    break
            
            if not shapes_recognized:
                print("❌ Shapes not recognized in responses")
                for resp in responses:
                    print(f"   {resp.get('persona_name')}: {resp.get('content', '')[:100]}...")
                return False
            
            return True
        else:
            print(f"❌ Request failed: {response.status_code}")
            return False

    def test_multiple_images(self):
        """Test multiple image upload"""
        print("\n🔍 Testing Multiple Image Upload...")
        
        image1_b64 = self.create_detailed_test_image("IMAGE 1", shapes=False)
        image2_b64 = self.create_detailed_test_image("IMAGE 2", shapes=True)
        
        data = {
            "conversation_id": self.conversation_id,
            "user_message": "I've uploaded two images. Can you see both? What's different about them?",
            "attachments": [
                {
                    "type": "image",
                    "name": "image1.png",
                    "data": f"data:image/png;base64,{image1_b64}",
                    "description": "First image"
                },
                {
                    "type": "image",
                    "name": "image2.png", 
                    "data": f"data:image/png;base64,{image2_b64}",
                    "description": "Second image"
                }
            ]
        }
        
        response = requests.post(f"{self.api_url}/chat/generate-multi", json=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            responses = result.get('responses', [])
            
            multiple_images_detected = False
            for resp in responses:
                content = resp.get('content', '').lower()
                if ('two' in content or 'both' in content or 'multiple' in content) and 'image' in content:
                    multiple_images_detected = True
                    print(f"✅ Multiple images detected by {resp.get('persona_name')}")
                    print(f"   Response: {resp.get('content', '')[:150]}...")
                    break
            
            if not multiple_images_detected:
                print("❌ Multiple images not properly detected")
                for resp in responses:
                    print(f"   {resp.get('persona_name')}: {resp.get('content', '')[:100]}...")
                return False
            
            return True
        else:
            print(f"❌ Request failed: {response.status_code}")
            return False

    def test_no_image_fallback(self):
        """Test that non-image messages still work (should use GPT-5.2)"""
        print("\n🔍 Testing Non-Image Message (GPT-5.2 fallback)...")
        
        data = {
            "conversation_id": self.conversation_id,
            "user_message": "Hello! This is a message without any images. How are you doing?",
            "attachments": []
        }
        
        response = requests.post(f"{self.api_url}/chat/generate-multi", json=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            responses = result.get('responses', [])
            
            if len(responses) > 0:
                print(f"✅ Non-image chat working")
                for resp in responses:
                    print(f"   {resp.get('persona_name')}: {resp.get('content', '')[:100]}...")
                return True
            else:
                print("❌ No responses generated")
                return False
        else:
            print(f"❌ Request failed: {response.status_code}")
            return False

    def run_all_tests(self):
        """Run all vision tests"""
        print("🚀 Starting Comprehensive Vision Tests")
        print("=" * 60)
        
        try:
            self.setup_conversation()
            
            tests = [
                ("Vision Text Recognition", self.test_vision_with_text),
                ("Vision Shape Recognition", self.test_vision_with_shapes),
                ("Multiple Image Upload", self.test_multiple_images),
                ("Non-Image Fallback", self.test_no_image_fallback)
            ]
            
            passed = 0
            total = len(tests)
            
            for test_name, test_func in tests:
                try:
                    if test_func():
                        passed += 1
                        self.test_results.append(f"✅ {test_name}")
                    else:
                        self.test_results.append(f"❌ {test_name}")
                except Exception as e:
                    print(f"❌ {test_name} failed with exception: {str(e)}")
                    self.test_results.append(f"❌ {test_name} (Exception: {str(e)})")
                
                time.sleep(2)  # Brief pause between tests
            
            print("\n" + "=" * 60)
            print("📊 COMPREHENSIVE VISION TEST RESULTS")
            print("=" * 60)
            
            for result in self.test_results:
                print(result)
            
            print(f"\n🎯 Overall: {passed}/{total} tests passed")
            
            if passed == total:
                print("🎉 ALL VISION TESTS PASSED! GPT-4o integration is working correctly.")
                return True
            else:
                print("⚠️  Some vision tests failed. Check the results above.")
                return False
                
        except Exception as e:
            print(f"❌ Test setup failed: {str(e)}")
            return False

if __name__ == "__main__":
    tester = VisionTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)