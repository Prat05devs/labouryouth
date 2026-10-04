"""Hirer WhatsApp contact and Google Maps links in place of device GPS (Decision 21)."""

from alembic import op

revision = "0003_contact_maps"
down_revision = "0002_marketplace"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE client_profiles ADD COLUMN whatsapp_number VARCHAR(20)")
    op.execute("ALTER TABLE addresses ADD COLUMN maps_url VARCHAR(500)")
    op.execute("ALTER TABLE addresses ADD COLUMN location_precision VARCHAR(10) DEFAULT 'PIN' NOT NULL")
    op.execute("ALTER TABLE job_requests ADD COLUMN maps_url VARCHAR(500)")
    op.execute("ALTER TABLE job_requests ADD COLUMN contact_whatsapp VARCHAR(20)")
    op.execute("ALTER TABLE job_requests ADD COLUMN location_precision VARCHAR(10) DEFAULT 'PIN' NOT NULL")
    for table in ("addresses", "job_requests"):
        op.execute(
            f"ALTER TABLE {table} ADD CONSTRAINT ck_location_precision_values "
            "CHECK (location_precision IN ('PIN','AREA'))"
        )


def downgrade():
    for table in ("addresses", "job_requests"):
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT ck_location_precision_values")
    op.execute("ALTER TABLE job_requests DROP COLUMN location_precision")
    op.execute("ALTER TABLE job_requests DROP COLUMN contact_whatsapp")
    op.execute("ALTER TABLE job_requests DROP COLUMN maps_url")
    op.execute("ALTER TABLE addresses DROP COLUMN location_precision")
    op.execute("ALTER TABLE addresses DROP COLUMN maps_url")
    op.execute("ALTER TABLE client_profiles DROP COLUMN whatsapp_number")
