import re
import uuid

import boto3

from .config import get_settings

settings = get_settings()


def s3_client():
    kwargs = {"region_name": settings.aws_region}
    if settings.aws_access_key_id and settings.aws_secret_access_key:
        kwargs.update(aws_access_key_id=settings.aws_access_key_id, aws_secret_access_key=settings.aws_secret_access_key)
    return boto3.client("s3", **kwargs)


def _safe_filename(filename: str) -> str:
    """Strip any path components and anything but a conservative charset, so a
    crafted filename can't be used to traverse or inject into the S3 key."""
    name = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name).strip("._")
    return (name or "file")[:150]


def upload_bytes(user_id: str, filename: str, content: bytes, content_type: str | None):
    key = f"users/{user_id}/documents/{uuid.uuid4()}-{_safe_filename(filename)}"
    s3_client().put_object(Bucket=settings.s3_bucket, Key=key, Body=content, ContentType=content_type or "application/octet-stream", ServerSideEncryption="AES256")
    return key
