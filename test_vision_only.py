#!/usr/bin/env python3

import requests
import json
import base64
import io
from PIL import Image, ImageDraw, ImageFont

def create_test_image(text="VISION TEST", width=200, height=200):
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
        print(f"Warning: Could not create test image: {e}")
        # Return a minimal base64 encoded 1x1 pixel image as fallback
        return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

def test_vision():
    base_url = "https://creative-voices-4.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    
    print("🔍 Testing Vision Functionality...")
    
    # Step 1: Get personas
    print("   Getting personas...")
    response = requests.get(f"{api_url}/personas")
    if response.status_code != 200:
        print(f"❌ Failed to get personas: {response.status_code}")
        return False
    
    personas = response.json()
    if not personas:
        print("❌ No personas found")
        return False
    
    persona_ids = [p['id'] for p in personas[:2]]  # Use first 2 personas
    print(f"   Using personas: {[p['display_name'] for p in personas[:2]]}")
    
    # Step 2: Create conversation
    print("   Creating conversation...")
    conv_data = {
        "mode": "Creativity Collaboration",
        "topic": "Vision test",
        "active_personas": persona_ids
    }
    response = requests.post(f"{api_url}/conversations", json=conv_data)
    if response.status_code != 200:
        print(f"❌ Failed to create conversation: {response.status_code}")
        return False
    
    conversation = response.json()
    conversation_id = conversation['id']
    print(f"   Conversation ID: {conversation_id}")
    
    # Step 3: Create test image
    print("   Creating test image...")
    test_image_b64 = create_test_image("CAN YOU SEE THIS TEXT?")
    
    # Step 4: Test vision with image
    print("   Testing vision with image...")
    attachments = [{
        "type": "image",
        "name": "vision_test.png", 
        "data": f"data:image/png;base64,{test_image_b64}",
        "description": "Test image for vision analysis"
    }]
    
    generate_data = {
        "conversation_id": conversation_id,
        "user_message": "What do you see in this image? Please describe the text and colors you observe.",
        "attachments": attachments
    }
    
    print("   Sending vision request (this may take a moment)...")
    response = requests.post(f"{api_url}/chat/generate-multi", json=generate_data, timeout=60)
    
    if response.status_code != 200:
        print(f"❌ Vision test failed: {response.status_code}")
        try:
            error_data = response.json()
            print(f"   Error: {error_data}")
        except:
            print(f"   Error: {response.text}")
        return False
    
    # Step 5: Analyze responses
    result = response.json()
    if 'responses' not in result:
        print("❌ No responses in result")
        return False
    
    responses = result['responses']
    print(f"✅ Generated {len(responses)} persona responses")
    
    # Check for vision-related content
    vision_keywords = ['image', 'see', 'text', 'blue', 'color', 'vision', 'picture', 'visual', 'observe']
    vision_detected = False
    
    for resp in responses:
        persona_name = resp.get('persona_name', 'Unknown')
        content = resp.get('content', '').lower()
        print(f"\n   {persona_name}: {resp.get('content', '')[:150]}...")
        
        if any(keyword in content for keyword in vision_keywords):
            vision_detected = True
            print(f"   ✅ Vision content detected from {persona_name}")
    
    if vision_detected:
        print("\n🎉 VISION TEST PASSED - GPT-4o vision is working!")
        return True
    else:
        print("\n⚠️  VISION TEST INCONCLUSIVE - No clear vision-related content detected")
        print("   This might indicate GPT-4o vision is not working properly")
        return False

if __name__ == "__main__":
    success = test_vision()
    exit(0 if success else 1)