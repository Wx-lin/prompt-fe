"""Loopback-only API/worker fixture with real isolated PostgreSQL and Redis.

From the backend checkout (never source its .env):
  AIGC_TEST_DATABASE_URL=postgresql+asyncpg://USER@127.0.0.1:5432/TEST_DATABASE \
    uv run python /ABSOLUTE/FRONTEND/e2e/helpers/prompt-analysis-fixture.py \
    --backend-root "$PWD"
Run Next on 3126 with API_BASE_URL=http://127.0.0.1:8026, AIGC_DEMO_MODE=false,
and an empty NEXT_PUBLIC_GOOGLE_CLIENT_ID. Then, from the frontend checkout:
  AIGC_PROMPT_INTEGRATION=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3126 \
    npx playwright test e2e/image-to-prompt.spec.ts --workers=1

Only COS, vision, and email-code delivery/verification are replaced. Production
authentication, image validation, API, job protocol, quotas, edits and history run
unchanged. Every start creates a random schema and Redis key namespace; graceful
shutdown drops that schema and deletes only its keys. It never calls FLUSHDB.
"""

import argparse
import asyncio
import hashlib
import hmac
import os
import re
import secrets
import sys
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote, urlsplit


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend-root", required=True, type=Path)
    parser.add_argument("--port", type=int, default=8026)
    args = parser.parse_args()
    if not (args.backend_root / "app/config.py").is_file():
        parser.error("--backend-root must point to the local backend checkout")
    database_url = os.environ.get("AIGC_TEST_DATABASE_URL", "")
    database = urlsplit(database_url)
    if (
        database.scheme != "postgresql+asyncpg"
        or database.hostname not in {"127.0.0.1", "localhost", "::1"}
        or "test" not in database.path.lower()
        or database.query
    ):
        parser.error("AIGC_TEST_DATABASE_URL must be an explicit loopback PostgreSQL test database")
    redis_url = os.environ.get("AIGC_TEST_REDIS_URL", "redis://127.0.0.1:6379/15")
    redis = urlsplit(redis_url)
    if (
        redis.scheme != "redis"
        or redis.hostname not in {"127.0.0.1", "localhost", "::1"}
        or redis.path != "/15"
        or redis.query
    ):
        parser.error("AIGC_TEST_REDIS_URL must use a loopback Redis server and database 15")
    if not 1024 <= args.port <= 65535:
        parser.error("--port must be between 1024 and 65535")
    return args, database_url, redis_url


def create_app(args, database_url, redis_url):
    sys.path.insert(0, str(args.backend_root.resolve()))
    # Import config alone, then provide every field explicitly. No settings
    # instance may read the checkout's .env or inherit unrelated shell secrets.
    import app.config as config

    defaults = {
        name: field.get_default(call_default_factory=True)
        for name, field in config.Settings.model_fields.items()
    }
    settings = config.Settings(
        _env_file=None,
        **{
            **defaults,
            "database_url": database_url,
            "redis_url": redis_url,
            "jwt_secret_key": secrets.token_urlsafe(48),
            "prompt_analysis_enabled": True,
            "prompt_analysis_worker_enabled": True,
            "prompt_analysis_daily_limit": 100,
            "prompt_analysis_global_daily_limit": 10000,
            "prompt_analysis_queue_limit": 100,
            "prompt_analysis_upload_hourly_limit": 1000,
            "prompt_analysis_global_upload_daily_limit": 10000,
            "prompt_vision_base_url": "https://fixture.invalid/v1",
            "prompt_vision_api_key": "fixture-only-unused",
            "prompt_vision_model": "fixture-vision",
            "prompt_analysis_call_timeout": 120,
            "prompt_analysis_execution_timeout": 180,
            "cos_secret_id": "fixture-only-unused",
            "cos_secret_key": "fixture-only-unused",
            "cos_bucket": "fixture-only-unused",
        },
    )
    config.get_settings.cache_clear()
    config.get_settings = lambda: settings

    import redis.asyncio as redis
    from fastapi import APIRouter, Depends, FastAPI, HTTPException, Response
    from pydantic import BaseModel, ConfigDict
    from sqlalchemy import select, text
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.database import Base, get_db
    from app.database import engine as default_engine
    from app.models import PromptAnalysis, User
    from app.redis import get_redis_client
    from app.routers import auth, categories, model_catalog, prompt_analyses, prompts, search
    from app.schemas.auth import TokenResponse
    from app.schemas.prompt_analysis import ModelResult
    from app.services import auth_service, cos_service, vision
    from app.services.prompt_analysis import storage
    from app.utils.jwt import create_access_token
    from app.utils.prompt_analysis_http import PromptAnalysisBoundary
    from app.workers.prompt_analysis import run_once

    run_id = uuid.uuid4().hex
    schema = "test_prompt_browser_" + run_id
    namespace = "prompt-browser:" + run_id + ":"
    base_url = f"http://127.0.0.1:{args.port}"
    signing_key = secrets.token_bytes(32)
    admin_engine = create_async_engine(database_url, echo=False)
    engine = create_async_engine(
        database_url, echo=False, connect_args={"server_settings": {"search_path": schema}}
    )
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    raw_redis = redis.Redis.from_url(redis_url, decode_responses=True)
    state = {"objects": {}, "calls": [], "next_modes": {}, "gates": {}}
    worker_task = None

    class NamespacedRedis:
        async def eval(self, script, numkeys, *values):
            keys = [namespace + str(key) for key in values[:numkeys]]
            return await raw_redis.eval(script, numkeys, *keys, *values[numkeys:])

        async def get(self, key):
            return await raw_redis.get(namespace + key)

        async def set(self, key, value, **kwargs):
            return await raw_redis.set(namespace + key, value, **kwargs)

    async def database():
        async with sessions() as db:
            yield db

    def no_cos_client():
        raise RuntimeError("Real COS is forbidden in the browser fixture")

    async def put_private(body, object_key):
        state["objects"] = {**state["objects"], object_key: bytes(body)}

    async def read_private(object_key):
        return state["objects"][object_key]

    async def delete_private(object_key):
        state["objects"] = {key: value for key, value in state["objects"].items() if key != object_key}

    def signature(object_key, expires):
        return hmac.new(signing_key, f"{object_key}:{expires}".encode(), hashlib.sha256).hexdigest()

    def preview_url(object_key):
        expires = int(time.time()) + 600
        path = quote(object_key, safe="/")
        signed = signature(object_key, expires)
        return f"{base_url}/__fixture/media/{path}?expires={expires}&signature={signed}"

    result = ModelResult.model_validate(
        {
            "schema_version": "1",
            "title": "粉色方块参考图",
            "prompt": {
                "zh": "一块粉色抽象方块，干净背景，柔和光线，简洁构图。",
                "en": "A pink abstract square on a clean background, soft light, minimal composition.",
            },
            "breakdown": {
                "subject": {"zh": "粉色抽象方块", "en": "A pink abstract square"},
                "composition": {"zh": "居中构图", "en": "Centered composition"},
                "lighting": {"zh": "柔和均匀光线", "en": "Soft even light"},
                "style": {"zh": "极简抽象风格", "en": "Minimal abstract style"},
            },
            "uncertain_details": [],
        }
    )

    async def analyze_image(image_bytes, *, timeout):
        assert image_bytes and timeout > 0
        async with sessions() as db:
            row = (
                await db.execute(
                    select(PromptAnalysis.id, User.email)
                    .join(User, User.id == PromptAnalysis.user_id)
                    .where(PromptAnalysis.status == "running")
                    .order_by(PromptAnalysis.started_at.desc())
                    .limit(1)
                )
            ).one()
        email = row.email
        mode = state["next_modes"].get(email, "success")
        state["next_modes"] = {key: value for key, value in state["next_modes"].items() if key != email}
        state["calls"] = [*state["calls"], {"email": email, "analysis_id": str(row.id), "mode": mode}]
        if mode == "hold":
            gate = asyncio.Event()
            state["gates"] = {**state["gates"], email: gate}
            await gate.wait()
            state["gates"] = {key: value for key, value in state["gates"].items() if key != email}
        if mode == "failure":
            raise vision.VisionError("model_upstream_error")
        return vision.VisionResult(result, "fixture-" + str(row.id), {"total_tokens": 24}, "fixture-vision")

    storage.put_private = put_private
    storage.read_private = read_private
    storage.delete_private = delete_private
    storage.preview_url = preview_url
    cos_service._build_client = no_cos_client
    vision.analyze_image = analyze_image

    async def worker():
        while True:
            if not await run_once(sessions):
                await asyncio.sleep(0.05)

    @asynccontextmanager
    async def lifespan(_app):
        nonlocal worker_task
        created = False
        task = None
        try:
            await raw_redis.ping()
            async with admin_engine.begin() as conn:
                await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
                created = True
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            task = asyncio.create_task(worker())
            worker_task = task
            print(f"Fixture ready on {base_url}; schema={schema}; Redis namespace={namespace}", flush=True)
            yield
        finally:
            if task is not None:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                except Exception as exc:
                    # A failed claim must not strand this fixture's schema/keys.
                    print(f"Fixture worker failed: {type(exc).__name__}", flush=True)
            await engine.dispose()
            if created:
                async with admin_engine.begin() as conn:
                    await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            keys = [key async for key in raw_redis.scan_iter(match=namespace + "*")]
            if keys:
                await raw_redis.delete(*keys)
            await raw_redis.aclose()
            await admin_engine.dispose()
            await default_engine.dispose()

    app = FastAPI(lifespan=lifespan)
    app.add_middleware(PromptAnalysisBoundary)
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_redis_client] = lambda: NamespacedRedis()
    for router in (
        prompt_analyses.router,
        prompts.router,
        categories.router,
        model_catalog.router,
        search.router,
    ):
        app.include_router(router)
    actual_auth = APIRouter()
    actual_auth.routes = [
        route for route in auth.router.routes if route.path == "/api/auth/me" and "GET" in route.methods
    ]
    app.include_router(actual_auth)

    def test_email(value):
        return bool(re.fullmatch(r"sample(?:\+[A-Za-z0-9-]+)?@example\.test", value))

    class FixtureEmail(BaseModel):
        model_config = ConfigDict(extra="forbid", strict=True)
        email: str

    class FixtureCode(FixtureEmail):
        code: str

    @app.post("/api/auth/send-code", status_code=204)
    async def send_code(body: FixtureEmail):
        if not test_email(body.email):
            raise HTTPException(400, "Use a fixture email")
        return Response(status_code=204)

    @app.post("/api/auth/verify-code", response_model=TokenResponse)
    async def verify_code(body: FixtureCode, db=Depends(database)):
        if not test_email(body.email) or body.code != "123456":
            raise HTTPException(400, "Invalid fixture code")
        user = await auth_service.get_or_create_user_by_email(db, body.email)
        return TokenResponse(access_token=create_access_token(user.id))

    class Control(BaseModel):
        model_config = ConfigDict(extra="forbid")
        email: str
        mode: str = "success"

    @app.post("/__fixture/next-vision")
    async def next_vision(body: Control):
        if not test_email(body.email) or body.mode not in {"success", "hold", "failure"}:
            raise HTTPException(422)
        state["next_modes"] = {**state["next_modes"], body.email: body.mode}
        return {"configured": True}

    @app.post("/__fixture/release")
    async def release(body: Control):
        if not test_email(body.email):
            raise HTTPException(422)
        gate = state["gates"].get(body.email)
        if gate is not None:
            gate.set()
        else:
            # UI setup may fail while a job is queued, before analyze_image has
            # installed its gate. Release that intent too, so later tests run.
            state["next_modes"] = {
                key: value
                for key, value in state["next_modes"].items()
                if key != body.email or value != "hold"
            }
        return {"released": True}

    @app.get("/__fixture/metrics")
    async def metrics(email: str):
        async with sessions() as db:
            jobs = list(
                await db.scalars(
                    select(PromptAnalysis)
                    .join(User, User.id == PromptAnalysis.user_id)
                    .where(User.email == email)
                    .order_by(PromptAnalysis.created_at)
                )
            )
        return {
            "calls": sum(call["email"] == email for call in state["calls"]),
            "job_count": len(jobs),
            "statuses": [job.status for job in jobs],
            "deleted_count": sum(job.deleted_at is not None for job in jobs),
        }

    @app.get("/__fixture/media/{object_key:path}")
    async def media(object_key: str, expires: int, signature: str):
        expected = hmac.new(signing_key, f"{object_key}:{expires}".encode(), hashlib.sha256).hexdigest()
        if (
            expires < time.time()
            or not hmac.compare_digest(signature, expected)
            or object_key not in state["objects"]
        ):
            raise HTTPException(404)
        return Response(
            state["objects"][object_key],
            media_type="image/jpeg",
            headers={"Cache-Control": "private, no-store"},
        )

    @app.get("/health")
    async def health():
        if worker_task is not None and not worker_task.done():
            return {"status": "ok", "worker_running": True, "isolated_fixture": True}
        raise HTTPException(503, "Fixture worker unavailable")

    return app


if __name__ == "__main__":
    import uvicorn

    args, database_url, redis_url = arguments()
    uvicorn.run(
        create_app(args, database_url, redis_url), host="127.0.0.1", port=args.port, log_level="warning"
    )
