// Google Drive Integration for Team Playbook Export
// Supports per-user OAuth authentication for coaches

import { google } from 'googleapis';

const TOKEN_EXPIRY_BUFFER = 60000; // Refresh 1 minute before expiry

// Google Drive token structure stored in user record
export interface GoogleDriveTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  scope: string;
}

// Get OAuth2 client configured with app credentials
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }
  
  // Determine the redirect URI based on environment
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
  const redirectUri = domain 
    ? `https://${domain}/api/auth/google-drive/callback`
    : 'http://localhost:5000/api/auth/google-drive/callback';
  
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Generate authorization URL for user to connect Google Drive
export function getAuthorizationUrl(state: string): string {
  const oauth2Client = getOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Force consent to get refresh token
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/presentations'
    ],
    state
  });
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<GoogleDriveTokens> {
  const oauth2Client = getOAuth2Client();
  
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to obtain tokens from Google');
  }
  
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date || Date.now() + 3600000,
    scope: tokens.scope || ''
  };
}

// Refresh access token using refresh token
export async function refreshAccessToken(tokens: GoogleDriveTokens): Promise<GoogleDriveTokens> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: tokens.refresh_token
  });
  
  const { credentials } = await oauth2Client.refreshAccessToken();
  
  return {
    access_token: credentials.access_token!,
    refresh_token: tokens.refresh_token, // Keep original refresh token
    expiry_date: credentials.expiry_date || Date.now() + 3600000,
    scope: credentials.scope || tokens.scope
  };
}

// Get valid access token, refreshing if necessary
export async function getValidAccessToken(
  tokens: GoogleDriveTokens,
  updateTokensCallback?: (newTokens: GoogleDriveTokens) => Promise<void>
): Promise<string> {
  const now = Date.now();
  
  // Check if token needs refresh (with buffer)
  if (tokens.expiry_date > now + TOKEN_EXPIRY_BUFFER) {
    return tokens.access_token;
  }
  
  // Token expired or about to expire, refresh it
  const newTokens = await refreshAccessToken(tokens);
  
  // Update stored tokens if callback provided
  if (updateTokensCallback) {
    await updateTokensCallback(newTokens);
  }
  
  return newTokens.access_token;
}

// Get Google Drive client for a specific user
export async function getGoogleDriveClientForUser(
  tokens: GoogleDriveTokens,
  updateTokensCallback?: (newTokens: GoogleDriveTokens) => Promise<void>
) {
  const accessToken = await getValidAccessToken(tokens, updateTokensCallback);
  
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });
  
  return google.drive({ version: 'v3', auth: oauth2Client });
}

// Get Google Docs client for a specific user
export async function getGoogleDocsClientForUser(
  tokens: GoogleDriveTokens,
  updateTokensCallback?: (newTokens: GoogleDriveTokens) => Promise<void>
) {
  const accessToken = await getValidAccessToken(tokens, updateTokensCallback);
  
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });
  
  return google.docs({ version: 'v1', auth: oauth2Client });
}

// Get Google Slides client for a specific user
export async function getGoogleSlidesClientForUser(
  tokens: GoogleDriveTokens,
  updateTokensCallback?: (newTokens: GoogleDriveTokens) => Promise<void>
) {
  const accessToken = await getValidAccessToken(tokens, updateTokensCallback);
  
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
  tokens: GoogleDriveTokens,
  team: TeamInfo,
  plays: PlayInfo[],
  updateTokensCallback?: (newTokens: GoogleDriveTokens) => Promise<void>
): Promise<{ docUrl: string; docId: string }> {
  const drive = await getGoogleDriveClientForUser(tokens, updateTokensCallback);
  const docs = await getGoogleDocsClientForUser(tokens, updateTokensCallback);

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
  tokens: GoogleDriveTokens,
  team: TeamInfo,
  plays: PlayInfo[],
  updateTokensCallback?: (newTokens: GoogleDriveTokens) => Promise<void>
): Promise<{ slidesUrl: string; presentationId: string }> {
  const drive = await getGoogleDriveClientForUser(tokens, updateTokensCallback);
  const slides = await getGoogleSlidesClientForUser(tokens, updateTokensCallback);

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

// Main export function - now requires user tokens
export async function exportPlaybookToGoogleDrive(
  tokens: GoogleDriveTokens,
  team: TeamInfo,
  plays: PlayInfo[],
  options: { generateDoc: boolean; generateSlides: boolean },
  updateTokensCallback?: (newTokens: GoogleDriveTokens) => Promise<void>
): Promise<ExportResult> {
  const result: ExportResult = { errors: [] };

  try {
    if (options.generateDoc) {
      const docResult = await generateTeamDoc(tokens, team, plays, updateTokensCallback);
      result.docUrl = docResult.docUrl;
    }
  } catch (error: any) {
    console.error('Error generating Google Doc:', error);
    result.errors.push(`Failed to generate Google Doc: ${error.message}`);
  }

  try {
    if (options.generateSlides) {
      const slidesResult = await generateTeamSlides(tokens, team, plays, updateTokensCallback);
      result.slidesUrl = slidesResult.slidesUrl;
    }
  } catch (error: any) {
    console.error('Error generating Google Slides:', error);
    result.errors.push(`Failed to generate Google Slides: ${error.message}`);
  }

  return result;
}

// Check if user has Google Drive connected
export function isGoogleDriveConnected(tokens: GoogleDriveTokens | null | undefined): boolean {
  return !!(tokens && tokens.access_token && tokens.refresh_token);
}
