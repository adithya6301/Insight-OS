"""
Flask OCR Backend for Insight-OS Smart Receipt & Invoice Parser
Run: python3 app.py
Serves on http://localhost:5000
"""

import os
import csv
import json
import logging
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

# ---- Import your receipt processor ----
from receipt_processor import ReceiptProcessor

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = Path("uploads")
CSV_OUTPUT = Path("receipts_output.csv")
UPLOAD_FOLDER.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png", "webp", "bmp", "tiff"}

processor = ReceiptProcessor(engine="easyocr", use_gpu=True)


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def write_to_csv(data: dict):
    """Append extracted receipt data to a cumulative CSV file."""
    fieldnames = ["Filename", "Engine", "Merchant", "Date", "Subtotal", "Tax", "Total_Amount", "Payment_Method"]
    file_exists = CSV_OUTPUT.exists()
    with open(CSV_OUTPUT, "a", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerow({k: data.get(k, "N/A") for k in fieldnames})


@app.route("/api/upload", methods=["POST"])
def upload_receipt():
    if "receipt" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400

    file = request.files["receipt"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"success": False, "error": "Unsupported file type"}), 400

    filename = secure_filename(file.filename)
    filepath = UPLOAD_FOLDER / filename
    file.save(str(filepath))

    try:
        result = processor.process(str(filepath))
        raw_text = result.get("raw_text", "")
        extracted = {
            "Filename": result.get("filename", filename),
            "Engine":   result.get("engine", "easyocr"),
            "Merchant": result.get("merchant", "Unknown Merchant"),
            "Date":     result.get("date", "N/A"),
            "Subtotal": result.get("subtotal", "N/A"),
            "Tax":      result.get("tax", "N/A"),
            "Total_Amount": result.get("total_amount", "N/A"),
            "Payment_Method": result.get("payment_method", "N/A"),
        }
        write_to_csv(extracted)
        return jsonify({"success": True, "data": extracted, "raw_text": raw_text})
    except Exception as e:
        logging.error(f"OCR processing failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/download-csv", methods=["GET"])
def download_csv():
    if not CSV_OUTPUT.exists():
        return jsonify({"error": "No receipts have been processed yet"}), 404
    return send_file(
        str(CSV_OUTPUT.resolve()),
        as_attachment=True,
        download_name="receipts_output.csv",
        mimetype="text/csv"
    )


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "engine": "easyocr"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
