import boto3
import os
import re
from dotenv import load_dotenv
from botocore.exceptions import ClientError

load_dotenv()

translate = boto3.client(
    "translate",
    region_name=os.getenv("AWS_REGION"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
)


def _contains_devanagari(text: str) -> bool:
    return bool(re.search(r"[\u0900-\u097F]", text))


def translate_text(text, target_lang="hi"):
    if not text:
        return text

    # If text appears to already be in Devanagari, prefer that as source
    source_hint = None
    if _contains_devanagari(text):
        # treat as Hindi/related Devanagari language
        source_hint = "hi"

    try:
        kwargs = {"Text": text, "TargetLanguageCode": target_lang}
        # prefer explicit source when we have a hint, otherwise let AWS detect
        if source_hint:
            kwargs["SourceLanguageCode"] = source_hint
        else:
            kwargs["SourceLanguageCode"] = "auto"

        response = translate.translate_text(**kwargs)
        return response["TranslatedText"]
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        # retry with a safe fallback (assume English source) when AWS reports unsupported pair
        if code == "UnsupportedLanguagePairException":
            try:
                response = translate.translate_text(Text=text, SourceLanguageCode="en", TargetLanguageCode=target_lang)
                return response["TranslatedText"]
            except Exception:
                return text
        return text
    except Exception:
        return text
