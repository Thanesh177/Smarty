import json
import hashlib
import os
import time
import uuid
import random
import re
import logging
import urllib.request
import urllib.parse
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr
from botocore.config import Config
from botocore.exceptions import ClientError, BotoCoreError
from generation_cache import GenerationBusy, generation_lease

from content_catalog import (
    BASE_TOPICS,
    CONTENT_ANGLES,
    TOPIC_DOMAINS,
    TOPIC_SUBTOPICS,
    TOPIC_TO_DOMAIN,
)


logger = logging.getLogger()
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-east-1")

TABLE_NAME = os.environ.get("TABLE_NAME", "TextReels")
DOUBTS_TABLE_NAME = os.environ.get("DOUBTS_TABLE_NAME", "PostAiDoubts")
EXPLANATIONS_TABLE_NAME = os.environ.get(
    "EXPLANATIONS_TABLE_NAME",
    "SmartyExplanations",
)
BUCKET_NAME = os.environ.get("BUCKET_NAME", "smarty-post-images")
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")

PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "")

POST_MODEL_ID = os.environ.get("POST_MODEL_ID", "amazon.nova-lite-v1:0")
DETAILS_MODEL_ID = os.environ.get("DETAILS_MODEL_ID", "amazon.nova-lite-v1:0")
EXPLANATION_SCHEMA_VERSION = 3
EXPLANATION_SECTION_HEADINGS = (
    "Core idea",
    "Essential terms",
    "How it works",
    "Worked example",
    "Common misconception",
    "Limits and edge cases",
    "Why it matters",
    "What to learn next",
    "Remember this",
)

HTTP_TIMEOUT = int(os.environ.get("HTTP_TIMEOUT", "20"))
IMAGE_DOWNLOAD_TIMEOUT = int(os.environ.get("IMAGE_DOWNLOAD_TIMEOUT", "30"))
MAX_IMAGE_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", str(8 * 1024 * 1024)))
RECENT_POST_SAMPLE_SIZE = int(os.environ.get("RECENT_POST_SAMPLE_SIZE", "120"))
MAX_GENERATION_ATTEMPTS = int(os.environ.get("MAX_GENERATION_ATTEMPTS", "4"))
TOPIC_COOLDOWN_SIZE = int(os.environ.get("TOPIC_COOLDOWN_SIZE", "12"))
CONTENT_ROTATION_SCHEMA_VERSION = 1
CONTENT_ROTATION_STATE_ID = "system#content-rotation#v1"
CONTENT_CATALOG_SIGNATURE = hashlib.sha256(
    "\n".join(
        f"{TOPIC_TO_DOMAIN[topic]}:{topic}"
        for topic in BASE_TOPICS
    ).encode("utf-8")
).hexdigest()[:24]

aws_sdk_config = Config(
    retries={"max_attempts": 5, "mode": "adaptive"},
    connect_timeout=5,
    read_timeout=max(HTTP_TIMEOUT, 60),
)
dynamodb = boto3.resource(
    "dynamodb",
    region_name=AWS_REGION,
    config=aws_sdk_config,
)
s3 = boto3.client("s3", region_name=AWS_REGION, config=aws_sdk_config)
bedrock = boto3.client(
    "bedrock-runtime",
    region_name=BEDROCK_REGION,
    config=aws_sdk_config,
)

table = dynamodb.Table(TABLE_NAME)
doubts_table = dynamodb.Table(DOUBTS_TABLE_NAME)
explanations_table = dynamodb.Table(EXPLANATIONS_TABLE_NAME)

HEADERS = {
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
}

IMAGE_SEARCH_TERMS = {
    "Finance": "stock market finance charts",
    "Investing": "investment finance charts",
    "Personal Finance": "money savings budgeting",
    "Stock Market": "stock market trading charts",
    "Trading": "stock trading market charts",
    "Psychology": "human brain psychology",
    "Human Behavior": "people behavior psychology",
    "Decision Making": "decision making psychology",
    "Habits": "daily habits routine",
    "Motivation": "motivation goals success",
    "Neuroscience": "brain neurons science",
    "Memory": "human brain memory",
    "Learning": "learning study education",
    "Brain Function": "brain neurons science",
    "Technology": "modern technology innovation",
    "Artificial Intelligence": "artificial intelligence robot technology",
    "Cybersecurity": "cybersecurity data protection",
    "Software Systems": "software coding technology",
    "Business": "business strategy office meeting",
    "Startups": "startup business team",
    "Entrepreneurship": "entrepreneur business planning",
    "Marketing": "marketing strategy business",
    "Economics": "economy finance graph",
    "World History": "historical map old world history",
    "Geopolitical History": "historical map geopolitics borders",
    "Military History": "historic battlefield war museum",
    "Political History": "old parliament historical documents",
    "Colonial History": "colonial history old map",
    "Diplomatic History": "historic treaty diplomacy",
    "Economic History": "old trade route historical market",
    "History Between Nations": "historic map nations borders",
    "Borders and Empires": "ancient empire historical map",
    "Wars and Conflicts": "historic battlefield war history",
    "Ancient Empires": "ancient empire ruins map",
    "Medieval History": "medieval castle history",
    "Modern History": "modern history archive documents",
    "Historical Geography": "historical geography old map",
    "Trade Routes": "ancient trade route map",
    "Revolutions": "historic revolution crowd painting",
    "Global Economy": "global economy finance",
    "Consumer Behavior": "shopping consumer behavior",
    "Health": "healthy lifestyle wellness",
    "Mental Health": "mental health calm wellness",
    "Nutrition": "healthy food nutrition",
    "Sleep": "sleep rest bedroom",
    "Fitness": "fitness exercise gym",
    "Space": "galaxy space stars",
    "Astronomy": "telescope stars galaxy",
    "Physics": "physics science experiment",
    "Gravity": "space planet orbit",
    "Black Holes": "galaxy space stars",
    "Climate Change": "climate change earth",
    "Environment": "nature climate environment",
    "Sustainability": "sustainable energy nature",
    "History": "ancient history civilization",
    "Ancient Civilizations": "ancient civilization ruins",
    "Society": "people city society",
    "Culture": "culture people city",
    "Productivity": "workspace productivity planning",
    "Focus": "focused work desk",
    "Self Improvement": "self improvement goals",
    "Discipline": "discipline training focus",
}

FALLBACK_IMAGES = [
    "default/finance.jpg",
    "default/brain.jpg",
    "default/tech.jpg",
]


def clean_decimal(obj):
    if isinstance(obj, list):
        return [clean_decimal(i) for i in obj]
    if isinstance(obj, dict):
        return {k: clean_decimal(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj


def response(status, body):
    return {
        "statusCode": status,
        "headers": HEADERS,
        "body": json.dumps(clean_decimal(body), ensure_ascii=False),
    }


def get_route(event):
    return (
        event.get("rawPath")
        or event.get("path")
        or event.get("requestContext", {}).get("http", {}).get("path", "")
        or ""
    )


def get_method(event):
    return (
        event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("httpMethod")
        or ""
    )


def get_body(event):
    try:
        return json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return None


def normalize_text(value, max_len=None):
    text = str(value or "").strip()
    if max_len is not None:
        text = text[:max_len]
    return text


def get_user_id(event, body=None):
    body = body or {}
    authorizer = event.get("requestContext", {}).get("authorizer", {})
    jwt_claims = authorizer.get("jwt", {}).get("claims", {})
    rest_claims = authorizer.get("claims", {})

    return (
        jwt_claims.get("sub")
        or jwt_claims.get("username")
        or rest_claims.get("sub")
        or rest_claims.get("username")
        or "anonymous-user"
    )


def enforce_word_range(text, min_words=80, max_words=125):
    text = normalize_text(text)
    words = text.split()
    if len(words) > max_words:
        return " ".join(words[:max_words]).strip()
    return text


def clean_body(body):
    if not body:
        return ""

    text = str(body).strip()
    text = text.replace("```json", "").replace("```", "").strip()

    if text.startswith("{"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return str(parsed.get("body", text)).strip()
        except Exception:
            pass

    return text


def clean_ai_output(text):
    text = normalize_text(text)
    text = text.replace("###", "")
    text = text.replace("**", "")
    text = text.replace("__", "")
    text = text.replace("```", "")
    text = text.replace("•", "-")
    text = re.sub(r"^\s*#+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_json_object(text):
    text = str(text or "").strip()
    text = text.replace("```json", "").replace("```", "").strip()

    start = text.find("{")
    end = text.rfind("}")

    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]

    try:
        return json.loads(text)
    except Exception:
        return None


def get_post(post_id, consistent_read=False):
    if not post_id:
        return None

    try:
        post = table.get_item(
            Key={"id": post_id},
            ConsistentRead=consistent_read
        ).get("Item")
        if post and (
            str(post.get("visibility", "")).lower().startswith("moderation_")
            or str(post.get("moderationStatus", "")).lower() in {"pending", "removed"}
        ):
            return None
        return post
    except Exception as e:
        logger.error("GET POST ERROR: %s", str(e))
        return None


TOKEN_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "how", "in", "into", "is", "it", "of", "on", "or", "that", "the",
    "their", "this", "through", "to", "why", "with", "without",
}

GENERIC_PHRASES = (
    "a guide to",
    "basics of",
    "everything about",
    "introduction to",
    "key concept",
    "overview of",
    "the future of",
    "the importance of",
    "things to know",
    "what is",
)


def normalize_tokens(value):
    words = re.findall(r"[a-z0-9]+", normalize_text(value).lower())
    return {word for word in words if len(word) > 2 and word not in TOKEN_STOP_WORDS}


def text_similarity(first, second):
    first_tokens = normalize_tokens(first)
    second_tokens = normalize_tokens(second)
    if not first_tokens or not second_tokens:
        return 0.0
    return len(first_tokens & second_tokens) / len(first_tokens | second_tokens)


def content_fingerprint(topic, sub_topic):
    topic_key = "-".join(sorted(normalize_tokens(topic)))
    subtopic_key = "-".join(sorted(normalize_tokens(sub_topic)))
    return f"{topic_key}:{subtopic_key}"[:400]


def created_at_number(item):
    try:
        return int(item.get("createdAt") or 0)
    except (TypeError, ValueError):
        return 0


def paginated_scan_recent_posts(limit_items=None):
    limit_items = max(1, int(limit_items or RECENT_POST_SAMPLE_SIZE))
    paginator = table.meta.client.get_paginator("scan")
    pages = paginator.paginate(
        TableName=TABLE_NAME,
        ProjectionExpression=(
            "#title, #topic, subTopic, contentFingerprint, contentAngle, "
            "createdAt, authorId, isAutoGenerated"
        ),
        ExpressionAttributeNames={"#title": "title", "#topic": "topic"},
        PaginationConfig={
            "MaxItems": limit_items,
            "PageSize": min(40, limit_items),
        },
    )

    items = []
    for page in pages:
        items.extend(page.get("Items", []))

    return sorted(
        items[:limit_items],
        key=created_at_number,
        reverse=True,
    )


def is_generated_content(item):
    return bool(
        item.get("isAutoGenerated") is True
        or normalize_text(item.get("authorId")).lower() == "smarty-ai"
        or (
            item.get("contentFingerprint")
            and item.get("subTopic")
        )
    )


def choose_subtopic_for_topic(topic, recent_posts):
    recent_fingerprints = {
        normalize_text(item.get("contentFingerprint"))
        or content_fingerprint(item.get("topic"), item.get("subTopic"))
        for item in recent_posts
        if item.get("subTopic")
    }
    recent_subjects = [
        item.get("subTopic") or item.get("title")
        for item in recent_posts
        if item.get("subTopic") or item.get("title")
    ]
    available = []
    for sub_topic in TOPIC_SUBTOPICS[topic]:
        fingerprint = content_fingerprint(topic, sub_topic)
        closest_match = max(
            (text_similarity(sub_topic, recent) for recent in recent_subjects),
            default=0.0,
        )
        if fingerprint not in recent_fingerprints and closest_match < 0.58:
            available.append(sub_topic)

    if available:
        return random.choice(available)

    return min(
        TOPIC_SUBTOPICS[topic],
        key=lambda sub_topic: max(
            (
                text_similarity(sub_topic, recent)
                for recent in recent_subjects
            ),
            default=0.0,
        ),
    )


def choose_generation_target(recent_posts):
    generation_history = [
        item for item in recent_posts
        if is_generated_content(item)
    ]
    topic_counts = Counter(
        normalize_text(item.get("topic"))
        for item in generation_history
        if normalize_text(item.get("topic")) in TOPIC_SUBTOPICS
    )
    minimum_count = min((topic_counts.get(topic, 0) for topic in BASE_TOPICS), default=0)
    topic_pool = [
        topic
        for topic in BASE_TOPICS
        if topic_counts.get(topic, 0) == minimum_count
    ]

    recent_topics = {
        normalize_text(item.get("topic"))
        for item in generation_history[:max(0, TOPIC_COOLDOWN_SIZE)]
    }
    cooled_pool = [topic for topic in topic_pool if topic not in recent_topics]
    if cooled_pool:
        topic_pool = cooled_pool

    domain_counts = Counter(
        TOPIC_TO_DOMAIN.get(normalize_text(item.get("topic")), "")
        for item in generation_history[:max(1, len(TOPIC_DOMAINS) * 2)]
    )
    available_domains = {
        TOPIC_TO_DOMAIN[topic]
        for topic in topic_pool
    }
    minimum_domain_count = min(
        (domain_counts.get(domain, 0) for domain in available_domains),
        default=0,
    )
    domain_pool = [
        domain
        for domain in available_domains
        if domain_counts.get(domain, 0) == minimum_domain_count
    ]
    selected_domain = random.choice(domain_pool)
    selected_topic = random.choice([
        topic
        for topic in topic_pool
        if TOPIC_TO_DOMAIN[topic] == selected_domain
    ])
    return selected_topic, choose_subtopic_for_topic(selected_topic, recent_posts)


def normalize_content_rotation_state(item=None):
    item = item if isinstance(item, dict) else {}
    same_catalog = (
        item.get("catalogSignature") == CONTENT_CATALOG_SIGNATURE
        and int(item.get("schemaVersion") or 0) == CONTENT_ROTATION_SCHEMA_VERSION
    )
    used_topics = item.get("usedTopics") if same_catalog else []
    recent_topics = item.get("recentTopics") if same_catalog else []
    recent_domains = item.get("recentDomains") if same_catalog else []
    return {
        "exists": bool(item),
        "rotationVersion": int(item.get("rotationVersion") or 0),
        "cycle": int(item.get("cycle") or 1) if same_catalog else 1,
        "usedTopics": [
            topic for topic in used_topics
            if topic in TOPIC_SUBTOPICS
        ],
        "recentTopics": [
            topic for topic in recent_topics
            if topic in TOPIC_SUBTOPICS
        ],
        "recentDomains": [
            domain for domain in recent_domains
            if domain in TOPIC_DOMAINS
        ],
    }


def advance_content_rotation_state(item=None):
    state = normalize_content_rotation_state(item)
    used_topics = list(dict.fromkeys(state["usedTopics"]))
    cycle = state["cycle"]
    eligible_topics = [topic for topic in BASE_TOPICS if topic not in used_topics]

    if not eligible_topics:
        used_topics = []
        eligible_topics = list(BASE_TOPICS)
        cycle += 1

    recent_topics = set(state["recentTopics"][:max(0, TOPIC_COOLDOWN_SIZE)])
    cooled_topics = [topic for topic in eligible_topics if topic not in recent_topics]
    if cooled_topics:
        eligible_topics = cooled_topics

    domain_cycle_counts = Counter(
        TOPIC_TO_DOMAIN[topic]
        for topic in used_topics
    )
    eligible_domains = {
        TOPIC_TO_DOMAIN[topic]
        for topic in eligible_topics
    }
    minimum_domain_count = min(
        (domain_cycle_counts.get(domain, 0) for domain in eligible_domains),
        default=0,
    )
    domain_pool = [
        domain
        for domain in eligible_domains
        if domain_cycle_counts.get(domain, 0) == minimum_domain_count
    ]
    recent_domain_set = set(state["recentDomains"][:2])
    cooled_domains = [
        domain for domain in domain_pool
        if domain not in recent_domain_set
    ]
    if cooled_domains:
        domain_pool = cooled_domains

    selected_domain = random.choice(domain_pool)
    selected_topic = random.choice([
        topic
        for topic in eligible_topics
        if TOPIC_TO_DOMAIN[topic] == selected_domain
    ])
    next_state = {
        "explanationId": CONTENT_ROTATION_STATE_ID,
        "entryType": "contentRotation",
        "schemaVersion": CONTENT_ROTATION_SCHEMA_VERSION,
        "catalogSignature": CONTENT_CATALOG_SIGNATURE,
        "rotationVersion": state["rotationVersion"] + 1,
        "cycle": cycle,
        "usedTopics": [*used_topics, selected_topic],
        "recentTopics": [selected_topic, *state["recentTopics"]][
            :max(1, TOPIC_COOLDOWN_SIZE)
        ],
        "recentDomains": [selected_domain, *state["recentDomains"]][
            :max(4, len(TOPIC_DOMAINS) * 2)
        ],
        "updatedAt": int(time.time() * 1000),
    }
    return selected_topic, next_state


def reserve_generation_topic():
    for _ in range(5):
        raw_state = explanations_table.get_item(
            Key={"explanationId": CONTENT_ROTATION_STATE_ID},
            ConsistentRead=True,
        ).get("Item")
        current_state = normalize_content_rotation_state(raw_state)
        topic, next_state = advance_content_rotation_state(raw_state)
        condition = (
            Attr("rotationVersion").eq(current_state["rotationVersion"])
            if current_state["exists"]
            else Attr("explanationId").not_exists()
        )
        try:
            explanations_table.put_item(
                Item=next_state,
                ConditionExpression=condition,
            )
            return topic
        except explanations_table.meta.client.exceptions.ConditionalCheckFailedException:
            continue

    raise RuntimeError("Could not reserve a unique content topic")


def choose_content_angle(recent_posts):
    angle_counts = Counter(
        normalize_text(item.get("contentAngle"))
        for item in recent_posts[:24]
        if item.get("contentAngle")
    )
    least_used = min(
        angle_counts.get(angle["id"], 0)
        for angle in CONTENT_ANGLES
    )
    choices = [
        angle
        for angle in CONTENT_ANGLES
        if angle_counts.get(angle["id"], 0) == least_used
    ]
    return random.choice(choices)


def resolve_content_angle(value=None):
    if isinstance(value, dict) and value.get("id") and value.get("instruction"):
        return value
    angle_id = normalize_text(value)
    return next(
        (angle for angle in CONTENT_ANGLES if angle["id"] == angle_id),
        CONTENT_ANGLES[0],
    )


def is_generic_text(value):
    normalized = normalize_text(value).lower()
    return not normalized or any(phrase in normalized for phrase in GENERIC_PHRASES)


def is_duplicate_post(title, sub_topic, recent_posts):
    fingerprint = content_fingerprint("", sub_topic).split(":", 1)[-1]
    for item in recent_posts:
        old_title = normalize_text(item.get("title"))
        old_subtopic = normalize_text(item.get("subTopic"))
        old_fingerprint = content_fingerprint("", old_subtopic).split(":", 1)[-1]
        if fingerprint and fingerprint == old_fingerprint:
            return True
        if old_title and text_similarity(title, old_title) >= 0.62:
            return True
    return False


def extract_bedrock_text(result):
    content = (
        result.get("output", {})
        .get("message", {})
        .get("content", [])
    )

    parts = []
    for block in content:
        text = block.get("text")
        if text:
            parts.append(text)

    return clean_ai_output("\n".join(parts))


def call_bedrock_text(prompt, max_tokens=1000, temperature=0.45, model_id=None):
    result = bedrock.converse(
        modelId=model_id or DETAILS_MODEL_ID,
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}],
            }
        ],
        inferenceConfig={
            "maxTokens": max_tokens,
            "temperature": temperature,
        },
    )

    return extract_bedrock_text(result)


def is_complete_detailed_explanation(value):
    text = str(value or "").strip()
    words = re.findall(r"\b[\w'-]+\b", text)
    headings_found = sum(
        1
        for heading in EXPLANATION_SECTION_HEADINGS
        if re.search(rf"(?im)^\s*{re.escape(heading)}\s*:?[ \t]*$", text)
    )
    return len(words) >= 350 and headings_found >= 8


def generate_detailed_explanation(
    title,
    body,
    topic="",
    sub_topic="",
    content_angle=None,
):
    content_angle = resolve_content_angle(content_angle)
    prompt = f"""
You are Smarty AI.

Turn this educational post into a complete, accurate guided explanation. Write
for a curious reader who is new to the specific concept but does not want a
shallow summary.

Important rules:
- Use the exact 9 section headings below, in the exact order shown.
- Put a blank line between every section.
- Do not use markdown symbols.
- Write 650 to 950 words in total. Prefer clarity over filler.
- Define every technical term before relying on it.
- Explain cause and effect: name what changes, why it changes, and what the
  change causes next.
- In the mechanism section, use 4 to 7 numbered steps. Each step must explain
  why it leads to the following step.
- Make the worked example concrete and carry the same example through each
  relevant step. Include a simple calculation only when it genuinely helps.
- Separate established facts from simplifications, assumptions, or uncertainty.
- Include one common misconception and explain precisely why it fails.
- State important limits, edge cases, trade-offs, or safety cautions.
- Recommend one specific next concept, explain the conceptual bridge, and give
  the learner one question to carry into it.
- Stay entirely within the specific subtopic. Never drift into a survey of {topic}.
- Name the concrete parts, signals, people, places, forces, or stages involved.
- Do not invent statistics, sources, quotations, people, dates, or capabilities.
- If the post does not support a detail, say what would need to be verified.
- Avoid motivational filler and repeated conclusions.

Broad topic:
{topic}

Specific subtopic:
{sub_topic}

Explanatory lens:
{content_angle["label"]}: {content_angle["instruction"]}

Post title:
{title}

Post body:
{body}

Follow this exact structure:

Core idea

[Explain the central idea in plain language, then state the precise question the
rest of the guide will answer.]

Essential terms

[Define the 3 to 6 terms or components the learner must know.]

How it works

[Give the numbered cause-and-effect mechanism.]

Worked example

[Walk through one concrete example from start to finish.]

Common misconception

[State one plausible misunderstanding and correct it.]

Limits and edge cases

[Explain where the simplified model stops working or requires caution.]

Why it matters

[Connect the mechanism to a real decision, system, event, or consequence.]

What to learn next

[Name one narrow next concept, explain exactly how it builds on this lesson, and
end with one question the learner should be able to investigate next.]

Remember this

[Compress the mechanism into two memorable sentences without introducing a new fact.]
"""

    try:
        explanation = call_bedrock_text(
            prompt,
            max_tokens=1900,
            temperature=0.35,
            model_id=DETAILS_MODEL_ID
        )

        explanation = clean_ai_output(explanation)

        explanation = re.sub(r"\n{3,}", "\n\n", explanation)
        explanation = re.sub(
            rf"(?im)^\s*({'|'.join(map(re.escape, EXPLANATION_SECTION_HEADINGS))})\s*:?\s*",
            r"\n\n\1\n\n",
            explanation,
        )
        explanation = re.sub(r"\n{3,}", "\n\n", explanation).strip()

        if not is_complete_detailed_explanation(explanation):
            logger.warning("Detailed explanation did not pass the completeness gate")
            return ""

        return explanation

    except Exception as e:
        logger.error("DETAIL EXPLANATION ERROR: %s", str(e))
        return ""


def get_image_query(base_topic, title):
    base_query = IMAGE_SEARCH_TERMS.get(base_topic, base_topic)
    title_lower = str(title or "").lower()
    topic_lower = str(base_topic or "").lower()

    if (
        "history" in topic_lower
        or "history" in title_lower
        or "empire" in title_lower
        or "war" in title_lower
        or "treaty" in title_lower
        or "border" in title_lower
        or "colonial" in title_lower
        or "revolution" in title_lower
        or "nation" in title_lower
        or "geopolitical" in title_lower
    ):
        return "historical map old documents archive"

    if "stock" in title_lower or "market" in title_lower or "trading" in title_lower:
        return "stock market trading charts"

    if "brain" in title_lower or "memory" in title_lower or "neuron" in title_lower:
        return "brain neurons neuroscience"

    if "space" in title_lower or "planet" in title_lower or "galaxy" in title_lower:
        return "galaxy space stars"

    if "business" in title_lower or "company" in title_lower or "startup" in title_lower:
        return "business office strategy"

    if "climate" in title_lower or "environment" in title_lower:
        return "nature climate environment"

    if "technology" in title_lower or "ai" in title_lower or "artificial intelligence" in title_lower:
        return "artificial intelligence technology"

    return base_query


def get_smart_image_query(base_topic, title, ai_image_query=None):
    ai_image_query = normalize_text(ai_image_query)

    if ai_image_query and len(ai_image_query.split()) >= 3:
        return ai_image_query

    return get_image_query(base_topic, title)


def validate_generated_post(post, base_topic, sub_topic, recent_posts):
    if not isinstance(post, dict):
        return False, "response was not a JSON object"

    title = normalize_text(post.get("title"), 180)
    body = clean_body(post.get("body"))
    paragraphs = [part.strip() for part in body.split("\n\n") if part.strip()]

    if is_generic_text(title):
        return False, "title was generic"
    if not 4 <= len(title.split()) <= 18:
        return False, "title length was outside the allowed range"
    if len(paragraphs) != 2:
        return False, "body did not contain exactly two paragraphs"
    if any(not 55 <= len(paragraph.split()) <= 135 for paragraph in paragraphs):
        return False, "paragraph length was outside the allowed range"

    subtopic_tokens = normalize_tokens(sub_topic)
    title_overlap = len(subtopic_tokens & normalize_tokens(title))
    body_overlap = len(subtopic_tokens & normalize_tokens(body))
    required_body_overlap = min(3, max(2, len(subtopic_tokens)))
    if title_overlap < 1 or body_overlap < required_body_overlap:
        return False, "title or body drifted away from the assigned subtopic"
    if is_duplicate_post(title, sub_topic, recent_posts):
        return False, "title or subtopic duplicated a recent post"
    if normalize_text(base_topic).lower() == normalize_text(sub_topic).lower():
        return False, "subtopic was not narrower than its parent topic"

    return True, ""


def generate_specific_post(base_topic, sub_topic, content_angle, recent_posts):
    recent_titles = [
        normalize_text(item.get("title"), 180)
        for item in recent_posts[:16]
        if item.get("title")
    ]
    prompt = f"""
Write one precise educational post for Smarty.

Return ONLY valid JSON.
Do not use markdown.
Do not explain outside JSON.
Do not cut off the JSON.

Parent topic:
{base_topic}

Assigned subtopic:
{sub_topic}

Required lens:
{content_angle["label"]}: {content_angle["instruction"]}

Recent titles to avoid echoing:
{json.dumps(recent_titles, ensure_ascii=False)}

Specificity contract:
- The parent topic is only a category label. Do not explain {base_topic} generally.
- Teach only the assigned subtopic. Do not replace it with a neighboring concept.
- Use the standard domain meaning of every named term; never guess a mechanism from its name.
- Silently check the causal explanation for internal consistency before returning JSON.
- If the exact mechanism is uncertain, return {{"error": "uncertain"}} instead of inventing an explanation.
- Name concrete components, signals, forces, stages, people, places, or events.
- Trace at least three connected causal steps using active verbs.
- Include one specific constraint, failure point, measurement, or tradeoff.
- Use one concrete example that directly demonstrates the assigned mechanism.
- A reader should be able to answer "what exactly happens?" after reading.

Title rules:
- Write a natural title of 5 to 13 words.
- Signal the exact mechanism or question without using clickbait.
- Never use "Introduction", "Overview", "Everything about", "The future of", or "Things to know".

Body rules:
- Write two separate fields named mechanismParagraph and exampleParagraph.
- Each field must contain 60 to 110 words with no newline characters.
- mechanismParagraph begins with a concrete observation, object, event, or result and traces how it unfolds.
- exampleParagraph explains the constraint or tradeoff through one concrete example.
- Prefer precise nouns and active verbs over adjectives.
- Avoid advice, motivation, broad surveys, and unsupported sensational claims.
- For history, identify the actors and trace a specific change in power, borders, trade, technology, or daily life.
- Do not invent exact dates. Use exact dates only when you are confident.

Return exactly this JSON shape:
{{
  "title": "specific natural title",
  "mechanismParagraph": "60 to 110 words explaining the causal chain",
  "exampleParagraph": "60 to 110 words applying it to one concrete example",
  "image_search_query": "four to eight concrete visual search words"
}}
"""

    try:
        content = call_bedrock_text(
            prompt,
            max_tokens=700,
            temperature=0.52,
            model_id=POST_MODEL_ID,
        )
        parsed = extract_json_object(content)
        mechanism_paragraph = clean_body(
            (parsed or {}).get("mechanismParagraph")
        ).replace("\n", " ").strip()
        example_paragraph = clean_body(
            (parsed or {}).get("exampleParagraph")
        ).replace("\n", " ").strip()
        candidate = {
            "title": normalize_text((parsed or {}).get("title"), 180),
            "body": f"{mechanism_paragraph}\n\n{example_paragraph}".strip(),
            "image_search_query": normalize_text(
                (parsed or {}).get("image_search_query"),
                200,
            ),
        }
        valid, reason = validate_generated_post(
            candidate,
            base_topic,
            sub_topic,
            recent_posts,
        )
        if not valid:
            logger.warning(
                "POST QUALITY REJECTED topic=%s subtopic=%s reason=%s",
                base_topic,
                sub_topic,
                reason,
            )
            return None

        return {
            "title": candidate["title"],
            "body": candidate["body"],
            "image_search_query": (
                candidate["image_search_query"]
                or get_image_query(base_topic, candidate["title"])
            ),
        }

    except Exception as e:
        logger.error("SPECIFIC POST GENERATION ERROR: %s", str(e))
        return None

def paginated_scan_topic_images(limit_items=30):
    items = []
    last_key = None

    while len(items) < limit_items:
        kwargs = {
            "ProjectionExpression": "topic, imageKey",
            "Limit": min(20, limit_items - len(items)),
        }

        if last_key:
            kwargs["ExclusiveStartKey"] = last_key

        result = table.scan(**kwargs)
        items.extend(result.get("Items", []))
        last_key = result.get("LastEvaluatedKey")

        if not last_key:
            break

    return items[:limit_items]


def get_cached_image(base_topic):
    try:
        result_items = paginated_scan_topic_images(30)

        for item in result_items:
            image_key = item.get("imageKey")
            if item.get("topic") == base_topic and image_key:
                return image_key

    except Exception as e:
        logger.error("CACHE IMAGE ERROR: %s", str(e))

    return None


def fetch_pexels_image(base_topic, title, ai_image_query=None):
    if not PEXELS_API_KEY:
        logger.info("PEXELS_API_KEY missing")
        return None

    try:
        search_query = get_smart_image_query(base_topic, title, ai_image_query)
        query = urllib.parse.quote(search_query.replace("/", " "))

        url = f"https://api.pexels.com/v1/search?query={query}&per_page=8&orientation=landscape"

        req = urllib.request.Request(
            url,
            headers={
                "Authorization": PEXELS_API_KEY,
                "User-Agent": "Mozilla/5.0",
            },
        )

        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as response_data:
            data = json.loads(response_data.read().decode("utf-8"))

        photos = data.get("photos", [])

        if not photos:
            return None

        photos = sorted(
            photos,
            key=lambda p: (
                p.get("width", 0) * p.get("height", 0),
                p.get("width", 0),
            ),
            reverse=True,
        )

        photo = random.choice(photos[:4])
        src = photo.get("src", {})

        return src.get("large2x") or src.get("large") or src.get("medium")

    except Exception as e:
        logger.error("PEXELS ERROR: %s", str(e))
        return None


def upload_image_to_s3(image_url):
    if not image_url:
        return None

    try:
        req = urllib.request.Request(
            image_url,
            headers={"User-Agent": "Mozilla/5.0"},
        )

        with urllib.request.urlopen(req, timeout=IMAGE_DOWNLOAD_TIMEOUT) as response_data:
            image_bytes = response_data.read(MAX_IMAGE_BYTES + 1)
            content_type = response_data.headers.get("Content-Type", "image/jpeg")

        if len(image_bytes) > MAX_IMAGE_BYTES:
            logger.warning("IMAGE TOO LARGE")
            return None

        ext_map = {
            "image/jpeg": "jpg",
            "image/jpg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
        }

        content_type = content_type.lower().split(";")[0].strip()
        ext = ext_map.get(content_type, "jpg")
        image_key = f"images/ai-{uuid.uuid4()}.{ext}"

        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=image_key,
            Body=image_bytes,
            ContentType=content_type,
            CacheControl="public, max-age=31536000",
        )

        return image_key

    except Exception as e:
        logger.error("UPLOAD ERROR: %s", str(e))
        return None


def get_fallback_image():
    return random.choice(FALLBACK_IMAGES)


def scheduled_post_id(event):
    """Use the scheduled instant, not the delivery ID, across scheduler retries."""
    if event.get("source") != "smarty.learning.schedule":
        return None
    if event.get("requestContext") or event.get("httpMethod"):
        raise ValueError("Scheduled generation cannot be requested through HTTP")
    scheduled_time = datetime.fromisoformat(str(event.get("scheduledTime", "")).replace("Z", "+00:00"))
    if scheduled_time.tzinfo is None:
        raise ValueError("The scheduled learning post requires a timezone")
    canonical_time = scheduled_time.astimezone(timezone.utc).isoformat()
    return "scheduled-learning-" + hashlib.sha256(canonical_time.encode("utf-8")).hexdigest()[:32]


def create_post(publication_id=None):
    if publication_id:
        existing = table.get_item(Key={"id": publication_id}, ConsistentRead=True).get("Item")
        if existing:
            return response(200, {"message": "This scheduled lesson was already published", "post": existing})
    recent_posts = paginated_scan_recent_posts()
    content_angle = choose_content_angle(recent_posts)
    ai_post = None
    try:
        base_topic = reserve_generation_topic()
    except (ClientError, RuntimeError) as error:
        logger.warning(
            "Persistent topic rotation unavailable; using history fallback: %s",
            str(error),
        )
        base_topic = ""
    sub_topic = ""

    for _ in range(MAX_GENERATION_ATTEMPTS):
        if base_topic:
            sub_topic = choose_subtopic_for_topic(base_topic, recent_posts)
        else:
            base_topic, sub_topic = choose_generation_target(recent_posts)
        ai_post = generate_specific_post(
            base_topic,
            sub_topic,
            content_angle,
            recent_posts,
        )
        if ai_post:
            break
        recent_posts.insert(
            0,
            {
                "topic": base_topic,
                "subTopic": sub_topic,
                "contentFingerprint": content_fingerprint(base_topic, sub_topic),
            },
        )

    if not ai_post:
        raise RuntimeError(
            "No post passed the topic-specific quality checks; nothing was published"
        )

    title = normalize_text(ai_post["title"], 180)
    body = clean_body(ai_post["body"])
    parts = [part.strip() for part in body.split("\n\n") if part.strip()]
    p1 = enforce_word_range(parts[0], 80, 125)
    p2 = enforce_word_range(parts[1], 80, 125)
    body = f"{p1}\n\n{p2}".strip()

    ai_image_query = ai_post.get("image_search_query") or ""

    image_url = fetch_pexels_image(base_topic, title, ai_image_query)
    image_key = upload_image_to_s3(image_url) if image_url else None

    if not image_key:
        image_key = get_cached_image(base_topic)

    if not image_key:
        image_key = get_fallback_image()

    now_number = int(time.time() * 1000)
    now_string = str(now_number)
    reel_id = publication_id or str(uuid.uuid4())

    ai_detailed_explanation = generate_detailed_explanation(
        title,
        body,
        base_topic,
        sub_topic,
        content_angle,
    )

    item = {
        "id": reel_id,
        "reelId": reel_id,
        "feedType": "GLOBAL",
        "topic": base_topic,
        "topicDomain": TOPIC_TO_DOMAIN[base_topic],
        "subTopic": sub_topic,
        "contentAngle": content_angle["id"],
        "contentAngleLabel": content_angle["label"],
        "contentFingerprint": content_fingerprint(base_topic, sub_topic),
        "specificityVersion": 2,
        "title": title,
        "body": body,
        "author": "Smarty AI",
        "authorId": "smarty-ai",
        "creatorName": "Smarty AI",
        "likes": 0,
        "saves": 0,
        "views": 0,
        "shares": 0,
        "commentsCount": 0,
        "watchTime": 0,
        "visibility": "public",
        "imageKey": image_key,
        "thumbKey": image_key,
        "createdAt": now_number,
        "updatedAt": now_string,
        "isAutoGenerated": True,
        "aiDetailedExplanation": ai_detailed_explanation,
        "aiDetailedExplanationUpdatedAt": now_number if ai_detailed_explanation else 0,
        "aiDetailedExplanationVersion": (
            EXPLANATION_SCHEMA_VERSION if ai_detailed_explanation else 0
        ),
    }

    try:
        table.put_item(Item=item, ConditionExpression=Attr("id").not_exists())
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        if not publication_id:
            raise
        existing = table.get_item(Key={"id": publication_id}, ConsistentRead=True).get("Item")
        if not existing:
            raise
        return response(200, {"message": "This scheduled lesson was already published", "post": existing})

    if ai_detailed_explanation:
        try:
            persist_post_explanation(
                reel_id,
                item,
                ai_detailed_explanation,
                explanation_source_hash(item),
            )
        except ClientError as error:
            logger.warning(
                "New post explanation cache write failed: %s",
                error.response.get("Error", {}).get("Code", "unknown"),
            )

    return response(200, {
        "message": "Topic-specific post created",
        "post": item,
        "topic": base_topic,
        "topicDomain": TOPIC_TO_DOMAIN[base_topic],
        "subTopic": sub_topic,
        "contentAngle": content_angle["id"],
        "contentAngleLabel": content_angle["label"],
        "title": title,
        "imageKey": image_key,
        "imageQuery": get_smart_image_query(base_topic, title, ai_image_query),
        "aiExplanationSaved": bool(ai_detailed_explanation),
    })


def explanation_source_hash(post):
    source = "\n".join(
        normalize_text(post.get(field) or "", 12000)
        for field in ("title", "body", "topic", "subTopic", "contentAngle")
    )
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def explanation_cache_id(post_id, source_hash):
    identity = f"{post_id}|{source_hash}|{DETAILS_MODEL_ID}"
    return f"post#v{EXPLANATION_SCHEMA_VERSION}#" + hashlib.sha256(identity.encode()).hexdigest()


def read_explanation_cache(post_id, source_hash):
    item = explanations_table.get_item(
        Key={"explanationId": explanation_cache_id(post_id, source_hash)},
        ConsistentRead=True,
    ).get("Item")
    if not item:
        return ""
    if int(item.get("expiresAt") or 0) <= int(time.time()):
        return ""
    if item.get("sourceHash") != source_hash:
        return ""
    if int(item.get("schemaVersion") or 0) != EXPLANATION_SCHEMA_VERSION:
        return ""
    explanation = str(item.get("explanation") or "").strip()
    return explanation if is_complete_detailed_explanation(explanation) else ""


def persist_post_explanation(post_id, post, explanation, source_hash):
    now_number = int(time.time() * 1000)
    now_string = str(now_number)
    cache_item = {
        "explanationId": explanation_cache_id(post_id, source_hash),
        "postId": str(post_id),
        "sourceHash": source_hash,
        "schemaVersion": EXPLANATION_SCHEMA_VERSION,
        "modelId": DETAILS_MODEL_ID,
        "explanation": explanation,
        "createdAt": now_number,
        "updatedAt": now_number,
        "expiresAt": int(time.time()) + 365 * 24 * 60 * 60,
    }

    explanations_table.put_item(Item=cache_item)
    unchanged = Attr("id").exists()
    for field in ("title", "body", "topic", "subTopic", "contentAngle"):
        unchanged = unchanged & (Attr(field).eq(post[field]) if field in post else Attr(field).not_exists())
    table.update_item(
        Key={"id": post.get("id", post_id)},
        ConditionExpression=unchanged,
        UpdateExpression="""
            SET aiDetailedExplanation = :e,
                aiDetailedExplanationUpdatedAt = :t,
                aiDetailedExplanationVersion = :v,
                aiDetailedExplanationSourceHash = :hash,
                aiDetailedExplanationModelId = :model,
                updatedAt = :u
        """,
        ExpressionAttributeValues={
            ":e": explanation,
            ":t": now_number,
            ":v": EXPLANATION_SCHEMA_VERSION,
            ":hash": source_hash,
            ":model": DETAILS_MODEL_ID,
            ":u": now_string,
        },
    )


def ensure_post_explanation(post_id, post):
    source_hash = explanation_source_hash(post)
    cached = read_explanation_cache(post_id, source_hash)
    if cached:
        return cached, True, True
    with generation_lease(explanations_table, "explanationId", explanation_cache_id(post_id, source_hash)):
        return _ensure_post_explanation(post_id, post)


def _ensure_post_explanation(post_id, post):
    source_hash = explanation_source_hash(post)
    saved_explanation = str(post.get("aiDetailedExplanation") or "").strip()
    saved_version = int(post.get("aiDetailedExplanationVersion") or 0)

    if (
        saved_version == EXPLANATION_SCHEMA_VERSION
        and post.get("aiDetailedExplanationSourceHash") == source_hash
        and post.get("aiDetailedExplanationModelId") == DETAILS_MODEL_ID
        and is_complete_detailed_explanation(saved_explanation)
    ):
        try:
            if not read_explanation_cache(post_id, source_hash):
                persist_post_explanation(
                    post_id,
                    post,
                    saved_explanation,
                    source_hash,
                )
        except ClientError as error:
            logger.warning(
                "AI explanation cache backfill failed: %s",
                error.response.get("Error", {}).get("Code", "unknown"),
            )
        return saved_explanation, True, True

    cached_explanation = read_explanation_cache(post_id, source_hash)

    if cached_explanation:
        try:
            persist_post_explanation(
                post_id,
                post,
                cached_explanation,
                source_hash,
            )
        except ClientError as error:
            logger.warning(
                "AI explanation post backfill failed: %s",
                error.response.get("Error", {}).get("Code", "unknown"),
            )
        return cached_explanation, True, True

    explanation = generate_detailed_explanation(
        post.get("title", ""),
        post.get("body", ""),
        post.get("topic", ""),
        post.get("subTopic", ""),
        post.get("contentAngle", ""),
    )

    if not explanation:
        return "", False, False

    try:
        persist_post_explanation(post_id, post, explanation, source_hash)
        return explanation, False, True
    except ClientError as error:
        logger.error(
            "SAVE AI EXPLANATION ERROR: %s",
            error.response.get("Error", {}),
        )
        return explanation, False, False


def handle_details(event):
    body = get_body(event)

    if body is None:
        return response(400, {"error": "Invalid JSON body"})

    post_id = body.get("postId") or body.get("id") or body.get("reelId")

    if not post_id:
        return response(400, {"error": "Missing postId"})

    post = get_post(post_id, consistent_read=True)

    if not post:
        return response(404, {"error": "Post not found"})

    saved_explanation, cached, persisted = ensure_post_explanation(post_id, post)

    return response(200, {
        "postId": post_id,
        "explanation": saved_explanation,
        "cached": cached,
        "persisted": persisted,
        "aiDetailedExplanationVersion": EXPLANATION_SCHEMA_VERSION,
        "post": {
            "id": post.get("id", post_id),
            "reelId": post.get("reelId", post_id),
            "title": post.get("title", ""),
            "body": post.get("body", ""),
            "topic": post.get("topic", ""),
            "subTopic": post.get("subTopic", ""),
            "contentAngle": post.get("contentAngle", ""),
            "contentAngleLabel": post.get("contentAngleLabel", ""),
            "aiDetailedExplanation": saved_explanation,
            "aiDetailedExplanationVersion": EXPLANATION_SCHEMA_VERSION,
        },
    })


def handle_ask_doubt(event):
    body = get_body(event)

    if body is None:
        return response(400, {"error": "Invalid JSON body"})

    user_id = get_user_id(event, body)
    if user_id == "anonymous-user":
        return response(401, {"error": "Please sign in to ask a question."})
    post_id = body.get("postId") or body.get("id") or body.get("reelId")
    question = normalize_text(body.get("question") or "", 700)

    if not post_id:
        return response(400, {"error": "Missing postId"})

    if not question:
        return response(400, {"error": "Missing question"})

    post = get_post(post_id, consistent_read=True)

    if not post:
        return response(404, {"error": "Post not found"})

    normalized_question = re.sub(r"\s+", " ", question.casefold()).strip()
    question_hash = hashlib.sha256(normalized_question.encode("utf-8")).hexdigest()
    # Exact-question reuse only. Personal questions stay account-scoped; no
    # approximate/semantic matching that could leak one user's question.
    public_post = str(post.get("visibility", "")).lower() == "public"
    personal = re.search(r"\b(i|me|my|mine|we|our|patient|client)\b|@|https?://|\d{7,}", normalized_question)
    scope = "shared" if public_post and not personal else f"user:{user_id}"
    identity = "|".join((scope, str(post_id), explanation_source_hash(post), DETAILS_MODEL_ID, question_hash))
    doubt_id = "answer-v2#" + hashlib.sha256(identity.encode()).hexdigest()
    existing = doubts_table.get_item(Key={"doubtId": doubt_id}, ConsistentRead=True).get("Item")
    if existing and existing.get("answer") and int(existing.get("expiresAt") or 0) > int(time.time()):
        return response(200, {"answer": existing["answer"], "cached": True, "alreadyAsked": True})
    with generation_lease(doubts_table, "doubtId", doubt_id):
        return answer_doubt(post, post_id, question, question_hash, doubt_id, user_id, scope)


def answer_doubt(post, post_id, question, question_hash, doubt_id, user_id, scope):

    existing = doubts_table.get_item(
        Key={"doubtId": doubt_id},
        ConsistentRead=True,
    ).get("Item")

    if existing and existing.get("answer") and int(existing.get("expiresAt") or 0) > int(time.time()):
        return response(200, {
            "answer": existing.get("answer", ""),
            "alreadyAsked": True,
            "question": existing.get("question", ""),
            "message": "Loaded the saved answer to this question.",
        })

    saved_explanation, _, _ = ensure_post_explanation(post_id, post)

    prompt = f"""
You are Smarty AI. A student has one doubt about this post.

Important rules:
- Use curiosity, psychology and blog-like writing.
- Do not use markdown symbols like ###, **, __, or code blocks.
- Do not sound robotic.
- Make it informative and interesting.
- Answer directly.
- Use simple language.
- Use one example only if useful.
- Keep the answer under 250 words.

Post title:
{post.get("title", "")}

Post body:
{post.get("body", "")}

Saved explanation:
{saved_explanation}

Student doubt:
{question}
"""

    answer = call_bedrock_text(
        prompt,
        max_tokens=400,
        temperature=0.45,
        model_id=DETAILS_MODEL_ID
    )

    now_number = int(time.time() * 1000)

    try:
        doubts_table.put_item(
            Item={
                "doubtId": doubt_id,
                **({"userId": user_id} if scope != "shared" else {}),
                "cacheScope": scope,
                "sourceHash": explanation_source_hash(post),
                "postId": post_id,
                "questionHash": question_hash,
                "question": question,
                "answer": answer,
                "modelId": DETAILS_MODEL_ID,
                "createdAt": now_number,
                "expiresAt": int(time.time()) + 365 * 24 * 60 * 60,
            },
            ConditionExpression=Attr("doubtId").not_exists() | Attr("expiresAt").lte(int(time.time())),
        )
    except doubts_table.meta.client.exceptions.ConditionalCheckFailedException:
        existing = doubts_table.get_item(
            Key={"doubtId": doubt_id},
            ConsistentRead=True,
        ).get("Item")
        if existing:
            return response(200, {
                "answer": existing.get("answer", ""),
                "alreadyAsked": True,
                "question": existing.get("question", ""),
                "message": "Loaded the saved answer to this question.",
            })
        raise

    return response(200, {
        "answer": answer,
        "alreadyAsked": False,
    })


def lambda_handler(event, context):
    method = get_method(event)
    route = get_route(event)

    if method == "OPTIONS":
        return response(200, {})

    if method and method not in ("GET", "POST"):
        return response(405, {"error": "Method not allowed"})

    try:
        if route.endswith("/posts/details") or route.endswith("/details"):
            return handle_details(event)

        if route.endswith("/posts/ask-doubt") or route.endswith("/ask-doubt"):
            return handle_ask_doubt(event)

        publication_id = scheduled_post_id(event)
        if publication_id:
            with generation_lease(explanations_table, "explanationId", publication_id):
                return create_post(publication_id=publication_id)
        return create_post()

    except GenerationBusy:
        if event.get("source") == "smarty.learning.schedule":
            raise
        result = response(503, {"error": "This content is being prepared. Please try again shortly.", "retryable": True})
        result["headers"] = {**HEADERS, "Retry-After": "3"}
        return result

    except ClientError as e:
        if event.get("source") == "smarty.learning.schedule":
            raise
        error = e.response.get("Error", {})
        logger.error("AWS ClientError: %s", error)

        return response(500, {
            "error": "AWS service error",
            "code": error.get("Code"),
            "message": error.get("Message"),
        })

    except BotoCoreError as e:
        if event.get("source") == "smarty.learning.schedule":
            raise
        logger.error("AWS BotoCoreError: %s", str(e))

        return response(500, {
            "error": "AWS service error",
            "message": str(e),
        })

    except Exception as e:
        if event.get("source") == "smarty.learning.schedule":
            raise
        logger.exception("ERROR: %s", str(e))

        return response(500, {
            "error": "Internal server error",
            "message": str(e),
        })
