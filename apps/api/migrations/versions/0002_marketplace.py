"""Marketplace layer: localities and worker interest on open jobs."""

from alembic import op

revision = "0002_marketplace"
down_revision = "0001_domain"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE TABLE localities (\n\tcity_id UUID NOT NULL, \n\tname VARCHAR(100) NOT NULL, \n\tname_hi VARCHAR(100) NOT NULL, \n\tslug VARCHAR(100) NOT NULL, \n\tcenter geography(POINT,4326), \n\tactive BOOLEAN NOT NULL, \n\tsort_order INTEGER NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (slug), \n\tFOREIGN KEY(city_id) REFERENCES cities (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_localities_city_id ON localities (city_id)")
    op.execute(
        "CREATE TABLE job_interests (\n\tjob_id UUID NOT NULL, \n\tworker_id UUID NOT NULL, \n\tstatus VARCHAR(40) NOT NULL, \n\tdistance_m INTEGER NOT NULL, \n\toffer_id UUID, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (job_id, worker_id), \n\tCONSTRAINT ck_status_values CHECK (status IN ('EXPRESSED','WITHDRAWN','SELECTED')), \n\tFOREIGN KEY(job_id) REFERENCES job_requests (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(worker_id) REFERENCES worker_profiles (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(offer_id) REFERENCES job_offers (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_job_interests_job_id ON job_interests (job_id)")
    op.execute("CREATE INDEX ix_job_interests_worker_id ON job_interests (worker_id)")
    op.execute("CREATE INDEX ix_job_interests_status ON job_interests (status)")
    op.execute("CREATE INDEX ix_job_interests_offer_id ON job_interests (offer_id)")


def downgrade():
    op.execute("DROP TABLE job_interests")
    op.execute("DROP TABLE localities")
