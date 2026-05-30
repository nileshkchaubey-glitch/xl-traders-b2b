#!/usr/bin/env python3
"""
XL Traders B2B - Fast Product Import from Google Sheet to Supabase

This script:
1. Fetches products from Google Sheet CSV export
2. Downloads images from Google Drive
3. Uploads images to Supabase Storage
4. Inserts/updates products in Supabase database
5. Generates SEO-friendly alt text and descriptions

Usage:
    python3 scripts/import_products.py

Environment variables required:
    VITE_SUPABASE_URL
    VITE_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
import csv
import json
import uuid
import shutil
import requests
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from datetime import datetime
from urllib.parse import urljoin

# Try to import supabase, with helpful error message if missing
try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Supabase client not installed. Install with:")
    print("   pip install supabase")
    sys.exit(1)

# ============================================================================
# CONFIGURATION
# ============================================================================

SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1FEUf8vFpKmtK-hpnrc3DDoN93dBfOhI2Em8or-T7o6w/export?format=csv"
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY", "")
STORAGE_BUCKET = "product-images"
TEMP_DIR = Path(".import-temp")
BATCH_SIZE = 10  # Process images in batches

# ============================================================================
# LOGGING
# ============================================================================

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def log(message: str, level: str = "info"):
    """Print colored log messages"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    
    levels = {
        "info": (Colors.CYAN, "ℹ"),
        "success": (Colors.GREEN, "✓"),
        "error": (Colors.RED, "✗"),
        "warn": (Colors.YELLOW, "⚠"),
        "debug": (Colors.BLUE, "→"),
    }
    
    color, symbol = levels.get(level, (Colors.CYAN, "•"))
    print(f"{color}[{timestamp}] {symbol} {message}{Colors.RESET}")

# ============================================================================
# UTILITIES
# ============================================================================

def parse_price(price_str: str) -> float:
    """Parse price string, removing ₹ and commas"""
    if not price_str:
        return 0.0
    cleaned = price_str.replace("₹", "").replace(",", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

def generate_alt_text(product_name: str) -> str:
    """Generate SEO-friendly alt text for product images"""
    return f"{product_name} wholesale - XL Traders Surat"

def generate_description(product_name: str, category: str) -> str:
    """Generate SEO-friendly product description"""
    return f"High-quality {category.lower()} - {product_name}. Wholesale packaging solutions from XL Traders, Surat. Fast delivery."

def ensure_temp_dir():
    """Create temporary directory for downloads"""
    TEMP_DIR.mkdir(exist_ok=True)

def cleanup_temp_dir():
    """Remove temporary directory"""
    if TEMP_DIR.exists():
        shutil.rmtree(TEMP_DIR)

# ============================================================================
# FETCH DATA
# ============================================================================

def fetch_sheet_data() -> List[Dict]:
    """Fetch products from Google Sheet CSV export"""
    log("Fetching products from Google Sheet...", "info")
    
    try:
        response = requests.get(SHEET_CSV_URL, timeout=30)
        response.raise_for_status()
        
        # Parse CSV
        lines = response.text.strip().split('\n')
        reader = csv.DictReader(lines)
        products = list(reader)
        
        log(f"✓ Fetched {len(products)} products from sheet", "success")
        return products
        
    except Exception as e:
        log(f"Failed to fetch sheet: {e}", "error")
        raise

def download_image(download_url: str, file_name: str) -> Optional[Path]:
    """Download image from Google Drive"""
    try:
        file_path = TEMP_DIR / file_name
        
        response = requests.get(download_url, timeout=30, stream=True)
        response.raise_for_status()
        
        with open(file_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return file_path
        
    except Exception as e:
        log(f"Failed to download {file_name}: {e}", "warn")
        return None

# ============================================================================
# SUPABASE OPERATIONS
# ============================================================================

def init_supabase() -> Client:
    """Initialize Supabase client"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        log("Missing Supabase credentials in environment variables", "error")
        log("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", "error")
        sys.exit(1)
    
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def get_categories(supabase: Client) -> Dict[str, str]:
    """Fetch all categories and return name->id mapping"""
    log("Fetching categories from database...", "info")
    
    try:
        response = supabase.table("categories").select("id, name").execute()
        categories = response.data
        
        category_map = {cat["name"]: cat["id"] for cat in categories}
        log(f"✓ Found {len(categories)} categories", "success")
        
        return category_map
        
    except Exception as e:
        log(f"Failed to fetch categories: {e}", "error")
        raise

def upload_to_supabase(
    supabase: Client,
    file_path: Path,
    product_id: str,
    file_name: str
) -> Optional[str]:
    """Upload image to Supabase Storage and return public URL"""
    try:
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        storage_path = f"products/{product_id}/{file_name}"
        
        # Upload
        supabase.storage.from_(STORAGE_BUCKET).upload(
            storage_path,
            file_data,
            {"cacheControl": "3600", "upsert": True}
        )
        
        # Get public URL
        public_url = supabase.storage.from_(STORAGE_BUCKET).get_public_url(storage_path)
        return public_url.get("publicUrl") if isinstance(public_url, dict) else str(public_url)
        
    except Exception as e:
        log(f"Failed to upload {file_name}: {e}", "warn")
        return None

def product_exists(supabase: Client, product_name: str) -> Optional[str]:
    """Check if product exists and return its ID"""
    try:
        response = supabase.table("products").select("id").eq("name", product_name).execute()
        if response.data:
            return response.data[0]["id"]
        return None
    except Exception:
        return None

def upsert_product(supabase: Client, product: Dict) -> bool:
    """Insert or update product in database"""
    try:
        supabase.table("products").upsert(product).execute()
        return True
    except Exception as e:
        log(f"Failed to upsert product: {e}", "error")
        return False

# ============================================================================
# MAIN IMPORT LOGIC
# ============================================================================

def main():
    """Main import function"""
    log("=" * 70, "info")
    log("XL Traders B2B - Product Import", "info")
    log("=" * 70, "info")
    
    # Setup
    ensure_temp_dir()
    supabase = init_supabase()
    
    try:
        # Step 1: Fetch data
        sheet_products = fetch_sheet_data()
        if not sheet_products:
            log("No products found in sheet", "warn")
            return
        
        # Step 2: Get categories
        category_map = get_categories(supabase)
        
        # Step 3: Import products
        log(f"\nStarting import of {len(sheet_products)} products...\n", "info")
        
        imported = 0
        skipped = 0
        
        for idx, sheet_product in enumerate(sheet_products, 1):
            try:
                # Validate category
                category_name = sheet_product.get("category", "").strip()
                if not category_name or category_name not in category_map:
                    log(f"[{idx}/{len(sheet_products)}] Skipping - category not found: {category_name}", "warn")
                    skipped += 1
                    continue
                
                # Parse price
                price = parse_price(sheet_product.get("price", ""))
                if price == 0:
                    log(f"[{idx}/{len(sheet_products)}] Skipping - invalid price", "warn")
                    skipped += 1
                    continue
                
                product_name = sheet_product.get("item_name", "").strip()
                if not product_name:
                    log(f"[{idx}/{len(sheet_products)}] Skipping - no product name", "warn")
                    skipped += 1
                    continue
                
                # Check if exists
                existing_id = product_exists(supabase, product_name)
                product_id = existing_id or str(uuid.uuid4())
                
                # Download and upload image
                image_url = ""
                image_download_link = sheet_product.get("image_download_link", "").strip()
                image_file_name = sheet_product.get("image_file_name", "").strip()
                
                if image_download_link and image_file_name:
                    local_path = download_image(image_download_link, image_file_name)
                    if local_path:
                        image_url = upload_to_supabase(supabase, local_path, product_id, image_file_name) or ""
                
                # Prepare product
                product = {
                    "id": product_id,
                    "name": product_name,
                    "category_id": category_map[category_name],
                    "description": sheet_product.get("description", "") or generate_description(product_name, category_name),
                    "price": price,
                    "unit_of_measure": "pcs",
                    "image_url": image_url,
                    "image_alt_text": generate_alt_text(product_name),
                    "image_description": generate_description(product_name, category_name),
                    "is_active": True,
                }
                
                # Upsert
                if upsert_product(supabase, product):
                    imported += 1
                    status = "Updated" if existing_id else "Created"
                    log(f"[{idx}/{len(sheet_products)}] ✓ {status}: {product_name}", "success")
                else:
                    skipped += 1
                    log(f"[{idx}/{len(sheet_products)}] ✗ Failed: {product_name}", "error")
                    
            except Exception as e:
                log(f"[{idx}/{len(sheet_products)}] Error: {e}", "error")
                skipped += 1
        
        # Summary
        log("\n" + "=" * 70, "info")
        log("Import Complete!", "success")
        log(f"  Imported: {imported}", "success")
        log(f"  Skipped: {skipped}", "warn" if skipped > 0 else "success")
        log(f"  Total: {len(sheet_products)}", "info")
        log("=" * 70 + "\n", "info")
        
    except Exception as e:
        log(f"Fatal error: {e}", "error")
        sys.exit(1)
    finally:
        cleanup_temp_dir()

# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("\nImport cancelled by user", "warn")
        sys.exit(0)
    except Exception as e:
        log(f"Unhandled error: {e}", "error")
        sys.exit(1)
