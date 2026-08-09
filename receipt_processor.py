"""
Cross-platform Receipt OCR Processor
Supports: EasyOCR (primary) and Tesseract (fallback)
Compatible: macOS (Apple Silicon / Intel), Windows, Linux
"""

import os
import re
import platform
import logging
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image
from pdf2image import convert_from_path
import easyocr

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


class ReceiptProcessor:
    def __init__(self, engine: str = "easyocr", use_gpu: bool = True):
        self.engine = engine.lower()
        self.use_gpu = use_gpu
        self.os_type = platform.system()
        self.poppler_path = self._detect_poppler()
        self.IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}

        if self.engine == "easyocr":
            logging.info("Initialising EasyOCR reader (this may take a moment the first time)...")
            self.reader = easyocr.Reader(
                ["en"],
                gpu=self._should_use_gpu(),
                verbose=False,
            )
            logging.info("EasyOCR ready.")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _should_use_gpu(self) -> bool:
        if not self.use_gpu:
            return False
        if self.os_type == "Darwin":
            # Apple Silicon MPS; EasyOCR ≥1.6.2 supports it via PyTorch
            return True
        return True  # NVIDIA CUDA on Windows/Linux

    def _detect_poppler(self) -> Optional[str]:
        """Auto-detect Poppler path (required for pdf2image on macOS/Windows)."""
        if self.os_type == "Darwin":
            candidates = [
                "/opt/homebrew/bin",
                "/usr/local/bin",
            ]
        elif self.os_type == "Windows":
            candidates = [
                r"C:\poppler\bin",
                r"C:\Program Files\poppler\bin",
            ]
        else:
            return None  # Linux has it in PATH
        for p in candidates:
            if Path(p).exists():
                return p
        return None

    def _preprocess_image(self, img: np.ndarray) -> np.ndarray:
        """Denoise, deskew and binarise for better OCR accuracy."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        denoised = cv2.fastNlMeansDenoising(gray, h=10)
        _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return binary

    def _load_images(self, filepath: str) -> list[np.ndarray]:
        """Load a PDF or image file and return a list of OpenCV numpy arrays."""
        path = Path(filepath)
        suffix = path.suffix.lower()

        if suffix == ".pdf":
            kwargs = {"dpi": 300}
            if self.poppler_path:
                kwargs["poppler_path"] = self.poppler_path
            pil_images = convert_from_path(str(path), **kwargs)
            return [cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR) for img in pil_images]

        if suffix in self.IMAGE_EXTENSIONS:
            pil_img = Image.open(str(path)).convert("RGB")
            return [cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)]

        raise ValueError(f"Unsupported file type: {suffix}")

    # ------------------------------------------------------------------
    # OCR
    # ------------------------------------------------------------------

    def _run_easyocr(self, img: np.ndarray) -> str:
        processed = self._preprocess_image(img)
        results = self.reader.readtext(processed, detail=0, paragraph=True)
        return "\n".join(results)

    def _run_tesseract(self, img: np.ndarray) -> str:
        import pytesseract
        processed = self._preprocess_image(img)
        return pytesseract.image_to_string(processed, config="--oem 3 --psm 6")

    def _ocr_image(self, img: np.ndarray) -> str:
        if self.engine == "easyocr":
            return self._run_easyocr(img)
        return self._run_tesseract(img)

    # ------------------------------------------------------------------
    # Extraction helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_amount(text: str, *patterns: str) -> str:
        """Try multiple regex patterns and return the first match as X.XX."""
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                raw = m.group(1).replace(",", "")
                try:
                    return f"{float(raw):.2f}"
                except ValueError:
                    pass
        return "N/A"

    @staticmethod
    def _extract_date(text: str) -> str:
        patterns = [
            r"\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b",
            r"\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b",
            r"\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{2,4})\b",
        ]
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                return m.group(1)
        return "N/A"

    @staticmethod
    def _extract_merchant(lines: list[str]) -> str:
        """Heuristic: merchant is usually one of the first non-trivial lines."""
        skip = {"receipt", "invoice", "tax invoice", "bill", "store", "thank you", "welcome"}
        for line in lines[:6]:
            clean = line.strip()
            if len(clean) >= 3 and clean.lower() not in skip and not re.match(r"^[\d\s\W]+$", clean):
                return clean
        return "Unknown Merchant"

    @staticmethod
    def _extract_payment_method(text: str) -> str:
        patterns = {
            "Credit Card": r"\b(credit\s*card|visa|mastercard|amex|american\s*express)\b",
            "Debit Card":  r"\b(debit\s*card)\b",
            "UPI":         r"\b(upi|gpay|phonepe|paytm|bhim)\b",
            "Cash":        r"\b(cash|paid in cash)\b",
            "Net Banking": r"\b(net\s*banking|neft|rtgs|imps)\b",
        }
        for method, pat in patterns.items():
            if re.search(pat, text, re.IGNORECASE):
                return method
        return "N/A"

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process(self, filepath: str) -> dict:
        """
        Process a single receipt file (PDF or image).
        Returns a dict with keys: filename, engine, merchant, date,
        subtotal, tax, total_amount, payment_method, raw_text.
        """
        logging.info(f"Processing: {filepath}")
        images = self._load_images(filepath)

        all_text_parts = []
        for img in images:
            all_text_parts.append(self._ocr_image(img))
        raw_text = "\n".join(all_text_parts)

        lines = [l.strip() for l in raw_text.splitlines() if l.strip()]

        total = self._extract_amount(
            raw_text,
            r"(?:grand\s*total|total\s*amount|total\s*due|amount\s*due|total)[:\s₹$€£]*([0-9,]+\.?\d{0,2})",
            r"(?:total)[:\s₹$€£]*([0-9,]+\.?\d{0,2})",
        )
        subtotal = self._extract_amount(
            raw_text,
            r"(?:subtotal|sub\s*total)[:\s₹$€£]*([0-9,]+\.?\d{0,2})",
        )
        tax = self._extract_amount(
            raw_text,
            r"(?:tax|gst|vat|cgst|sgst|igst)[:\s₹$€£]*([0-9,]+\.?\d{0,2})",
        )

        return {
            "filename":       Path(filepath).name,
            "engine":         self.engine,
            "merchant":       self._extract_merchant(lines),
            "date":           self._extract_date(raw_text),
            "subtotal":       subtotal,
            "tax":            tax,
            "total_amount":   total,
            "payment_method": self._extract_payment_method(raw_text),
            "raw_text":       raw_text,
        }
