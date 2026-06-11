# Generated manually on 2026-06-10

from django.db import migrations, models


def set_profile_language_to_russian(apps, schema_editor):
    Profile = apps.get_model("db", "Profile")
    Profile.objects.all().update(language="ru")


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0121_alter_estimate_type"),
    ]

    operations = [
        migrations.RunPython(set_profile_language_to_russian, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="profile",
            name="language",
            field=models.CharField(default="ru", max_length=255),
        ),
    ]
