from alembic import context
from app.database import Base
from app import models
from app.config import get_settings

config = context.config
target_metadata = Base.metadata

def get_url():
    settings = get_settings()
    return settings.resolved_database_url or config.get_main_option("sqlalchemy.url")

def run_migrations_offline():
    url = get_url()
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    from sqlalchemy import create_engine
    connectable = create_engine(get_url())
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
