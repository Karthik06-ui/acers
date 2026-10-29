"""
reports/views.py
HOD Reporting endpoint.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.renderers import JSONRenderer, BaseRenderer
from accounts.permissions import IsHOD
from .services import generate_report_data, export_csv


class PassthroughRenderer(BaseRenderer):
    media_type = "*/*"
    format = "csv"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class HODReportsView(APIView):
    permission_classes = [IsHOD]
    renderer_classes = [JSONRenderer, PassthroughRenderer]

    def get(self, request, *args, **kwargs):
        report_type = request.query_params.get("type", "enrollment-by-course")
        fmt = request.query_params.get("format", "json").lower()
        semester_id = request.query_params.get("semester")
        department_id = request.query_params.get("department")

        rows, headers = generate_report_data(
            report_type=report_type,
            semester_id=semester_id,
            department_id=department_id,
        )

        if fmt == "csv":
            return export_csv(rows, headers, filename=f"{report_type}.csv")

        return Response({
            "report_type": report_type,
            "count": len(rows),
            "results": rows,
        })
