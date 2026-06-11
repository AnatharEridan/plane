# Generated manually on 2026-06-10

from django.db import connection, migrations

TABLES_WITH_DISPLAY_FILTERS = (
    "project_user_properties",
    "cycle_user_properties",
    "module_user_properties",
    "workspace_user_properties",
)


def migrate_list_layout_to_kanban(apps, schema_editor):
    sql = """
        UPDATE {table}
        SET display_filters = display_filters || '{{"layout": "kanban", "group_by": "state"}}'::jsonb
        WHERE deleted_at IS NULL
          AND COALESCE(display_filters->>'layout', 'list') = 'list';
    """

    with connection.cursor() as cursor:
        for table in TABLES_WITH_DISPLAY_FILTERS:
            cursor.execute(sql.format(table=table))


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0122_profile_default_language_ru"),
    ]

    operations = [
        migrations.RunPython(migrate_list_layout_to_kanban, migrations.RunPython.noop),
    ]
