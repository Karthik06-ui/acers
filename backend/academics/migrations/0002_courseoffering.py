
import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0001_initial'),
        ('accounts', '0002_hod_faculty_student'),
    ]

    operations = [
        migrations.CreateModel(
            name='CourseOffering',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                (
                    'capacity',
                    models.PositiveIntegerField(
                        validators=[
                            django.core.validators.MinValueValidator(1)
                        ]
                    ),
                ),
                (
                    'status',
                    models.CharField(
                        choices=[('Open', 'Open'), ('Closed', 'Closed')],
                        db_index=True,
                        default='Open',
                        max_length=10,
                    ),
                ),
                (
                    'created_at',
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    'updated_at',
                    models.DateTimeField(auto_now=True),
                ),
                (
                    'course',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='offerings',
                        to='academics.course',
                    ),
                ),
                (
                    'faculty',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='offerings',
                        to='accounts.faculty',
                    ),
                ),
                (
                    'semester',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='offerings',
                        to='academics.semester',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Course Offering',
                'verbose_name_plural': 'Course Offerings',
                'ordering': [
                    '-semester__academic_year',
                    'course__code',
                ],
            },
        ),
        migrations.AddIndex(
            model_name='courseoffering',
            index=models.Index(
                fields=['semester', 'status'],
                name='academics_c_semeste_838b86_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='courseoffering',
            index=models.Index(
                fields=['faculty', 'semester'],
                name='academics_c_faculty_66bc13_idx',  
            ),
        ),
        migrations.AlterUniqueTogether(
            name='courseoffering',
            unique_together={('course', 'faculty', 'semester')},
        ),
    ]
