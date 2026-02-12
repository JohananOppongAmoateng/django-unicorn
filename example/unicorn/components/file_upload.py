from typing import Optional

from django.core.files.uploadedfile import UploadedFile
from django_unicorn.components import UnicornView


class FileUploadView(UnicornView):
    """Example component demonstrating file upload functionality."""

    uploaded_file: Optional[UploadedFile] = None
    file_name: str = ""
    file_size: int = 0
    file_type: str = ""
    upload_message: str = ""

    def process_file(self):
        """Process the uploaded file and extract metadata."""
        if self.uploaded_file:
            self.file_name = self.uploaded_file.name
            self.file_size = self.uploaded_file.size
            self.file_type = self.uploaded_file.content_type or "unknown"
            self.upload_message = f"Successfully processed {self.file_name}"
        else:
            self.upload_message = "No file uploaded"

    def clear_file(self):
        """Clear the uploaded file."""
        self.uploaded_file = None
        self.file_name = ""
        self.file_size = 0
        self.file_type = ""
        self.upload_message = "File cleared"
