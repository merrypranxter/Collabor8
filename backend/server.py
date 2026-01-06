from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from emergentintegrations.llm.openai import OpenAITextToSpeech
import random
import base64
import hashlib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

class Voice(BaseModel):
    tone: str
    pacing: str
    signature_moves: List[str] = []
    taboos: List[str] = []

class PersonaBase(BaseModel):
    display_name: str
    type: str
    bio: str
    quirks: List[str]
    voice: Voice
    color: Optional[str] = "#A855F7"  # Default purple

class PersonaCreate(BaseModel):
    display_name: str
    type: str = "custom"
    bio: Optional[str] = None
    quirks: Optional[List[str]] = None
    voice: Optional[Voice] = None
    generate_avatar: bool = False
    color: Optional[str] = "#A855F7"
    avatar_base64: Optional[str] = None

class Persona(PersonaBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    avatar_url: Optional[str] = None
    avatar_base64: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: str
    display_name: str
    avatar_base64: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    password: str
    display_name: str

class UserLogin(BaseModel):
    username: str
    password: str

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    persona_id: Optional[str] = None
    persona_name: str
    persona_color: Optional[str] = None
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_user: bool = False

class Conversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    user_id: Optional[str] = None
    title: str = "New Conversation"
    mode: str
    topic: Optional[str] = None
    active_personas: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ConversationCreate(BaseModel):
    mode: str
    topic: Optional[str] = None
    active_personas: List[str] = []

class MessageCreate(BaseModel):
    content: str
    persona_id: Optional[str] = None
    is_user: bool = False
    attachments: Optional[List[Dict[str, Any]]] = None

class PersonaLookupRequest(BaseModel):
    name: str

class ChatGenerateRequest(BaseModel):
    conversation_id: str
    user_message: str
    attachments: Optional[List[Dict[str, Any]]] = None

@api_router.get("/")
async def root():
    return {"message": "Collabor8 Arena API"}

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

@api_router.post("/auth/register")
async def register_user(user: UserCreate):
    existing = await db.users.find_one({"username": user.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user_obj = User(
        username=user.username,
        password_hash=hash_password(user.password),
        display_name=user.display_name
    )
    
    doc = user_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    return {"id": user_obj.id, "username": user_obj.username, "display_name": user_obj.display_name}

@api_router.post("/auth/login")
async def login_user(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user or user['password_hash'] != hash_password(credentials.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        "id": user['id'],
        "username": user['username'],
        "display_name": user['display_name'],
        "avatar_base64": user.get('avatar_base64')
    }

@api_router.get("/auth/guest")
async def get_guest_session():
    guest_id = str(uuid.uuid4())
    return {"id": guest_id, "username": f"guest_{guest_id[:8]}", "display_name": "Guest", "is_guest": True}

@api_router.post("/personas", response_model=Persona)
async def create_persona(persona: PersonaCreate):
    # Use provided avatar or generate if requested
    avatar_base64 = persona.avatar_base64
    
    if persona.generate_avatar and not avatar_base64:
        try:
            api_key = os.environ.get('EMERGENT_LLM_KEY')
            image_gen = OpenAIImageGeneration(api_key=api_key)
            
            prompt = f"A minimalist, elegant portrait icon of {persona.display_name}. Artistic, symbolic representation with warm muted colors on dark background. Style: refined, intellectual, timeless."
            
            images = await image_gen.generate_images(
                prompt=prompt,
                model="gpt-image-1",
                number_of_images=1
            )
            
            if images and len(images) > 0:
                avatar_base64 = base64.b64encode(images[0]).decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to generate avatar: {str(e)}")
    
    if persona.bio is None:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message="You are a helpful assistant that provides concise biographical information."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"Provide a concise 2-3 sentence bio for {persona.display_name}. Include key facts and personality."
        response = await chat.send_message(UserMessage(text=prompt))
        persona.bio = response.strip()
    
    if persona.quirks is None or len(persona.quirks) == 0:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message="You are a helpful assistant."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"List 3 distinctive quirks or traits for {persona.display_name}. Return only a comma-separated list."
        response = await chat.send_message(UserMessage(text=prompt))
        persona.quirks = [q.strip() for q in response.split(',')]
    
    if persona.voice is None:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message="You are a helpful assistant."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"Describe {persona.display_name}'s speaking voice in 3 words for tone, 2 words for pacing, list 2 signature moves (speaking patterns), and 2 taboos (topics/behaviors to avoid). Format: Tone: X, Y, Z | Pacing: A, B | Moves: 1, 2 | Taboos: 1, 2"
        response = await chat.send_message(UserMessage(text=prompt))
        
        parts = response.split('|')
        tone_part = parts[0].split(':')[1].strip() if len(parts) > 0 else "thoughtful"
        pacing_part = parts[1].split(':')[1].strip() if len(parts) > 1 else "measured"
        moves_part = parts[2].split(':')[1].strip() if len(parts) > 2 else ""
        taboos_part = parts[3].split(':')[1].strip() if len(parts) > 3 else ""
        
        persona.voice = Voice(
            tone=tone_part,
            pacing=pacing_part,
            signature_moves=[m.strip() for m in moves_part.split(',')] if moves_part else [],
            taboos=[t.strip() for t in taboos_part.split(',')] if taboos_part else []
        )
    
    persona_obj = Persona(
        display_name=persona.display_name,
        type=persona.type,
        bio=persona.bio,
        quirks=persona.quirks,
        voice=persona.voice,
        color=persona.color or "#A855F7",
        avatar_base64=avatar_base64,
        avatar_url=f"data:image/png;base64,{avatar_base64}" if avatar_base64 else None
    )
    
    doc = persona_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.personas.insert_one(doc)
    return persona_obj

@api_router.get("/personas", response_model=List[Persona])
async def get_personas():
    personas = await db.personas.find({}, {"_id": 0}).to_list(100)
    
    for persona in personas:
        if isinstance(persona['created_at'], str):
            persona['created_at'] = datetime.fromisoformat(persona['created_at'])
    
    return personas

@api_router.get("/personas/{persona_id}", response_model=Persona)
async def get_persona(persona_id: str):
    persona = await db.personas.find_one({"id": persona_id}, {"_id": 0})
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    
    if isinstance(persona['created_at'], str):
        persona['created_at'] = datetime.fromisoformat(persona['created_at'])
    
    return persona

@api_router.put("/personas/{persona_id}", response_model=Persona)
async def update_persona(persona_id: str, persona_update: PersonaCreate):
    existing = await db.personas.find_one({"id": persona_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Persona not found")
    
    updated_persona = Persona(
        id=persona_id,
        display_name=persona_update.display_name,
        type=persona_update.type,
        bio=persona_update.bio or existing['bio'],
        quirks=persona_update.quirks or existing['quirks'],
        voice=persona_update.voice or Voice(**existing['voice']),
        role_in_arena=persona_update.role_in_arena,
        created_at=datetime.fromisoformat(existing['created_at']) if isinstance(existing['created_at'], str) else existing['created_at']
    )
    
    doc = updated_persona.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.personas.update_one({"id": persona_id}, {"$set": doc})
    return updated_persona

@api_router.delete("/personas/{persona_id}")
async def delete_persona(persona_id: str):
    result = await db.personas.delete_one({"id": persona_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Persona not found")
    return {"message": "Persona deleted"}

@api_router.post("/conversations", response_model=Conversation)
async def create_conversation(conv: ConversationCreate, user_id: Optional[str] = None):
    conversation = Conversation(
        session_id=str(uuid.uuid4()),
        user_id=user_id,
        mode=conv.mode,
        topic=conv.topic,
        active_personas=conv.active_personas,
        title="New Conversation"
    )
    
    doc = conversation.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.conversations.insert_one(doc)
    return conversation

@api_router.get("/conversations", response_model=List[Conversation])
async def get_conversations(user_id: Optional[str] = None):
    query = {"user_id": user_id} if user_id else {}
    convs = await db.conversations.find(query, {"_id": 0}).sort("updated_at", -1).to_list(50)
    
    for conv in convs:
        if isinstance(conv['created_at'], str):
            conv['created_at'] = datetime.fromisoformat(conv['created_at'])
        if isinstance(conv['updated_at'], str):
            conv['updated_at'] = datetime.fromisoformat(conv['updated_at'])
    
    return convs

@api_router.get("/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str):
    conv = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if isinstance(conv['created_at'], str):
        conv['created_at'] = datetime.fromisoformat(conv['created_at'])
    if isinstance(conv['updated_at'], str):
        conv['updated_at'] = datetime.fromisoformat(conv['updated_at'])
    
    return conv

@api_router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    result = await db.conversations.delete_one({"id": conversation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    await db.messages.delete_many({"conversation_id": conversation_id})
    return {"message": "Conversation and messages deleted"}

@api_router.post("/conversations/{conversation_id}/messages", response_model=Message)
async def create_message(conversation_id: str, message: MessageCreate):
    conv = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    persona_name = "User"
    if message.persona_id:
        persona = await db.personas.find_one({"id": message.persona_id}, {"_id": 0})
        if persona:
            persona_name = persona['display_name']
    
    msg = Message(
        conversation_id=conversation_id,
        persona_id=message.persona_id,
        persona_name=persona_name,
        content=message.content,
        is_user=message.is_user
    )
    
    doc = msg.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    await db.messages.insert_one(doc)
    
    if message.is_user and conv['title'] == "New Conversation":
        title_preview = message.content[:50] + "..." if len(message.content) > 50 else message.content
        await db.conversations.update_one(
            {"id": conversation_id},
            {"$set": {"title": title_preview, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.conversations.update_one(
            {"id": conversation_id},
            {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return msg

@api_router.get("/conversations/{conversation_id}/messages", response_model=List[Message])
async def get_messages(conversation_id: str):
    messages = await db.messages.find({"conversation_id": conversation_id}, {"_id": 0}).sort("timestamp", 1).to_list(200)
    
    for msg in messages:
        if isinstance(msg['timestamp'], str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    
    return messages

@api_router.put("/conversations/{conversation_id}")
async def update_conversation(conversation_id: str, update_data: dict):
    conv = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Update allowed fields
    update_fields = {}
    if 'active_personas' in update_data:
        update_fields['active_personas'] = update_data['active_personas']
    if 'mode' in update_data:
        update_fields['mode'] = update_data['mode']
    if 'title' in update_data:
        update_fields['title'] = update_data['title']
    
    if update_fields:
        update_fields['updated_at'] = datetime.now(timezone.utc).isoformat()
        await db.conversations.update_one(
            {"id": conversation_id},
            {"$set": update_fields}
        )
    
    updated_conv = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    return updated_conv

@api_router.post("/chat/generate-multi")
async def generate_multi_responses(request: ChatGenerateRequest):
    """Generate initial responses from all active personas to user message"""
    conv = await db.conversations.find_one({"id": request.conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    active_persona_ids = conv['active_personas']
    if not active_persona_ids:
        return {"responses": []}
    
    personas_data = await db.personas.find({"id": {"$in": active_persona_ids}}, {"_id": 0}).to_list(100)
    
    mentioned_personas = []
    user_message_lower = request.user_message.lower()
    
    for persona in personas_data:
        persona_name_lower = persona['display_name'].lower()
        first_name = persona_name_lower.split()[0]
        
        if (f"@{persona_name_lower}" in user_message_lower or 
            f"@{first_name}" in user_message_lower or
            f"hey {persona_name_lower}" in user_message_lower or
            f"hey {first_name}" in user_message_lower or
            f"{persona_name_lower}," in user_message_lower or
            f"{first_name}," in user_message_lower):
            mentioned_personas.append(persona)
    
    mode = conv['mode']
    
    if mentioned_personas:
        responding_personas = mentioned_personas
    else:
        # Determine how many personas should respond based on mode
        # Now responds with ALL active personas (not random subset)
        num_responders = {
            "Creativity Collaboration": len(personas_data),  # All personas collaborate
            "Shoot-the-Shit": random.randint(2, max(2, len(personas_data))),  # Most personas join casually
            "Unhinged": len(personas_data),  # All personas go wild
            "Socratic Debate": len(personas_data)  # All personas debate
        }.get(mode, len(personas_data))
        
        num_responders = min(num_responders, len(personas_data))
        responding_personas = random.sample(personas_data, num_responders)
    
    mode_instructions = {
        "Creativity Collaboration": "Be constructive, idea-generating, and iterate with user feedback. Build on others' ideas when multiple personas speak.",
        "Shoot-the-Shit": "Be casual, meandering, tangents welcome. React naturally to what others say.",
        "Unhinged": "[FICTION—UNHINGED] Be surreal, satirical, and extreme but fiction-only. Play off others' energy.",
        "Socratic Debate": "Use question-driven probing, challenge assumptions. Engage with others' points directly."
    }
    
    all_messages = await db.messages.find({"conversation_id": request.conversation_id}, {"_id": 0}).sort("timestamp", 1).to_list(50)
    context_str = "\n".join([f"{msg['persona_name']}: {msg['content']}" for msg in all_messages[-10:]])
    
    attachment_context = ""
    has_images = False
    image_contents = []
    
    if request.attachments:
        for att in request.attachments:
            if att['type'] == 'image':
                has_images = True
                # Extract base64 data from data URL format
                image_data = att.get('data', '')
                if image_data.startswith('data:'):
                    # Format: data:image/png;base64,<base64_data>
                    base64_data = image_data.split(',', 1)[1] if ',' in image_data else image_data
                else:
                    base64_data = image_data
                
                # Create ImageContent object for the image
                image_content = ImageContent(image_base64=base64_data)
                image_contents.append(image_content)
                attachment_context += f"\n[User shared an image: {att.get('description', 'visual content')}]"
            elif att['type'] == 'url':
                attachment_context += f"\n[User shared a link: {att['url']}]"
            elif att['type'] == 'file':
                attachment_context += f"\n[User shared a file: {att['name']}]"
    
    context_str += f"\nUser: {request.user_message}{attachment_context}"
    
    responses = []
    
    for persona in responding_personas:
        system_message = f"""You are {persona['display_name']}.
Type: {persona['type']}.
Bio: {persona['bio']}
Voice: {persona['voice']['tone']}, pacing: {persona['voice']['pacing']}.
Quirks: {', '.join(persona['quirks'])}

Mode: {mode}
{mode_instructions.get(mode, '')}

{"The user addressed you directly. Respond to them personally." if persona in mentioned_personas else "You're in a natural group conversation. Keep your response focused and under 150 words. Be conversational and authentic to your character."}

IMPORTANT: You are having a real conversation, not conducting an interview. Respond naturally without ending with questions unless it's organic to what you're saying. Share your thoughts, react to others, build on ideas - like you would in a real discussion.

If the user shares images, describe what you observe and respond thoughtfully.
If the user shares links or files, engage with the content meaningfully."""
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=f"{request.conversation_id}-{persona['id']}",
            system_message=system_message
        )
        
        # Use vision model when images are present
        if has_images:
            chat = chat.with_model("openai", "gpt-4o")
        else:
            chat = chat.with_model("openai", "gpt-5.2")
        
        prompt = f"Recent conversation:\n{context_str}\n\nRespond as {persona['display_name']}:"
        
        # Create message with images if present
        if has_images and image_contents:
            user_message = UserMessage(text=prompt, file_contents=image_contents)
        else:
            user_message = UserMessage(text=prompt)
        
        response_text = await chat.send_message(user_message)
        
        msg = Message(
            conversation_id=request.conversation_id,
            persona_id=persona['id'],
            persona_name=persona['display_name'],
            persona_color=persona.get('color', '#A855F7'),
            content=response_text,
            is_user=False
        )
        
        doc = msg.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        
        await db.messages.insert_one(doc)
        responses.append(msg)
    
    await db.conversations.update_one(
        {"id": request.conversation_id},
        {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"responses": responses}

@api_router.post("/chat/continue-discussion")
async def continue_discussion(request: dict):
    """
    Continue the discussion - personas respond to each other's ideas
    This creates a multi-turn conversation between personas
    """
    conversation_id = request.get('conversation_id')
    max_rounds = request.get('max_rounds', 2)  # Limit to prevent infinite loops
    
    conv = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    active_persona_ids = conv['active_personas']
    if not active_persona_ids or len(active_persona_ids) < 2:
        return {"responses": [], "rounds_completed": 0}
    
    personas_data = await db.personas.find({"id": {"$in": active_persona_ids}}, {"_id": 0}).to_list(100)
    mode = conv['mode']
    
    mode_instructions = {
        "Creativity Collaboration": "Build on others' ideas. Add new angles. Collaborate and synthesize.",
        "Shoot-the-Shit": "React naturally. Casual banter. Can agree, disagree, or go on tangents.",
        "Unhinged": "React wildly. Amplify or subvert. Maximum chaos and creativity.",
        "Socratic Debate": "Challenge each other. Ask questions. Probe assumptions."
    }
    
    all_responses = []
    
    for round_num in range(max_rounds):
        # Get recent conversation context (last 15 messages)
        all_messages = await db.messages.find({"conversation_id": conversation_id}, {"_id": 0}).sort("timestamp", 1).to_list(100)
        recent_context = all_messages[-15:]
        
        # Build context string showing the ongoing discussion
        context_str = "Recent discussion:\n" + "\n".join([
            f"{msg['persona_name']}: {msg['content'][:200]}..." if len(msg['content']) > 200 else f"{msg['persona_name']}: {msg['content']}"
            for msg in recent_context
        ])
        
        # Select 2-3 personas to respond in this round (not all at once for natural flow)
        num_speakers = min(random.randint(2, 3), len(personas_data))
        round_personas = random.sample(personas_data, num_speakers)
        
        round_responses = []
        
        for persona in round_personas:
            # Each persona decides whether to respond based on the discussion
            system_message = f"""You are {persona['display_name']} in an ongoing discussion.
Type: {persona['type']}.
Bio: {persona['bio']}
Voice: {persona['voice']['tone']}, pacing: {persona['voice']['pacing']}.

Mode: {mode}
{mode_instructions.get(mode, '')}

You are responding to what OTHER personas just said in a natural conversation.
- React to interesting points made by others
- Build on ideas you find compelling
- Challenge assumptions if you disagree
- You may ask questions if it's natural to the conversation flow
- Be conversational and engage with specific points
- Keep responses under 100 words for natural back-and-forth
- Respond like you're talking with peers, not interviewing them
- If you have nothing new to add, you can stay silent (return empty response)"""
            
            prompt = f"{context_str}\n\nAs {persona['display_name']}, respond naturally to the discussion above. What are your thoughts?"
            
            api_key = os.environ.get('EMERGENT_LLM_KEY')
            chat = LlmChat(
                api_key=api_key,
                session_id=f"{conversation_id}-{persona['id']}-round{round_num}",
                system_message=system_message
            ).with_model("openai", "gpt-5.2")
            
            try:
                response_text = await chat.send_message(UserMessage(text=prompt))
                
                # Only add if persona actually has something to say
                if response_text and len(response_text.strip()) > 10:
                    msg = Message(
                        conversation_id=conversation_id,
                        persona_id=persona['id'],
                        persona_name=persona['display_name'],
                        content=response_text,
                        is_user=False
                    )
                    
                    doc = msg.model_dump()
                    doc['timestamp'] = doc['timestamp'].isoformat()
                    await db.messages.insert_one(doc)
                    
                    round_responses.append(msg)
                    all_responses.append(msg)
            except Exception as e:
                logging.error(f"Error generating response for {persona['display_name']}: {e}")
                continue
        
        # If no one had anything to say, end the discussion
        if not round_responses:
            break
        
        # Small delay between rounds for natural pacing
        await asyncio.sleep(0.5)
    
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"responses": all_responses, "rounds_completed": len(all_responses) // 2}

@api_router.post("/tts/generate")
async def generate_speech(request: dict):
    """
    Generate high-quality speech from text using OpenAI TTS
    """
    text = request.get('text', '')
    persona_name = request.get('persona_name', '')
    
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    
    # Limit text length to avoid exceeding OpenAI limits
    if len(text) > 4096:
        text = text[:4096]
    
    # Map personas to appropriate OpenAI voices
    voice_map = {
        "Terence McKenna": "onyx",  # Deep, authoritative
        "Jesus": "fable",  # Expressive, storytelling
        "Buddha": "sage",  # Wise, measured
        "Carl Jung": "echo",  # Smooth, calm
        "Albert Einstein": "alloy",  # Neutral, balanced
        "Helena Blavatsky": "shimmer",  # Bright, ethereal
        "J Robert Oppenheimer": "onyx",  # Deep, serious
        "Marie Curie": "nova",  # Energetic, upbeat
    }
    
    voice = voice_map.get(persona_name, "alloy")
    
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        tts = OpenAITextToSpeech(api_key=api_key)
        
        # Generate speech as base64 (easier to send over API)
        audio_base64 = await tts.generate_speech_base64(
            text=text,
            model="tts-1",  # Standard quality for speed
            voice=voice
        )
        
        return {
            "audio": audio_base64,
            "voice": voice,
            "format": "mp3"
        }
        
    except Exception as e:
        logging.error(f"TTS generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate speech: {str(e)}")

@api_router.post("/personas/seed")
async def seed_default_personas():
    default_personas = [
        {"display_name": "Terence McKenna", "type": "historical", "color": "#A855F7"},
        {"display_name": "Jesus", "type": "historical", "color": "#FCD34D"},
        {"display_name": "Buddha", "type": "historical", "color": "#4ADE80"},
        {"display_name": "J. Robert Oppenheimer", "type": "historical", "color": "#FB923C"},
        {"display_name": "Carl Jung", "type": "historical", "color": "#F87171"},
        {"display_name": "Albert Einstein", "type": "historical", "color": "#F472B6"},
        {"display_name": "Helena Blavatsky", "type": "historical", "color": "#9333EA"}
    ]
    
    existing_count = await db.personas.count_documents({})
    if existing_count >= len(default_personas):
        return {"message": "Personas already seeded", "created": []}
    
    created = []
    skipped = []
    
    for p in default_personas:
        try:
            existing = await db.personas.find_one({"display_name": p["display_name"]}, {"_id": 0})
            if not existing:
                persona_create = PersonaCreate(**p)
                persona = await create_persona(persona_create)
                created.append(persona.display_name)
            else:
                skipped.append(p["display_name"])
        except Exception as e:
            logger.error(f"Failed to create {p['display_name']}: {str(e)}")
            continue
    
    return {"message": f"Seeded {len(created)} personas, skipped {len(skipped)}", "created": created, "skipped": skipped}

# Health check endpoints for Kubernetes deployment
@app.get("/health")
async def health_check():
    """Health check endpoint for Kubernetes liveness/readiness probes"""
    try:
        # Check MongoDB connection
        await db.command('ping')
        return {
            "status": "healthy",
            "database": "connected",
            "service": "collabor8"
        }
    except Exception as e:
        logging.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")

@api_router.get("/health")
async def api_health_check():
    """API health check endpoint"""
    try:
        # Check MongoDB connection
        await db.command('ping')
        return {
            "status": "healthy",
            "database": "connected",
            "service": "collabor8-api"
        }
    except Exception as e:
        logging.error(f"API health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()