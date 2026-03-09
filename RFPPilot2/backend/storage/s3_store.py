import contextlib
import os
import re
import tempfile
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from typing import Dict, Iterable, Iterator, Optional, Tuple

try:
    import boto3
    from botocore.config import Config
    from botocore.exceptions import BotoCoreError, ClientError
except Exception as e:  # pragma: no cover
    boto3 = None
    Config = None
    BotoCoreError = Exception
    ClientError = Exception
    _BOTO_IMPORT_ERROR = e
else:
    _BOTO_IMPORT_ERROR = None


_S3_URI_RE = re.compile(r"^s3://(?P<bucket>[^/]+)/(?P<key>.+)$")

_s3_client = None
_upload_executor: Optional[ThreadPoolExecutor] = None


def is_s3_uri(value: object) -> bool:
    return isinstance(value, str) and value.startswith("s3://")


def parse_s3_uri(s3_uri: str) -> Tuple[str, str]:
    """Parse s3://bucket/key into (bucket, key)."""
    m = _S3_URI_RE.match(str(s3_uri or ""))
    if not m:
        raise ValueError(f"Invalid S3 URI: {s3_uri}")
    return m.group("bucket"), m.group("key")


def _require_boto3() -> None:
    if boto3 is None:
        raise RuntimeError(
            "boto3 is required for S3 storage but is not installed. "
            "Install it via requirements.txt. "
            f"Import error: {_BOTO_IMPORT_ERROR}"
        )


def get_s3_client():
    """Create a boto3 S3 client with standard retries."""
    global _s3_client
    _require_boto3()

    if _s3_client is None:
        region = os.getenv("AWS_REGION") or None
        retries = {"max_attempts": 10, "mode": "standard"}
        cfg = Config(retries=retries)
        _s3_client = boto3.client("s3", region_name=region, config=cfg)
    return _s3_client


def get_s3_bucket_name() -> str:
    bucket = (os.getenv("S3_BUCKET_NAME") or "").strip()
    if not bucket:
        raise RuntimeError(
            "S3_BUCKET_NAME is required for PDF secure storage (Sales Agent)."
        )
    return bucket


def get_s3_prefix() -> str:
    prefix = (os.getenv("S3_PREFIX") or "rfp-docs").strip().strip("/")
    return prefix or "rfp-docs"


def get_s3_upload_workers() -> int:
    raw = (os.getenv("S3_UPLOAD_WORKERS") or "4").strip()
    try:
        workers = int(raw)
    except ValueError:
        workers = 4
    return max(1, min(workers, 32))


def get_presign_expires_seconds() -> int:
    raw = (os.getenv("S3_PRESIGN_EXPIRES_SECONDS") or "300").strip()
    try:
        seconds = int(raw)
    except ValueError:
        seconds = 300
    return max(1, min(seconds, 3600))


def build_s3_upload_extra_args() -> Dict[str, str]:
    """Server-side encryption config.

    Env:
      - S3_SSE_MODE: SSE-S3 (default) or SSE-KMS
      - S3_KMS_KEY_ID: required for SSE-KMS
    """
    mode = (os.getenv("S3_SSE_MODE") or "SSE-S3").strip().upper()

    if mode in {"SSE-S3", "SSE_S3", "AES256", "SSES3"}:
        return {"ServerSideEncryption": "AES256"}

    if mode in {"SSE-KMS", "SSE_KMS", "KMS", "SSEKMS"}:
        kms_key_id = (os.getenv("S3_KMS_KEY_ID") or "").strip()
        if not kms_key_id:
            raise RuntimeError("S3_KMS_KEY_ID is required when S3_SSE_MODE=SSE-KMS")
        return {"ServerSideEncryption": "aws:kms", "SSEKMSKeyId": kms_key_id}

    raise RuntimeError(f"Unsupported S3_SSE_MODE: {mode} (use SSE-S3 or SSE-KMS)")


def get_upload_executor() -> ThreadPoolExecutor:
    global _upload_executor
    if _upload_executor is None:
        _upload_executor = ThreadPoolExecutor(
            max_workers=get_s3_upload_workers(), thread_name_prefix="s3-upload"
        )
    return _upload_executor


def upload_file(local_path: str, bucket: str, key: str, extra_args: Optional[Dict[str, str]] = None) -> str:
    """Upload a local file to S3. Returns S3 URI."""
    client = get_s3_client()
    args = extra_args or {}
    client.upload_file(local_path, bucket, key, ExtraArgs=args)
    return f"s3://{bucket}/{key}"


def upload_file_async(
    local_path: str,
    bucket: str,
    key: str,
    extra_args: Optional[Dict[str, str]] = None,
    executor: Optional[ThreadPoolExecutor] = None,
) -> Future:
    """Upload in background. Future result is S3 URI."""
    ex = executor or get_upload_executor()
    return ex.submit(upload_file, local_path, bucket, key, extra_args)


def wait_for_uploads(futures: Iterable[Future]) -> None:
    """Wait for all futures. Raises RuntimeError on any failure."""
    failures = []
    for fut in as_completed(list(futures)):
        try:
            _ = fut.result()
        except Exception as e:
            failures.append(e)

    if failures:
        msg = " | ".join(str(e) for e in failures[:3])
        raise RuntimeError(f"One or more S3 uploads failed: {msg}")


def delete_local_file_best_effort(path: str) -> None:
    if not path:
        return
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


@contextlib.contextmanager
def download_s3_to_temp(s3_uri: str, suffix: str = ".pdf") -> Iterator[str]:
    """Download S3 object to a temp file and clean it up afterwards."""
    bucket, key = parse_s3_uri(s3_uri)
    client = get_s3_client()

    fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="rfp_", text=False)
    os.close(fd)

    try:
        client.download_file(bucket, key, tmp_path)
        yield tmp_path
    finally:
        delete_local_file_best_effort(tmp_path)


@contextlib.contextmanager
def materialize_pdf_path(pdf_path: str) -> Iterator[str]:
    """Yield a local filesystem path for a PDF path/URI."""
    if is_s3_uri(pdf_path):
        with download_s3_to_temp(pdf_path, suffix=".pdf") as tmp:
            yield tmp
    else:
        yield pdf_path


def presign_get_url(s3_uri: str, expires_seconds: Optional[int] = None) -> str:
    """Generate a short-lived presigned GET URL for an S3 URI."""
    bucket, key = parse_s3_uri(s3_uri)
    client = get_s3_client()
    expires = expires_seconds if expires_seconds is not None else get_presign_expires_seconds()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires,
    )


def s3_head_exists(s3_uri: str) -> bool:
    """Best-effort existence check for S3 URI."""
    try:
        bucket, key = parse_s3_uri(s3_uri)
        client = get_s3_client()
        client.head_object(Bucket=bucket, Key=key)
        return True
    except (ClientError, BotoCoreError, ValueError):
        return False
