"""Validate order migrations on a schema-only, disposable PostgreSQL restore.

Requires psycopg 3 and a pre-restored local database, never production. Schema
snapshots and synthetic database files stay outside Git. See the validation report.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import sys
import time

parser = argparse.ArgumentParser()
parser.add_argument('--snapshot-dir', type=Path, required=True)
args = parser.parse_args()
artifacts = args.snapshot_dir.resolve()
sys.path.insert(0, str(artifacts / 'python-vendor'))
import psycopg
from psycopg.types.json import Jsonb

repo = Path(__file__).resolve().parents[1]
snapshot = json.loads((artifacts / 'schema-snapshot.json').read_text(encoding='utf-8'))
settings = json.loads((artifacts / 'roles-settings.json').read_text(encoding='utf-8'))
checks = []
customer_id = '60000000-0000-0000-0000-000000000001'
admin_id = '60000000-0000-0000-0000-000000000002'
category_id = '50000000-0000-0000-0000-000000000010'
priced = '50000000-0000-0000-0000-000000000001'
enquiry = '50000000-0000-0000-0000-000000000002'
draft = '50000000-0000-0000-0000-000000000003'
minimum_path = repo / 'supabase/migrations/20260920042455_enforce_minimum_order_value.sql'
confirmed_path = repo / 'supabase/migrations/20260923165549_require_cart_price_reconfirmation.sql'
legacy = next(f for f in snapshot['functions'] if f['name'] == 'place_order_from_cart')

def connect(name='validation', role=None, identity=None):
    # Deliberately no URL or host parameter; this runner cannot target Supabase.
    conn = psycopg.connect(host='127.0.0.1', port=55437, dbname='xl_launch_staging',
                           user='staging_bootstrap', autocommit=True, application_name=name)
    target = conn.execute('select current_database(),inet_server_addr()::text,inet_server_port()').fetchone()
    assert target == ('xl_launch_staging', '127.0.0.1/32', 55437) or target == ('xl_launch_staging', '127.0.0.1', 55437), target
    conn.execute("set statement_timeout = '20s'")
    conn.execute('set search_path = public,extensions')
    if role:
        assert role in ('postgres', 'anon', 'authenticated')
        conn.execute('set role ' + role)
        conn.execute("select set_config('request.jwt.claims',%s,false)",
                     (json.dumps({'role': role, **({'sub': identity} if identity else {})}),))
    return conn

def check(label, condition=True):
    assert condition, label
    checks.append(label)
    print(f'ok {len(checks)} - {label}', flush=True)

def normalized(value):
    return re.sub(r'\s+', ' ', value or '').strip().rstrip(';')

def acl(value):
    # Grantor metadata is kept in the snapshot. Compare effective role privileges.
    return sorted(x.split('/')[0] for x in value or [])

def counts(conn):
    return conn.execute('select (select count(*) from orders),(select count(*) from order_items)').fetchone()

def line(price=125, quantity=16, product_id=priced):
    return {'product_id': product_id, 'quantity': quantity, 'expected_price': price}

def order(conn, items, endpoint='place_order_from_confirmed_cart', name='Synthetic staging', phone='9876543210'):
    assert endpoint in ('place_order_from_cart', 'place_order_from_confirmed_cart')
    return conn.execute(f'select public.{endpoint}(%s,%s,%s) as id', (name, phone, Jsonb(items))).fetchone()[0]

def reject(conn, items, codes, label, **kwargs):
    before = counts(owner)
    try:
        order(conn, items, **kwargs)
    except psycopg.Error as exc:
        assert exc.sqlstate in codes, (label, exc.sqlstate, str(exc))
    else:
        raise AssertionError(label + ': unexpectedly accepted')
    check(label, counts(owner) == before)

def accepted(conn, items, total, label, endpoint='place_order_from_confirmed_cart'):
    with conn.transaction(force_rollback=True):
        ident = order(conn, items, endpoint)
        # Use the owning customer's permissions, including order-item SELECT RLS.
        row = conn.execute('select total_amount,item_count from orders where id=%s', (ident,)).fetchone()
        lines = conn.execute('select sum(subtotal),sum(quantity) from order_items where order_id=%s', (ident,)).fetchone()
        check(label, row == lines and row[0] == Decimal(str(total)))

def apply_migrations():
    with connect('migration', 'postgres') as migration:
        for path in (minimum_path, minimum_path, confirmed_path, confirmed_path):
            migration.execute(path.read_text(encoding='utf-8'))
    check('both migrations apply twice in deployment order')

def role_suite(label):
    with connect('role-suite', 'postgres') as conn:
        cursor = conn.execute((repo / 'supabase/tests/authorization_security_roles_test.sql').read_text(encoding='utf-8'))
        output = []
        while True:
            if cursor.description:
                output += [str(value) for row in cursor.fetchall() for value in row if value is not None]
            if not cursor.nextset(): break
        lines = '\n'.join(output).splitlines()
        failures = [s for s in lines if re.match(r'not ok\b|Bail out!', s)]
        assertions = [s for s in lines if re.match(r'ok \d+', s)]
        check(label, not failures and len(assertions) == 41 and '1..41' in lines)
        (artifacts / (label.replace(' ', '-') + '.tap')).write_text('\n'.join(lines), encoding='utf-8')

def wait_for_lock(name, event=None):
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        row = owner.execute('select wait_event_type,wait_event from pg_stat_activity where application_name=%s', (name,)).fetchone()
        if row and row[0] == 'Lock' and (event is None or row[1] == event): return
        time.sleep(.05)
    raise AssertionError('Expected real lock wait for ' + name)

with connect() as owner:
    check('fresh staging contains no copied production users, products or orders',
          owner.execute('select (select count(*) from auth.users),(select count(*) from products),(select count(*) from orders)').fetchone() == (0, 0, 0))
    for relation in snapshot['relations']:
        ident = relation['schema'] + '.' + relation['name']
        row = owner.execute('select c.relkind,pg_get_userbyid(c.relowner),c.relrowsecurity,c.relforcerowsecurity,c.reloptions,c.relacl::text[] from pg_class c where c.oid=%s::regclass', (ident,)).fetchone()
        assert row[:5] == (relation['kind'], relation['owner'], relation['rls'], relation['force_rls'], relation['options']), ident
        assert acl(row[5]) == acl(relation['acl']), (ident, 'table grants')
        columns = owner.execute("select a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid),a.attacl::text[] from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=%s::regclass and a.attnum>0 and not a.attisdropped order by a.attnum", (ident,)).fetchall()
        expected = relation['columns']
        assert len(columns) == len(expected), ident
        for column, exp in zip(columns, expected):
            assert column[:5] == (exp['name'], exp['type'], exp['not_null'], exp['identity'], exp['generated']), (ident, exp['name'])
            assert normalized(column[5]) == normalized(exp['default']), (ident, exp['name'], column[5], exp['default'])
            assert acl(column[6]) == acl(exp['acl']), (ident, exp['name'], 'column grants')
        constraints = owner.execute('select conname,pg_get_constraintdef(oid,true) from pg_constraint where conrelid=%s::regclass order by conname', (ident,)).fetchall()
        assert [(n,normalized(d)) for n,d in constraints] == [(c['name'],normalized(c['definition'])) for c in relation['constraints'] or []], (ident, 'constraints')
        indexes = owner.execute('select ci.relname,pg_get_indexdef(i.indexrelid) from pg_index i join pg_class ci on ci.oid=i.indexrelid where i.indrelid=%s::regclass order by ci.relname', (ident,)).fetchall()
        assert [(n,normalized(d)) for n,d in indexes] == [(i['name'],normalized(i['definition'])) for i in relation['indexes'] or []], (ident,'indexes')
        policies = owner.execute("select polname,polpermissive,polcmd,array(select case when rid=0 then 'PUBLIC' else pg_get_userbyid(rid) end from unnest(polroles) rid),pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid) from pg_policy where polrelid=%s::regclass order by polname", (ident,)).fetchall()
        expected_policies = [(p['name'],p['permissive'],p['command'],p['roles'],normalized(p['using']),normalized(p['check'])) for p in relation['policies'] or []]
        assert [(n,pe,cmd,roles,normalized(u),normalized(c)) for n,pe,cmd,roles,u,c in policies] == expected_policies, (ident,'policies')
        triggers = owner.execute('select tgname,pg_get_triggerdef(oid,true),tgenabled from pg_trigger where tgrelid=%s::regclass and not tgisinternal order by tgname', (ident,)).fetchall()
        assert [(n,normalized(d),e) for n,d,e in triggers] == [(t['name'],normalized(t['definition']),t['enabled']) for t in relation['triggers'] or []], (ident,'triggers')
        if relation['kind'] == 'v':
            assert normalized(owner.execute('select pg_get_viewdef(%s::regclass,true)', (ident,)).fetchone()[0]) == normalized(relation['view']), ident
    for function in snapshot['functions']:
        ident = function['schema'] + '.' + function['name'] + '(' + function['identity'] + ')'
        row = owner.execute('select pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner),p.proacl::text[] from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=%s and p.proname=%s and pg_get_function_identity_arguments(p.oid)=%s', (function['schema'], function['name'], function['identity'])).fetchone()
        assert normalized(row[0]) == normalized(function['definition']) and row[1] == function['owner'] and acl(row[2]) == acl(function['acl']), ident
    check('restored columns, constraints, indexes, policies, triggers, views, functions, owners and effective ACLs match captured schema')
    role_suite('41 role assertions before order migrations')
    owner.execute('set role postgres')
    for user, admin in [(customer_id, False), (admin_id, True)]:
        owner.execute('insert into auth.users(id,email) values(%s,%s)', (user, user+'@example.invalid'))
        owner.execute('insert into user_profiles(id,email,is_admin) values(%s,%s,%s)', (user,user+'@example.invalid',admin))
    owner.execute('insert into categories(id,name,slug) values(%s,%s,%s)', (category_id,'Synthetic staging','synthetic-staging'))
    for ident, price, status in [(priced,125,'published'),(enquiry,None,'published'),(draft,125,'draft')]:
        owner.execute("insert into products(id,category_id,name,sku,price,status,is_active,unit_of_measure,quantity_in_unit,moq,order_step) values(%s,%s,'Synthetic staging',%s,%s,%s,true,'pack',10,%s,%s)", (ident,category_id,ident,price,status,2 if ident == priced else 1,20 if ident == priced else 10))
    for setting in settings['order_settings']:
        owner.execute('insert into site_content(key,value) values(%s,%s)', (setting['name'],Jsonb(setting['value'])))
    check('captured live minimum is enabled at 2000', owner.execute("select value from site_content where key='min_order_value'").fetchone()[0] == 2000)
    with connect('customer','authenticated',customer_id) as customer, connect('admin','authenticated',admin_id) as admin, connect('anonymous','anon') as anon:
        accepted(customer,[line(quantity=2)],250,'pre-fix control reproduces below-minimum acceptance','place_order_from_cart')
        apply_migrations()
        reject(customer,[line(quantity=14)],{'22023'},'below the live minimum rejects without orphan records')
        accepted(customer,[line()],2000,'exact live minimum succeeds with consistent header and lines')
        accepted(admin,[line()],2000,'admin uses the same confirmed endpoint successfully')
        reject(admin,[line(quantity=2)],{'22023'},'admin cannot bypass the minimum through the RPC')
        accepted(customer,[line(0,1,enquiry)],0,'all-enquiry exemption is preserved')
        reject(customer,[line(quantity=2),line(0,1,enquiry)],{'22023'},'mixed cart still enforces minimum')
        for price in (100,150,0):
            reject(customer,[line(price)],{'P0001'},f'changed expected price {price} requires reconfirmation')
        reject(customer,[line(125,1,enquiry)],{'P0001'},'priced-to-enquiry change requires reconfirmation')
        for label, item in [('missing',{'product_id':priced,'quantity':16}),('negative',line(-1)),('string',line('125')),('null',line(None))]:
            reject(customer,[item],{'22023'},f'{label} expected price fails closed')
        for quantity in (0,-1,1,3,1.5,1000001):
            reject(customer,[line(quantity=quantity)],{'22023','22P02'},f'quantity {quantity} cannot bypass whole-unit MOQ or step validation')
        reject(customer,[line(),line()],{'22023'},'duplicate products reject atomically')
        reject(customer,[],{'22023'},'empty cart rejects')
        reject(customer,[line(125,16,draft)],{'22023'},'draft products reject without a price-change disclosure')
        reject(customer,[line(product_id='50000000-0000-0000-0000-000000000099')],{'22023'},'missing products reject')
        reject(anon,[line()],{'42501'},'anonymous role cannot call confirmed endpoint')
        reject(customer,[line()],{'42501'},'customer cannot call the legacy endpoint',endpoint='place_order_from_cart')
        reject(admin,[line()],{'42501'},'admin cannot bypass confirmed endpoint through legacy RPC',endpoint='place_order_from_cart')
        for name,phone in [('', '9876543210'),('Synthetic','123'),('x'*121,'9876543210')]:
            reject(customer,[line()],{'22023'},f'invalid customer fields reject ({len(name)} chars/{len(phone)} digits)',name=name,phone=phone)
        owner.execute("update products set is_active=false where id=%s", (priced,))
        reject(customer,[line()],{'22023'},'inactive products reject')
        owner.execute("update products set is_active=true,price=125.50 where id=%s", (priced,))
        accepted(customer,[line(125.5)],2008,'decimal prices remain exact in header and line totals')
        owner.execute('update products set price=125 where id=%s', (priced,))
        owner.execute("create function public.staging_fail_line() returns trigger language plpgsql as $$ begin raise exception 'synthetic line failure'; end $$")
        owner.execute('create trigger staging_fail_line before insert on order_items for each row execute function public.staging_fail_line()')
        reject(customer,[line()],{'P0001'},'line-write failure rolls back the already inserted header')
        owner.execute('drop trigger staging_fail_line on order_items')
        owner.execute('drop function public.staging_fail_line()')

    owner.execute('reset role')
    with ThreadPoolExecutor(max_workers=3) as workers:
        with connect('price-writer') as writer:
            writer.execute('begin')
            writer.execute('update products set price=150 where id=%s', (priced,))
            def stale_request():
                with connect('waiting-order','authenticated',customer_id) as conn:
                    try: order(conn,[line()])
                    except psycopg.Error as exc: return exc.sqlstate,str(exc)
                    raise AssertionError('Stale order accepted')
            waiting = workers.submit(stale_request)
            wait_for_lock('waiting-order')
            writer.execute('commit')
            code,message = waiting.result(timeout=10)
            check('real concurrent writer commits first: blocked order sees change and writes nothing', code == 'P0001' and 'CART_PRICE_CHANGED' in message and counts(owner) == (0,0))
        owner.execute('update products set price=125 where id=%s', (priced,))
        owner.execute("create function public.staging_order_gate() returns trigger language plpgsql as $$ begin perform pg_advisory_xact_lock(913193); return new; end $$")
        owner.execute('create trigger staging_order_gate before insert on orders for each row execute function public.staging_order_gate()')
        with connect('gate') as gate:
            gate.execute('select pg_advisory_lock(913193)')
            def accepted_request():
                with connect('locked-order','authenticated',customer_id) as conn: return order(conn,[line()])
            def competing_update():
                with connect('competing-writer') as conn: conn.execute('update products set price=150 where id=%s', (priced,))
            order_future = workers.submit(accepted_request)
            wait_for_lock('locked-order','advisory')
            writer_future = workers.submit(competing_update)
            wait_for_lock('competing-writer')
            gate.execute('select pg_advisory_unlock(913193)')
            order_id = order_future.result(timeout=10)
            writer_future.result(timeout=10)
            row = owner.execute('select o.total_amount,i.unit_price,i.subtotal from orders o join order_items i on i.order_id=o.id where o.id=%s',(order_id,)).fetchone()
            check('real order-first race: writer waits through header and line writes', row == (Decimal(2000),Decimal(125),Decimal(2000)))
        owner.execute('drop trigger staging_order_gate on orders')
        owner.execute('drop function public.staging_order_gate()')

    owner.execute('set role postgres')
    owner.execute((artifacts/'rollback-order-functions.sql').read_text(encoding='utf-8'))
    row = owner.execute("select pg_get_functiondef(oid),proacl::text[] from pg_proc where oid='public.place_order_from_cart(text,text,jsonb)'::regprocedure").fetchone()
    check('rollback restores exact predecessor function and effective grants', normalized(row[0]) == normalized(legacy['definition']) and acl(row[1]) == acl(legacy['acl']))
    check('rollback removes only the new endpoint', owner.execute("select to_regprocedure('public.place_order_from_confirmed_cart(text,text,jsonb)')").fetchone()[0] is None)
    with connect('rollback-control','authenticated',customer_id) as customer:
        accepted(customer,[line(150,2)],300,'rollback behavior is explicit: previous minimum bypass returns','place_order_from_cart')
    apply_migrations()
    role_suite('41 role assertions after rollback and reapply')
    check('synthetic committed order preserved across rollback and reapply', counts(owner) == (1,1))
    report = {'passed':len(checks),'checks':checks,'schema_sha256':hashlib.sha256((artifacts/'schema-snapshot.json').read_bytes()).hexdigest(),'server_version':owner.execute('show server_version').fetchone()[0], 'scope':'Restored complete public application schema plus captured auth.users and auth helper dependencies; no hosted Auth/PostgREST service or production customer rows.'}
    (artifacts/'validation-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'passed':len(checks),'report':str(artifacts/'validation-results.json')}))
