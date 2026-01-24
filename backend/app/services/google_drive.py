"""
Service for storing reference images in Google Drive.
Creates a folder for each workflow/project and stores images there.
"""

import os
import base64
from typing import Optional
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from googleapiclient.errors import HttpError
import io
import json

# Google Drive API scopes
SCOPES = ['https://www.googleapis.com/auth/drive.file']  # Read/write access to files created by the app

# Folder name for storing all project folders
PROJECTS_FOLDER_NAME = "AI Music Video Generator Projects"


def _get_google_drive_service():
    """
    Initialize and return Google Drive service.
    
    Returns:
        Resource: Google Drive API service instance
        
    Raises:
        ValueError: If credentials are missing or invalid
    """
    creds = None
    token_file = os.getenv("GOOGLE_DRIVE_TOKEN_FILE", "token.json")
    credentials_file = os.getenv("GOOGLE_DRIVE_CREDENTIALS_FILE", "credentials.json")
    
    # Load existing token if available
    if os.path.exists(token_file):
        creds = Credentials.from_authorized_user_file(token_file, SCOPES)
    
    # If there are no (valid) credentials available, authenticate
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(credentials_file):
                raise ValueError(
                    f"Google Drive credentials file '{credentials_file}' not found. "
                    "Please download OAuth 2.0 credentials from Google Cloud Console."
                )
            flow = InstalledAppFlow.from_client_secrets_file(credentials_file, SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Save credentials for next run
        with open(token_file, 'w') as token:
            token.write(creds.to_json())
    
    return build('drive', 'v3', credentials=creds)


def _find_or_create_folder(service, folder_name: str, parent_folder_id: Optional[str] = None) -> str:
    """
    Find existing folder or create a new one.
    
    Args:
        service: Google Drive API service instance
        folder_name: Name of the folder to find or create
        parent_folder_id: Optional parent folder ID (for nested folders)
        
    Returns:
        str: Folder ID
    """
    query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    if parent_folder_id:
        query += f" and '{parent_folder_id}' in parents"
    else:
        query += " and 'root' in parents"
    
    try:
        results = service.files().list(q=query, fields="files(id, name)").execute()
        folders = results.get('files', [])
        
        if folders:
            return folders[0]['id']
        
        # Create folder if it doesn't exist
        folder_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        if parent_folder_id:
            folder_metadata['parents'] = [parent_folder_id]
        
        folder = service.files().create(body=folder_metadata, fields='id').execute()
        return folder.get('id')
    except HttpError as error:
        raise Exception(f"Error finding/creating folder: {error}")


def _get_projects_folder_id(service) -> str:
    """
    Get or create the main projects folder.
    
    Args:
        service: Google Drive API service instance
        
    Returns:
        str: Projects folder ID
    """
    return _find_or_create_folder(service, PROJECTS_FOLDER_NAME)


def _get_workflow_folder_id(service, workflow_id: str) -> str:
    """
    Get or create a folder for a specific workflow.
    
    Args:
        service: Google Drive API service instance
        workflow_id: Unique workflow identifier
        
    Returns:
        str: Workflow folder ID
    """
    projects_folder_id = _get_projects_folder_id(service)
    folder_name = f"Workflow_{workflow_id}"
    return _find_or_create_folder(service, folder_name, projects_folder_id)


async def upload_image_to_drive(
    image_data_base64: str,
    image_id: str,
    workflow_id: str,
    description: str
) -> str:
    """
    Upload an image to Google Drive in the workflow's folder.
    
    Args:
        image_data_base64: Base64 encoded image data (data URI format)
        image_id: Unique identifier for the image
        workflow_id: Workflow/project identifier
        description: Description of the image
        
    Returns:
        str: Public shareable URL of the uploaded image
        
    Raises:
        Exception: If upload fails
    """
    try:
        service = _get_google_drive_service()
        
        # Get or create workflow folder
        workflow_folder_id = _get_workflow_folder_id(service, workflow_id)
        
        # Convert base64 to bytes
        if image_data_base64.startswith("data:image"):
            # Remove data URI prefix
            base64_data = image_data_base64.split(",")[1]
        else:
            base64_data = image_data_base64
        
        image_bytes = base64.b64decode(base64_data)
        
        # Create file metadata
        filename = f"{image_id}.png"
        file_metadata = {
            'name': filename,
            'parents': [workflow_folder_id],
            'description': description
        }
        
        # Upload file
        media = MediaIoBaseUpload(
            io.BytesIO(image_bytes),
            mimetype='image/png',
            resumable=True
        )
        
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        
        file_id = file.get('id')
        
        # Make file publicly viewable
        permission = {
            'type': 'anyone',
            'role': 'reader'
        }
        service.permissions().create(
            fileId=file_id,
            body=permission
        ).execute()
        
        # Get shareable URL
        shareable_url = f"https://drive.google.com/uc?export=view&id={file_id}"
        
        return shareable_url
        
    except HttpError as error:
        raise Exception(f"Google Drive API error: {error}")
    except Exception as error:
        raise Exception(f"Error uploading image to Google Drive: {error}")


async def delete_image_from_drive(file_url: str) -> None:
    """
    Delete an image from Google Drive.
    
    Args:
        file_url: Google Drive file URL or file ID
        
    Raises:
        Exception: If deletion fails
    """
    try:
        service = _get_google_drive_service()
        
        # Extract file ID from URL
        if "id=" in file_url:
            file_id = file_url.split("id=")[1].split("&")[0]
        elif "/" in file_url:
            # Assume it's just the file ID
            file_id = file_url.split("/")[-1]
        else:
            file_id = file_url
        
        service.files().delete(fileId=file_id).execute()
        
    except HttpError as error:
        raise Exception(f"Google Drive API error: {error}")
    except Exception as error:
        raise Exception(f"Error deleting image from Google Drive: {error}")

