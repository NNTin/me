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
            # For HTML files, we need to handle Jekyll's baseurl properly
            # Jekyll might generate URLs like /me/assets/... but on filesystem they're at /workspaces/me/assets/...
            # We'll read the content and fix the paths before passing to WeasyPrint
            with open(source_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            # Find the workspace root 
            workspace_root = source_path
            while workspace_root.parent != workspace_root and workspace_root.name not in ['workspaces']:
                workspace_root = workspace_root.parent
            if workspace_root.name == 'workspaces' and len(workspace_root.parts) > 1:
                workspace_root = workspace_root / 'me'
            elif workspace_root.name != 'me':
                temp_path = source_path
                while temp_path.parent != temp_path and temp_path.name != 'me':
                    temp_path = temp_path.parent
                if temp_path.name == 'me':
                    workspace_root = temp_path
                else:
                    workspace_root = source_path.parent
            
            logger.info(f"Using workspace root as base_url: {workspace_root}")
            
            # Fix Jekyll paths by replacing /me/ with the actual workspace path
            # This handles both /me/assets/css/... and /me/assets/images/... patterns
            html_content = html_content.replace('"/me/', f'"file://{workspace_root}/')
            html_content = html_content.replace("'/me/", f"'file://{workspace_root}/")
            
            # Create HTML object from the modified content
            html_doc = HTML(string=html_content, base_url=str(workspace_root))
        else:
            # For other file types, try to read as HTML
            try:
                workspace_root = source_path.parent
                html_doc = HTML(filename=str(source_path), base_url=str(workspace_root))
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