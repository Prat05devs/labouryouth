from pathlib import Path
from sqlalchemy import create_mock_engine
from app.models import Base
# Freeze SQL into a revision; future model edits cannot change this migration.
statements=[]
engine=create_mock_engine('postgresql://',lambda sql,*a,**kw:statements.append(str(sql.compile(dialect=engine.dialect)).strip()))
Base.metadata.create_all(engine)
root=Path('migrations/versions');root.mkdir(exist_ok=True)
lines=['"""Initial production domain schema, frozen DDL."""','from alembic import op',"revision = '0001_domain'","down_revision = None","branch_labels = None","depends_on = None",'def upgrade():',"    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')"]
for statement in statements:lines.append('    op.execute('+repr(statement)+')')
lines.extend(['    op.execute('+repr("CREATE FUNCTION prevent_immutable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable record'; END; $$")+')'])
for table in ['worker_ledger_entries','attendance_events','audit_logs','cancellations']:
 lines.append('    op.execute('+repr(f'CREATE TRIGGER immutable_{table} BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation()')+')')
lines.extend(['def downgrade():',"    raise RuntimeError('Destructive downgrade requires reviewed backup/restore; no automatic deletion of financial or attendance history.')"])
(root/'0001_domain.py').write_text('\n'.join(lines)+'\n')
print(f'Frozen {len(statements)} schema statements')
