#!/usr/bin/env python3
"""
PDF Generator Module using WeasyPrint

This module converts HTML/Markdown files to PDF using WeasyPrint with custom CSS styling.
"""

import argparse
import sys
from pathlib import Path
import logging

try:
    from weasyprint import HTML, CSS
except ImportError:
    print("Error: WeasyPrint is not installed. Please install it with: pip install weasyprint")
    sys.exit(1)


def setup_logging():
    """Configure logging for the module."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)


def find_css_files(css_directory):
    """
    Find all CSS files in the specified directory.
    
    Args:
        css_directory (Path): Directory containing CSS files
        
    Returns:
        list: List of CSS file paths
    """
    css_dir = Path(css_directory)
    if not css_dir.exists():
        return []
    
    css_files = list(css_dir.glob("*.css"))
    return css_files


def convert_to_pdf(source_file, destination_file, css_directory, images_directory=None):
    """
    Convert a source file to PDF using WeasyPrint.
    
    Args:
        source_file (str): Path to the source file (HTML/Markdown)
        destination_file (str): Path to the output PDF file
        css_directory (str): Directory containing CSS files
        images_directory (str, optional): Directory containing images for the document
        
    Returns:
        bool: True if conversion successful, False otherwise
    """
    logger = logging.getLogger(__name__)
    
    try:
        # Convert paths to Path objects
        source_path = Path(source_file)
        dest_path = Path(destination_file)
        css_dir = Path(css_directory)
        images_dir = Path(images_directory) if images_directory else None
        
        # Validate source file exists
        if not source_path.exists():
            logger.error(f"Source file does not exist: {source_path}")
            return False
        
        # Validate images directory if provided
        if images_dir and not images_dir.exists():
            logger.warning(f"Images directory does not exist: {images_dir}")
            images_dir = None
        
        # Create destination directory if it doesn't exist
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Find CSS files
        css_files = find_css_files(css_dir)
        logger.info(f"Found {len(css_files)} CSS files in {css_dir}")
        
        # Create HTML object from source file
        if source_path.suffix.lower() in ['.html', '.htm']:
            # Set base_url to images directory if provided, otherwise use source file directory
            base_url = str(images_dir) if images_dir else str(source_path.parent)
            html_doc = HTML(filename=str(source_path), base_url=base_url)
        else:
            # For other file types, try to read as HTML
            # This could be extended to handle Markdown conversion
            try:
                base_url = str(images_dir) if images_dir else str(source_path.parent)
                html_doc = HTML(filename=str(source_path), base_url=base_url)
            except Exception as e:
                logger.error(f"Could not parse file as HTML: {e}")
                return False
        
        # Create CSS objects
        css_objects = []
        for css_file in css_files:
            try:
                css_obj = CSS(filename=str(css_file))
                css_objects.append(css_obj)
                logger.info(f"Loaded CSS: {css_file.name}")
            except Exception as e:
                logger.warning(f"Could not load CSS file {css_file}: {e}")
        
        # Log images directory info
        if images_dir:
            logger.info(f"Using images directory: {images_dir}")
        else:
            logger.info(f"Using source file directory for images: {source_path.parent}")
        
        # Generate PDF
        logger.info(f"Converting {source_path.name} to PDF...")
        html_doc.write_pdf(str(dest_path), stylesheets=css_objects)
        
        logger.info(f"Successfully created PDF: {dest_path}")
        return True
        
    except Exception as e:
        logger.error(f"Error converting {source_file} to PDF: {e}")
        return False


def main():
    """Main function for command-line usage."""
    parser = argparse.ArgumentParser(
        description="Convert HTML files to PDF using WeasyPrint"
    )
    parser.add_argument(
        "source_file",
        help="Path to the source file to convert"
    )
    parser.add_argument(
        "destination_file", 
        help="Path to the output PDF file"
    )
    parser.add_argument(
        "css_directory",
        help="Directory containing CSS files"
    )
    parser.add_argument(
        "images_directory",
        nargs="?",
        default=None,
        help="Directory containing images (optional)"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )
    
    args = parser.parse_args()
    
    # Setup logging
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    logger = setup_logging()
    
    # Convert file
    success = convert_to_pdf(
        args.source_file,
        args.destination_file,
        args.css_directory,
        args.images_directory
    )
    
    if success:
        logger.info("PDF conversion completed successfully")
        sys.exit(0)
    else:
        logger.error("PDF conversion failed")
        sys.exit(1)


if __name__ == "__main__":
    main()