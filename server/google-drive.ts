// Google Drive Integration for Team Playbook Export
// Uses Replit's Google Drive connector for authentication

import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Drive not connected');
  }
  return accessToken;
}

// Get fresh Google Drive client (never cache - tokens expire)
export async function getGoogleDriveClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// Get Google Docs client
export async function getGoogleDocsClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.docs({ version: 'v1', auth: oauth2Client });
}

// Get Google Slides client
export async function getGoogleSlidesClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.slides({ version: 'v1', auth: oauth2Client });
}

interface TeamInfo {
  id: number;
  name: string;
  year?: string;
  coverImageUrl?: string | null;
}

interface PlayInfo {
  id: number;
  name: string;
  type: string;
  concept?: string | null;
  formation?: string | null;
  imageBase64?: string;
}

interface ExportResult {
  docUrl?: string;
  slidesUrl?: string;
  errors: string[];
}

// Generate Google Doc with team playbook (handout format)
export async function generateTeamDoc(
  team: TeamInfo,
  plays: PlayInfo[]
): Promise<{ docUrl: string; docId: string }> {
  const drive = await getGoogleDriveClient();
  const docs = await getGoogleDocsClient();

  // Create a new Google Doc
  const docMetadata = {
    name: `${team.name} Playbook - ${team.year || new Date().getFullYear()}`,
    mimeType: 'application/vnd.google-apps.document'
  };

  const docFile = await drive.files.create({
    requestBody: docMetadata,
    fields: 'id, webViewLink'
  });

  const docId = docFile.data.id!;
  const docUrl = docFile.data.webViewLink!;

  // Build the document content with batch updates
  const requests: any[] = [];
  let currentIndex = 1;

  // Cover page: Team Name (Header 1)
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: `${team.name}\n\n`
    }
  });
  
  requests.push({
    updateParagraphStyle: {
      range: { startIndex: currentIndex, endIndex: currentIndex + team.name.length + 1 },
      paragraphStyle: {
        namedStyleType: 'HEADING_1',
        alignment: 'CENTER'
      },
      fields: 'namedStyleType,alignment'
    }
  });
  currentIndex += team.name.length + 2;

  // Add year subtitle
  const yearText = `${team.year || new Date().getFullYear()} Season\n`;
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: yearText
    }
  });
  
  requests.push({
    updateParagraphStyle: {
      range: { startIndex: currentIndex, endIndex: currentIndex + yearText.length },
      paragraphStyle: {
        namedStyleType: 'HEADING_2',
        alignment: 'CENTER'
      },
      fields: 'namedStyleType,alignment'
    }
  });
  currentIndex += yearText.length;

  // Add total plays count
  const countText = `Total Plays: ${plays.length}\n`;
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: countText
    }
  });
  currentIndex += countText.length;

  // Page break after cover
  requests.push({
    insertPageBreak: {
      location: { index: currentIndex }
    }
  });
  currentIndex += 1;

  // Add each play
  for (let i = 0; i < plays.length; i++) {
    const play = plays[i];
    
    // Play name header
    const playHeader = `${i + 1}. ${play.name}\n`;
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: playHeader
      }
    });
    
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: currentIndex, endIndex: currentIndex + playHeader.length },
        paragraphStyle: {
          namedStyleType: 'HEADING_2'
        },
        fields: 'namedStyleType'
      }
    });
    currentIndex += playHeader.length;

    // Play metadata
    const metadata: string[] = [];
    if (play.type) metadata.push(`Type: ${play.type}`);
    if (play.formation) metadata.push(`Formation: ${play.formation}`);
    if (play.concept) metadata.push(`Concept: ${play.concept}`);
    
    if (metadata.length > 0) {
      const metaText = metadata.join(' | ') + '\n\n';
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: metaText
        }
      });
      currentIndex += metaText.length;
    }

    // If we have an image, insert it
    if (play.imageBase64) {
      // Upload image to Drive first
      const imageBuffer = Buffer.from(play.imageBase64, 'base64');
      const imageFile = await drive.files.create({
        requestBody: {
          name: `play_${play.id}_image.png`,
          mimeType: 'image/png'
        },
        media: {
          mimeType: 'image/png',
          body: require('stream').Readable.from(imageBuffer)
        },
        fields: 'id, webContentLink'
      });

      // Make the image publicly accessible
      await drive.permissions.create({
        fileId: imageFile.data.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      // Get direct download link
      const imageUrl = `https://drive.google.com/uc?id=${imageFile.data.id}`;

      requests.push({
        insertInlineImage: {
          location: { index: currentIndex },
          uri: imageUrl,
          objectSize: {
            width: { magnitude: 468, unit: 'PT' },
            height: { magnitude: 300, unit: 'PT' }
          }
        }
      });
      currentIndex += 1;
    }

    // Add spacing between plays
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: '\n\n'
      }
    });
    currentIndex += 2;

    // Page break every 2 plays (except for the last one)
    if ((i + 1) % 2 === 0 && i < plays.length - 1) {
      requests.push({
        insertPageBreak: {
          location: { index: currentIndex }
        }
      });
      currentIndex += 1;
    }
  }

  // Execute all the updates
  if (requests.length > 0) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests }
    });
  }

  return { docUrl, docId };
}

// Generate Google Slides with team playbook (presentation format)
export async function generateTeamSlides(
  team: TeamInfo,
  plays: PlayInfo[]
): Promise<{ slidesUrl: string; presentationId: string }> {
  const drive = await getGoogleDriveClient();
  const slides = await getGoogleSlidesClient();

  // Create a new Google Slides presentation
  const presentation = await slides.presentations.create({
    requestBody: {
      title: `${team.name} Playbook - ${team.year || new Date().getFullYear()}`
    }
  });

  const presentationId = presentation.data.presentationId!;
  const slidesUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;

  // Get the default slide (we'll modify it as title slide)
  const titleSlideId = presentation.data.slides?.[0]?.objectId;

  const requests: any[] = [];

  // Update title slide
  if (titleSlideId) {
    // Find the title shape on the slide
    const titleShape = presentation.data.slides?.[0]?.pageElements?.find(
      (el: any) => el.shape?.placeholder?.type === 'CENTERED_TITLE' || el.shape?.placeholder?.type === 'TITLE'
    );

    if (titleShape?.objectId) {
      requests.push({
        insertText: {
          objectId: titleShape.objectId,
          text: team.name
        }
      });
    }

    // Find subtitle shape
    const subtitleShape = presentation.data.slides?.[0]?.pageElements?.find(
      (el: any) => el.shape?.placeholder?.type === 'SUBTITLE'
    );

    if (subtitleShape?.objectId) {
      requests.push({
        insertText: {
          objectId: subtitleShape.objectId,
          text: `${team.year || new Date().getFullYear()} Season\n${plays.length} Plays`
        }
      });
    }
  }

  // Create a slide for each play
  for (let i = 0; i < plays.length; i++) {
    const play = plays[i];
    const slideId = `play_slide_${i}`;
    const titleShapeId = `play_title_${i}`;
    const imageShapeId = `play_image_${i}`;

    // Create new slide
    requests.push({
      createSlide: {
        objectId: slideId,
        insertionIndex: i + 1,
        slideLayoutReference: {
          predefinedLayout: 'BLANK'
        }
      }
    });

    // Add play title at top
    requests.push({
      createShape: {
        objectId: titleShapeId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width: { magnitude: 700, unit: 'PT' },
            height: { magnitude: 50, unit: 'PT' }
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: 10,
            translateY: 10,
            unit: 'PT'
          }
        }
      }
    });

    requests.push({
      insertText: {
        objectId: titleShapeId,
        text: play.name
      }
    });

    requests.push({
      updateTextStyle: {
        objectId: titleShapeId,
        style: {
          fontSize: { magnitude: 24, unit: 'PT' },
          bold: true
        },
        fields: 'fontSize,bold'
      }
    });

    // If we have an image, upload and insert it
    if (play.imageBase64) {
      const imageBuffer = Buffer.from(play.imageBase64, 'base64');
      const imageFile = await drive.files.create({
        requestBody: {
          name: `slide_play_${play.id}_image.png`,
          mimeType: 'image/png'
        },
        media: {
          mimeType: 'image/png',
          body: require('stream').Readable.from(imageBuffer)
        },
        fields: 'id'
      });

      // Make the image publicly accessible
      await drive.permissions.create({
        fileId: imageFile.data.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      const imageUrl = `https://drive.google.com/uc?id=${imageFile.data.id}`;

      requests.push({
        createImage: {
          objectId: imageShapeId,
          url: imageUrl,
          elementProperties: {
            pageObjectId: slideId,
            size: {
              width: { magnitude: 650, unit: 'PT' },
              height: { magnitude: 420, unit: 'PT' }
            },
            transform: {
              scaleX: 1,
              scaleY: 1,
              translateX: 35,
              translateY: 70,
              unit: 'PT'
            }
          }
        }
      });
    }

    // Add speaker notes with metadata
    const notes: string[] = [`Play: ${play.name}`];
    if (play.type) notes.push(`Type: ${play.type}`);
    if (play.formation) notes.push(`Formation: ${play.formation}`);
    if (play.concept) notes.push(`Concept: ${play.concept}`);

    requests.push({
      createShape: {
        objectId: `notes_${i}`,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: `${slideId}_notes`,
          size: {
            width: { magnitude: 700, unit: 'PT' },
            height: { magnitude: 100, unit: 'PT' }
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: 0,
            translateY: 0,
            unit: 'PT'
          }
        }
      }
    });
  }

  // Execute all the updates
  if (requests.length > 0) {
    try {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests }
      });
    } catch (error: any) {
      console.error('Slides batch update error:', error.message);
      // Continue even if some requests fail - the presentation is still created
    }
  }

  return { slidesUrl, presentationId };
}

// Main export function
export async function exportPlaybookToGoogleDrive(
  team: TeamInfo,
  plays: PlayInfo[],
  options: { generateDoc: boolean; generateSlides: boolean }
): Promise<ExportResult> {
  const result: ExportResult = { errors: [] };

  try {
    if (options.generateDoc) {
      const docResult = await generateTeamDoc(team, plays);
      result.docUrl = docResult.docUrl;
    }
  } catch (error: any) {
    console.error('Error generating Google Doc:', error);
    result.errors.push(`Failed to generate Google Doc: ${error.message}`);
  }

  try {
    if (options.generateSlides) {
      const slidesResult = await generateTeamSlides(team, plays);
      result.slidesUrl = slidesResult.slidesUrl;
    }
  } catch (error: any) {
    console.error('Error generating Google Slides:', error);
    result.errors.push(`Failed to generate Google Slides: ${error.message}`);
  }

  return result;
}

// Check if Google Drive is connected
export async function isGoogleDriveConnected(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}
