from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.responses import Response
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
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.units import inch
from io import BytesIO
import PyPDF2
import requests
from bs4 import BeautifulSoup

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
    tags: List[str] = []  # Tags for filtering/grouping
    sort_order: int = 0  # For custom ordering

class PersonaCreate(BaseModel):
    display_name: str
    type: str = "custom"
    bio: Optional[str] = None
    quirks: Optional[List[str]] = None
    voice: Optional[Voice] = None
    generate_avatar: bool = False
    color: Optional[str] = "#A855F7"
    avatar_base64: Optional[str] = None
    tags: Optional[List[str]] = None
    sort_order: Optional[int] = 0

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
    avatar_base64: Optional[str] = None

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
    persona_avatar: Optional[str] = None
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
            logger.warning(f"Avatar generation failed for {persona.display_name}: {str(e)} - Creating persona without avatar")
            # Continue creating persona even if avatar generation fails
            avatar_base64 = None
    
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
    
    # Create avatar_url, handling cases where avatar_base64 might already include data URL prefix
    avatar_url = None
    if avatar_base64:
        # Strip any existing data URL prefix to avoid duplication
        if avatar_base64.startswith('data:image'):
            # Already has full data URL
            avatar_url = avatar_base64
        else:
            # Just base64 data, add prefix
            avatar_url = f"data:image/png;base64,{avatar_base64}"
    
    persona_obj = Persona(
        display_name=persona.display_name,
        type=persona.type,
        bio=persona.bio,
        quirks=persona.quirks,
        voice=persona.voice,
        color=persona.color or "#A855F7",
        avatar_base64=avatar_base64,
        avatar_url=avatar_url,
        tags=persona.tags or [],
        sort_order=persona.sort_order or 0
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
        # Add default values for new fields if they don't exist
        if 'tags' not in persona:
            persona['tags'] = []
        if 'sort_order' not in persona:
            persona['sort_order'] = 0
    
    # Sort by sort_order
    personas.sort(key=lambda p: p.get('sort_order', 0))
    
    return personas

@api_router.get("/personas/{persona_id}", response_model=Persona)
async def get_persona(persona_id: str):
    persona = await db.personas.find_one({"id": persona_id}, {"_id": 0})
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    
    if isinstance(persona['created_at'], str):
        persona['created_at'] = datetime.fromisoformat(persona['created_at'])
    
    # Add default values for new fields if they don't exist
    if 'tags' not in persona:
        persona['tags'] = []
    if 'sort_order' not in persona:
        persona['sort_order'] = 0
    
    return persona

@api_router.put("/personas/{persona_id}", response_model=Persona)
async def update_persona(persona_id: str, persona_update: PersonaCreate):
    existing = await db.personas.find_one({"id": persona_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Persona not found")
    
    # Update avatar if provided
    avatar_base64 = persona_update.avatar_base64 or existing.get('avatar_base64')
    
    # Handle avatar_url creation, avoiding duplicate prefixes
    avatar_url = existing.get('avatar_url')
    if avatar_base64:
        # Strip any existing data URL prefix to avoid duplication
        if avatar_base64.startswith('data:image'):
            # Already has full data URL
            avatar_url = avatar_base64
        else:
            # Just base64 data, add prefix
            avatar_url = f"data:image/png;base64,{avatar_base64}"
    
    updated_persona = Persona(
        id=persona_id,
        display_name=persona_update.display_name,
        type=persona_update.type,
        bio=persona_update.bio or existing['bio'],
        quirks=persona_update.quirks or existing['quirks'],
        voice=persona_update.voice or Voice(**existing['voice']),
        color=persona_update.color or existing.get('color', '#A855F7'),
        avatar_base64=avatar_base64,
        avatar_url=avatar_url,
        tags=persona_update.tags or existing.get('tags', []),
        sort_order=persona_update.sort_order if persona_update.sort_order is not None else existing.get('sort_order', 0),
        created_at=datetime.fromisoformat(existing['created_at']) if isinstance(existing['created_at'], str) else existing['created_at']
    )
    
    doc = updated_persona.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.personas.update_one({"id": persona_id}, {"$set": doc})
    return updated_persona

@api_router.post("/personas/reorder")
async def reorder_personas(request: dict):
    """
    Bulk update persona sort order after drag-drop
    """
    persona_orders = request.get('orders', [])  # [{"id": "...", "sort_order": 0}, ...]
    
    for item in persona_orders:
        await db.personas.update_one(
            {"id": item['id']},
            {"$set": {"sort_order": item['sort_order']}}
        )
    
    return {"success": True, "updated": len(persona_orders)}

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
                # Fetch and extract URL content
                url_text = att.get('url', '')
                try:
                    # Fetch the URL with timeout
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                    response = requests.get(url_text, headers=headers, timeout=10)
                    response.raise_for_status()
                    
                    # Parse HTML
                    soup = BeautifulSoup(response.content, 'html.parser')
                    
                    # Remove script and style elements
                    for script in soup(["script", "style", "nav", "footer", "header"]):
                        script.decompose()
                    
                    # Get text content
                    text = soup.get_text()
                    
                    # Clean up text
                    lines = (line.strip() for line in text.splitlines())
                    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                    text_content = '\n'.join(chunk for chunk in chunks if chunk)
                    
                    # Get title
                    title = soup.find('title')
                    title_text = title.string if title else url_text
                    
                    # Limit text length
                    if len(text_content) > 1500:
                        text_content = text_content[:1500]
                    
                    attachment_context += f"\n[User shared a web link: {title_text}]\nURL: {url_text}\nContent summary:\n{text_content}"
                except Exception as e:
                    logging.warning(f"Failed to fetch URL content: {e}")
                    attachment_context += f"\n[User shared a link: {url_text}]"
            elif att['type'] == 'file':
                file_name = att.get('name', 'document')
                extracted_text = att.get('extractedText', '')
                
                if extracted_text:
                    # Include extracted PDF text in context
                    attachment_context += f"\n[User shared a PDF: {file_name}]\nExtracted content:\n{extracted_text[:2000]}"  # Limit to 2000 chars
                else:
                    attachment_context += f"\n[User shared a file: {file_name}]"
    
    # Add attachment context to the end if there are attachments
    # Don't duplicate the user message - it's already in all_messages
    if attachment_context:
        context_str += attachment_context
    
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
            persona_avatar=persona.get('avatar_url') or persona.get('avatar_base64'),
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
                        persona_color=persona.get('color', '#A855F7'),
                        persona_avatar=persona.get('avatar_url') or persona.get('avatar_base64'),
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

@api_router.post("/chat/autorun")
async def autorun_discussion(request: dict):
    """
    AUTORUN mode - autonomous discussion for specified duration
    """
    conversation_id = request.get('conversation_id')
    duration_seconds = request.get('duration_seconds', 300)  # Default 5 minutes
    
    conv = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    active_persona_ids = conv['active_personas']
    if not active_persona_ids or len(active_persona_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 active personas")
    
    personas_data = await db.personas.find({"id": {"$in": active_persona_ids}}, {"_id": 0}).to_list(100)
    mode = conv['mode']
    
    mode_instructions = {
        "Creativity Collaboration": "Build on others' ideas. Add new angles. Collaborate and synthesize.",
        "Shoot-the-Shit": "React naturally. Casual banter. Can agree, disagree, or go on tangents.",
        "Unhinged": "React wildly. Amplify or subvert. Maximum chaos and creativity.",
        "Socratic Debate": "Challenge each other. Ask questions. Probe assumptions."
    }
    
    start_time = datetime.now(timezone.utc)
    end_time = start_time.timestamp() + duration_seconds
    round_num = 0
    total_responses = []
    
    # Keep discussing until time runs out
    while datetime.now(timezone.utc).timestamp() < end_time:
        round_num += 1
        
        # Get recent conversation context
        all_messages = await db.messages.find({"conversation_id": conversation_id}, {"_id": 0}).sort("timestamp", 1).to_list(200)
        recent_context = all_messages[-15:]
        
        context_str = "Recent discussion:\n" + "\n".join([
            f"{msg['persona_name']}: {msg['content'][:200]}..." if len(msg['content']) > 200 else f"{msg['persona_name']}: {msg['content']}"
            for msg in recent_context
        ])
        
        # Select 2-3 personas to respond in this round
        num_speakers = min(random.randint(2, 3), len(personas_data))
        round_personas = random.sample(personas_data, num_speakers)
        
        for persona in round_personas:
            # Check time limit
            if datetime.now(timezone.utc).timestamp() >= end_time:
                break
                
            system_message = f"""You are {persona['display_name']} in an ongoing autonomous discussion.
Type: {persona['type']}.
Bio: {persona['bio']}
Voice: {persona['voice']['tone']}, pacing: {persona['voice']['pacing']}.

Mode: {mode}
{mode_instructions.get(mode, '')}

The group is discussing autonomously. Share your thoughts, react to others, build on ideas, or challenge them.
- Keep responses under 100 words
- Be natural and conversational
- You may stay silent if you have nothing to add"""
            
            prompt = f"{context_str}\n\nContinue the discussion as {persona['display_name']}. What are your thoughts?"
            
            api_key = os.environ.get('EMERGENT_LLM_KEY')
            chat = LlmChat(
                api_key=api_key,
                session_id=f"{conversation_id}-autorun-{persona['id']}-{round_num}",
                system_message=system_message
            ).with_model("openai", "gpt-5.2")
            
            try:
                response_text = await chat.send_message(UserMessage(text=prompt))
                
                if response_text and len(response_text.strip()) > 10:
                    msg = Message(
                        conversation_id=conversation_id,
                        persona_id=persona['id'],
                        persona_name=persona['display_name'],
                        persona_color=persona.get('color', '#A855F7'),
                        persona_avatar=persona.get('avatar_url') or persona.get('avatar_base64'),
                        content=response_text,
                        is_user=False
                    )
                    
                    doc = msg.model_dump()
                    doc['timestamp'] = doc['timestamp'].isoformat()
                    await db.messages.insert_one(doc)
                    
                    total_responses.append(msg)
            except Exception as e:
                logging.error(f"Autorun error for {persona['display_name']}: {e}")
                continue
        
        # Small delay between rounds
        await asyncio.sleep(2)
    
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "responses": total_responses,
        "rounds_completed": round_num,
        "duration": duration_seconds
    }

@api_router.post("/chat/generate-title")
async def generate_conversation_title(request: dict):
    """
    Generate an AI-powered title for a conversation
    """
    first_message = request.get('first_message', '')
    
    if not first_message:
        raise HTTPException(status_code=400, detail="First message is required")
    
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message="You are a helpful assistant that creates concise, descriptive titles for conversations. Generate a title that is 3-6 words maximum and captures the essence of the topic."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"Create a short, catchy title (3-6 words max) for a conversation that starts with: '{first_message[:200]}'"
        response = await chat.send_message(UserMessage(text=prompt))
        
        # Clean up the title (remove quotes if present)
        title = response.strip().strip('"').strip("'")
        
        # Ensure it's not too long
        if len(title) > 50:
            title = title[:47] + "..."
        
        return {"title": title}
        
    except Exception as e:
        logging.error(f"Title generation failed: {e}")
        # Fallback to first 50 chars of message
        return {"title": first_message[:47] + "..." if len(first_message) > 50 else first_message}

# TODO: Implement proper authentication middleware
# @api_router.put("/users/profile")
# async def update_user_profile(request: dict, current_user: dict = Depends(get_current_user)):
#     """
#     Update user profile (display name, avatar)
#     """
#     user_id = current_user['id']
#     update_data = {}
#     
#     if 'display_name' in request:
#         update_data['display_name'] = request['display_name']
#     
#     if 'avatar_base64' in request:
#         update_data['avatar_base64'] = request['avatar_base64']
#     
#     if update_data:
#         await db.users.update_one(
#             {"id": user_id},
#             {"$set": update_data}
#         )
#     
#     # Get updated user
#     updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
#     return updated_user

# @api_router.put("/users/password")
# async def change_password(request: dict, current_user: dict = Depends(get_current_user)):
#     """
#     Change user password
#     """
#     current_password = request.get('current_password')
#     new_password = request.get('new_password')
#     
#     if not current_password or not new_password:
#         raise HTTPException(status_code=400, detail="Both current and new password required")
#     
#     user_id = current_user['id']
#     user = await db.users.find_one({"id": user_id})
#     
#     if not user:
#         raise HTTPException(status_code=404, detail="User not found")
#     
#     # Verify current password
#     if not pwd_context.verify(current_password, user['hashed_password']):
#         raise HTTPException(status_code=400, detail="Current password is incorrect")
#     
#     # Update to new password
#     new_hashed = pwd_context.hash(new_password)
#     await db.users.update_one(
#         {"id": user_id},
#         {"$set": {"hashed_password": new_hashed}}
#     )
#     
#     return {"message": "Password updated successfully"}

# @api_router.get("/users/me")
# async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
#     """
#     Get current user's profile
#     """
#     user = await db.users.find_one({"id": current_user['id']}, {"_id": 0, "hashed_password": 0})
#     return user
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

@api_router.post("/extract-pdf")
async def extract_pdf_text(request: dict):
    """
    Extract text from PDF file
    """
    pdf_base64 = request.get('pdf_data', '')
    
    if not pdf_base64:
        raise HTTPException(status_code=400, detail="No PDF data provided")
    
    try:
        # Remove data URL prefix if present
        if 'base64,' in pdf_base64:
            pdf_base64 = pdf_base64.split('base64,')[1]
        
        # Decode base64
        pdf_bytes = base64.b64decode(pdf_base64)
        
        # Extract text from PDF
        pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_bytes))
        text_content = ""
        
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            text_content += page.extract_text() + "\n\n"
        
        return {
            "text": text_content.strip(),
            "pages": len(pdf_reader.pages)
        }
        
    except Exception as e:
        logging.error(f"PDF extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract PDF text: {str(e)}")

@api_router.post("/extract-url")
async def extract_url_content(request: dict):
    """
    Extract content from a web URL
    """
    url = request.get('url', '')
    
    if not url:
        raise HTTPException(status_code=400, detail="No URL provided")
    
    try:
        # Set headers to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        # Fetch the URL with timeout
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
        
        # Get text content
        text = soup.get_text()
        
        # Clean up text
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text_content = '\n'.join(chunk for chunk in chunks if chunk)
        
        # Get title
        title = soup.find('title')
        title_text = title.string if title else url
        
        # Limit text length
        if len(text_content) > 5000:
            text_content = text_content[:5000] + "... [content truncated]"
        
        return {
            "url": url,
            "title": title_text,
            "content": text_content.strip(),
            "success": True
        }
        
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="URL request timed out")
    except requests.exceptions.RequestException as e:
        logging.error(f"URL extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract URL content: {str(e)}")

@api_router.post("/export/pdf")
async def export_pdf(request: dict):
    """
    Export conversation as PDF
    """
    conversation_id = request.get('conversation_id')
    messages = request.get('messages', [])
    
    if not messages:
        # Fetch from database if not provided
        messages = await db.messages.find(
            {"conversation_id": conversation_id}, 
            {"_id": 0}
        ).sort("timestamp", 1).to_list(1000)
    
    # Create PDF in memory
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor='#1a1a1a',
        spaceAfter=30
    )
    
    persona_style = ParagraphStyle(
        'PersonaName',
        parent=styles['Heading2'],
        fontSize=12,
        textColor='#4a4a4a',
        spaceAfter=6
    )
    
    message_style = ParagraphStyle(
        'MessageContent',
        parent=styles['BodyText'],
        fontSize=10,
        leading=14,
        spaceAfter=20
    )
    
    # Add title
    title = Paragraph("Collabor8 Conversation", title_style)
    story.append(title)
    story.append(Spacer(1, 0.2*inch))
    
    # Add messages
    for msg in messages:
        persona_name = msg.get('persona_name', 'Unknown')
        content = msg.get('content', '')
        timestamp = msg.get('timestamp', '')
        
        # Escape HTML characters
        content = content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        
        # Add persona name and timestamp
        header = f"<b>{persona_name}</b> - {timestamp}"
        story.append(Paragraph(header, persona_style))
        
        # Add message content
        story.append(Paragraph(content, message_style))
        story.append(Spacer(1, 0.1*inch))
    
    # Build PDF
    doc.build(story)
    
    # Get PDF bytes
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=conversation.pdf"}
    )

@api_router.post("/personas/seed")
async def seed_default_personas():
    """
    FORCE seed default personas - creates them even if they exist
    """
    logger.info("🌱 SEED ENDPOINT CALLED")
    
    default_personas = [
        {
            "id": str(uuid4()),
            "display_name": "Terence McKenna",
            "type": "Psychonaut philosopher",
            "bio": "Ethnobotanist and mystic exploring consciousness through psychedelics and shamanism.",
            "quirks": ["Uses elaborate metaphors", "References mushrooms", "Discusses novelty"],
            "voice": {"tone": "philosophical", "pacing": "measured"},
            "color": "#A855F7",
            "avatar_base64": None,
            "avatar_url": None,
            "tags": [],
            "sort_order": 0,
            "role_in_arena": "Psychonaut philosopher"
        },
        {
            "id": str(uuid4()),
            "display_name": "Buddha",
            "type": "Enlightened teacher",
            "bio": "Founder of Buddhism teaching the path to enlightenment and compassion.",
            "quirks": ["Speaks in parables", "Uses nature metaphors", "Emphasizes middle way"],
            "voice": {"tone": "calm, wise", "pacing": "slow"},
            "color": "#4ADE80",
            "avatar_base64": None,
            "avatar_url": None,
            "tags": [],
            "sort_order": 1,
            "role_in_arena": "Enlightened teacher"
        },
        {
            "id": str(uuid4()),
            "display_name": "Carl Jung",
            "type": "Depth psychologist",
            "bio": "Swiss psychiatrist exploring the unconscious, archetypes, and individuation.",
            "quirks": ["References archetypes", "Discusses shadow", "Analyzes symbols"],
            "voice": {"tone": "analytical", "pacing": "thoughtful"},
            "color": "#F87171",
            "avatar_base64": None,
            "avatar_url": None,
            "tags": [],
            "sort_order": 2,
            "role_in_arena": "Depth psychologist"
        },
        {
            "id": str(uuid4()),
            "display_name": "Alan Watts",
            "type": "Philosopher",
            "bio": "British philosopher popularizing Eastern wisdom through witty paradoxes.",
            "quirks": ["Playful paradoxes", "Cosmic humor", "Everyday analogies"],
            "voice": {"tone": "witty, relaxed", "pacing": "flowing"},
            "color": "#FCD34D",
            "avatar_base64": None,
            "avatar_url": None,
            "tags": [],
            "sort_order": 3,
            "role_in_arena": "Philosopher"
        },
        {
            "id": str(uuid4()),
            "display_name": "Ram Dass",
            "type": "Spiritual teacher",
            "bio": "Harvard professor turned spiritual guide teaching love and presence.",
            "quirks": ["Says Be Here Now", "Shares stories", "Gentle humor"],
            "voice": {"tone": "warm, loving", "pacing": "gentle"},
            "color": "#FB923C",
            "avatar_base64": None,
            "avatar_url": None,
            "tags": [],
            "sort_order": 4,
            "role_in_arena": "Spiritual teacher"
        }
    ]
    
    created = []
    
    # Get existing count
    existing_count = await db.personas.count_documents({})
    logger.info(f"📊 Existing personas in DB: {existing_count}")
    
    # Only create if database is empty
    if existing_count > 0:
        logger.info("✅ Personas already exist, skipping seed")
        return {"message": "Personas already seeded", "created": [], "existing_count": existing_count, "success": True}
    
    logger.info("🌱 Creating default personas...")
    
    for p in default_personas:
        try:
            await db.personas.insert_one(p)
            created.append(p["display_name"])
            logger.info(f"✅ Created: {p['display_name']}")
        except Exception as e:
            logger.error(f"❌ Failed to create {p['display_name']}: {str(e)}")
            continue
    
    final_count = await db.personas.count_documents({})
    logger.info(f"🎉 Seed complete: {len(created)} created, {final_count} total in DB")
    
    return {
        "message": f"Seeded {len(created)} personas",
        "created": created,
        "total_count": final_count,
        "success": len(created) > 0
    }

@api_router.post("/personas/force-create")
async def force_create_personas():
    """
    NUCLEAR OPTION - Delete everything and force create fresh personas
    """
    try:
        # DELETE ALL PERSONAS
        delete_result = await db.personas.delete_many({})
        logger.info(f"🗑️ Deleted {delete_result.deleted_count} existing personas")
        
        # CREATE FRESH PERSONAS - NO CHECKS, JUST CREATE
        personas = [
            {"id": str(uuid4()), "display_name": "Terence McKenna", "type": "Philosopher", "bio": "Psychonaut exploring consciousness", "quirks": ["Uses metaphors", "References mushrooms"], "voice": {"tone": "philosophical", "pacing": "measured"}, "color": "#A855F7", "avatar_base64": None, "avatar_url": None, "tags": [], "sort_order": 0, "role_in_arena": "Philosopher"},
            {"id": str(uuid4()), "display_name": "Buddha", "type": "Teacher", "bio": "Founder of Buddhism", "quirks": ["Speaks in parables", "Uses nature metaphors"], "voice": {"tone": "calm", "pacing": "slow"}, "color": "#4ADE80", "avatar_base64": None, "avatar_url": None, "tags": [], "sort_order": 1, "role_in_arena": "Teacher"},
            {"id": str(uuid4()), "display_name": "Carl Jung", "type": "Psychologist", "bio": "Explorer of the unconscious", "quirks": ["References archetypes", "Discusses shadow"], "voice": {"tone": "analytical", "pacing": "thoughtful"}, "color": "#F87171", "avatar_base64": None, "avatar_url": None, "tags": [], "sort_order": 2, "role_in_arena": "Psychologist"},
            {"id": str(uuid4()), "display_name": "Alan Watts", "type": "Philosopher", "bio": "Bridge between East and West", "quirks": ["Playful paradoxes", "Cosmic humor"], "voice": {"tone": "witty", "pacing": "flowing"}, "color": "#FCD34D", "avatar_base64": None, "avatar_url": None, "tags": [], "sort_order": 3, "role_in_arena": "Philosopher"},
            {"id": str(uuid4()), "display_name": "Ram Dass", "type": "Teacher", "bio": "Guide to presence and love", "quirks": ["Says Be Here Now", "Gentle humor"], "voice": {"tone": "warm", "pacing": "gentle"}, "color": "#FB923C", "avatar_base64": None, "avatar_url": None, "tags": [], "sort_order": 4, "role_in_arena": "Teacher"}
        ]
        
        # INSERT ALL AT ONCE
        insert_result = await db.personas.insert_many(personas)
        logger.info(f"✅ Inserted {len(insert_result.inserted_ids)} personas")
        
        # VERIFY
        count = await db.personas.count_documents({})
        logger.info(f"📊 Final count: {count}")
        
        # GET ALL AND RETURN
        all_personas = await db.personas.find({}, {"_id": 0}).to_list(100)
        
        return {
            "success": True,
            "deleted": delete_result.deleted_count,
            "created": len(insert_result.inserted_ids),
            "final_count": count,
            "personas": all_personas
        }
        
    except Exception as e:
        logger.error(f"❌ FORCE CREATE FAILED: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }
async def fix_broken_avatars():
    """
    Emergency endpoint to fix broken avatar URLs in production database
    Fixes duplicate prefixes and generates missing avatars
    """
    fixed = []
    generated = []
    
    # Get all personas
    all_personas = await db.personas.find({}, {"_id": 0}).to_list(1000)
    
    for persona in all_personas:
        persona_id = persona['id']
        needs_update = False
        update_data = {}
        
        # Fix duplicate prefix if exists
        avatar_url = persona.get('avatar_url')
        if avatar_url and avatar_url.count('data:image') > 1:
            # Extract base64 data after last 'base64,'
            parts = avatar_url.split('base64,')
            if len(parts) > 1:
                base64_data = parts[-1]
                # Determine image type
                if 'image/jpeg' in avatar_url or 'image/jpg' in avatar_url:
                    fixed_url = f'data:image/jpeg;base64,{base64_data}'
                elif 'image/png' in avatar_url:
                    fixed_url = f'data:image/png;base64,{base64_data}'
                else:
                    fixed_url = f'data:image/png;base64,{base64_data}'
                
                update_data['avatar_url'] = fixed_url
                needs_update = True
                fixed.append(persona['display_name'])
        
        # Generate avatar if missing
        elif not avatar_url or not persona.get('avatar_base64'):
            try:
                api_key = os.environ.get('EMERGENT_LLM_KEY')
                image_gen = OpenAIImageGeneration(api_key=api_key)
                
                prompt = f"A minimalist, elegant portrait icon of {persona['display_name']}. Artistic, symbolic representation with warm muted colors on dark background. Style: refined, intellectual, timeless."
                
                images = await image_gen.generate_images(
                    prompt=prompt,
                    model="gpt-image-1",
                    number_of_images=1
                )
                
                if images and len(images) > 0:
                    avatar_base64 = base64.b64encode(images[0]).decode('utf-8')
                    update_data['avatar_base64'] = avatar_base64
                    update_data['avatar_url'] = f"data:image/png;base64,{avatar_base64}"
                    needs_update = True
                    generated.append(persona['display_name'])
            except Exception as e:
                logger.error(f"Failed to generate avatar for {persona['display_name']}: {e}")
        
        # Update if needed
        if needs_update:
            await db.personas.update_one(
                {"id": persona_id},
                {"$set": update_data}
            )
    
    return {
        "message": "Avatar fix complete",
        "fixed_duplicates": fixed,
        "generated_missing": generated,
        "total_fixed": len(fixed),
        "total_generated": len(generated)
    }

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