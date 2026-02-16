// Google Drive Integration for Team Playbook Export
// Supports per-user OAuth authentication for coaches

import { google } from 'googleapis';
import { Readable } from 'node:stream';

const TOKEN_EXPIRY_BUFFER = 60000; // Refresh 1 minute before expiry

// Google Drive token structure stored in user record
export interface GoogleDriveTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  scope: string;
}

// Get the resolved redirect URI for OAuth - exported so diagnostic endpoints can use it
export function getResolvedRedirectUri(): { redirectUri: string; domain: string | undefined; allDomains: string | undefined; isProduction: boolean } {
  let domain: string | undefined;
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1' || !process.env.REPLIT_DEV_DOMAIN;
  const allDomains = process.env.REPLIT_DOMAINS;
  
  if (isProduction) {
    const domains = allDomains?.split(',') || [];
    // Prefer .replit.app domain for consistency with Google Cloud Console registration
    // Custom domains may not be registered as redirect URIs
    domain = domains.find(d => d.endsWith('.replit.app')) || domains[0];
  } else {
    domain = process.env.REPLIT_DEV_DOMAIN;
  }
  
  const redirectUri = domain 
    ? `https://${domain}/api/auth/google-drive/callback`
    : 'http://localhost:5000/api/auth/google-drive/callback';
  
  return { redirectUri, domain, allDomains, isProduction };
}

// Get OAuth2 client configured with app credentials
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }
  
  const { redirectUri, domain, allDomains, isProduction } = getResolvedRedirectUri();
  
  console.log('Google Drive OAuth redirect URI:', redirectUri, '| production:', isProduction, '| domain:', domain, '| all domains:', allDomains);
  
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
  itemType?: 'play' | 'blankPage';  // New field to distinguish item types
  id: number;
  name: string;
  type?: string;  // Made optional for blank pages
  concept?: string | null;
  formation?: string | null;
  notes?: string | null;  // For blank pages
  imageBase64?: string;
  imageWidth?: number;
  imageHeight?: number;
  // For roster/splits pages
  pageType?: 'blank' | 'roster' | 'splits';
  fullPage?: boolean;  // If true, render as full-page image instead of section divider
}

interface ExportResult {
  docUrl?: string;
  slidesUrl?: string;
  errors: string[];
}

// Generate Google Doc with team playbook (handout format)
// playsPerPage: 1, 2, 4, or 8 plays per page layout
export async function generateTeamDoc(
  tokens: GoogleDriveTokens,
  team: TeamInfo,
  plays: PlayInfo[],
  updateTokensCallback?: (newTokens: GoogleDriveTokens) => Promise<void>,
  documentTitle?: string,
  playsPerPage: number = 2
): Promise<{ docUrl: string; docId: string }> {
  const drive = await getGoogleDriveClientForUser(tokens, updateTokensCallback);
  const docs = await getGoogleDocsClientForUser(tokens, updateTokensCallback);

  // Use custom document title or default
  const docTitle = documentTitle || `${team.name} Playbook - ${team.year || new Date().getFullYear()}`;
  
  // Create a new Google Doc
  const docMetadata = {
    name: docTitle,
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

  // Cover page: Team Name (32pt, centered, bold)
  // Add spacing before to vertically center the cover page content
  // US Letter: 792 PT height, 1" margins (72 PT each) = 648 PT usable
  // Content: ~48 PT (title) + 409 PT (image) + 48 PT (season) + 24 PT (count) + 24 PT (gaps) ≈ 553 PT
  // Space before: (648 - 553) / 2 ≈ 48 PT for vertical centering
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: `${team.name}\n`
    }
  });
  
  const teamNameEnd = currentIndex + team.name.length;
  
  // Set paragraph alignment to center and add spaceBefore for vertical centering
  requests.push({
    updateParagraphStyle: {
      range: { startIndex: currentIndex, endIndex: teamNameEnd + 1 },
      paragraphStyle: {
        alignment: 'CENTER',
        spaceAbove: { magnitude: 72, unit: 'PT' }
      },
      fields: 'alignment,spaceAbove'
    }
  });
  
  // Set explicit font size to 32pt and bold
  requests.push({
    updateTextStyle: {
      range: { startIndex: currentIndex, endIndex: teamNameEnd },
      textStyle: {
        fontSize: { magnitude: 32, unit: 'PT' },
        bold: true
      },
      fields: 'fontSize,bold'
    }
  });
  currentIndex += team.name.length + 1;

  // Add team cover image if available
  if (team.coverImageUrl) {
    try {
      // Add newline before image for spacing
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: '\n'
        }
      });
      currentIndex += 1;
      
      // Handle cover image - if it's a data URI, upload to Drive first
      let coverImageUrl = team.coverImageUrl;
      
      if (team.coverImageUrl.startsWith('data:')) {
        // Extract base64 data from data URI (format: data:image/png;base64,XXXX)
        const matches = team.coverImageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const imageType = matches[1]; // png, jpeg, etc.
          const base64Data = matches[2];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          // Upload cover image to Drive
          const coverImageFile = await drive.files.create({
            requestBody: {
              name: `${team.name}_cover.${imageType}`,
              mimeType: `image/${imageType}`
            },
            media: {
              mimeType: `image/${imageType}`,
              body: Readable.from(imageBuffer)
            },
            fields: 'id'
          });
          
          // Make the image publicly accessible
          await drive.permissions.create({
            fileId: coverImageFile.data.id!,
            requestBody: {
              role: 'reader',
              type: 'anyone'
            }
          });
          
          // Use the Drive URL instead of data URI
          coverImageUrl = `https://drive.google.com/uc?id=${coverImageFile.data.id}`;
        }
      }
      
      // Insert the cover image (centered, 628x545 px = 471x409 PT)
      requests.push({
        insertInlineImage: {
          location: { index: currentIndex },
          uri: coverImageUrl,
          objectSize: {
            width: { magnitude: 471, unit: 'PT' },
            height: { magnitude: 409, unit: 'PT' }
          }
        }
      });
      currentIndex += 1;
      
      // Center the image paragraph
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: currentIndex - 1, endIndex: currentIndex },
          paragraphStyle: {
            alignment: 'CENTER'
          },
          fields: 'alignment'
        }
      });
      
      // Add newline after image
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: '\n'
        }
      });
      currentIndex += 1;
    } catch (error) {
      console.error('Failed to insert cover image:', error);
      // Continue without cover image - add spacing instead
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: '\n'
        }
      });
      currentIndex += 1;
    }
  } else {
    // Add spacing if no cover image
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: '\n'
      }
    });
    currentIndex += 1;
  }

  // Add year subtitle (32pt, centered, bold)
  const yearText = `${team.year || new Date().getFullYear()} Season\n`;
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: yearText
    }
  });
  
  const yearTextEnd = currentIndex + yearText.length - 1; // Exclude newline from text styling
  
  // Set paragraph alignment to center
  requests.push({
    updateParagraphStyle: {
      range: { startIndex: currentIndex, endIndex: currentIndex + yearText.length },
      paragraphStyle: {
        alignment: 'CENTER'
      },
      fields: 'alignment'
    }
  });
  
  // Set explicit font size to 32pt and bold
  requests.push({
    updateTextStyle: {
      range: { startIndex: currentIndex, endIndex: yearTextEnd },
      textStyle: {
        fontSize: { magnitude: 32, unit: 'PT' },
        bold: true
      },
      fields: 'fontSize,bold'
    }
  });
  currentIndex += yearText.length;

  // Add total plays count (18pt, centered)
  const playCount = plays.filter(p => p.itemType !== 'blankPage').length;
  const countText = `Total Plays: ${playCount}\n`;
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: countText
    }
  });
  
  const countTextEnd = currentIndex + countText.length - 1; // Exclude newline from text styling
  
  // Set paragraph alignment to center
  requests.push({
    updateParagraphStyle: {
      range: { startIndex: currentIndex, endIndex: currentIndex + countText.length },
      paragraphStyle: {
        alignment: 'CENTER'
      },
      fields: 'alignment'
    }
  });
  
  // Set explicit font size to 18pt
  requests.push({
    updateTextStyle: {
      range: { startIndex: currentIndex, endIndex: countTextEnd },
      textStyle: {
        fontSize: { magnitude: 18, unit: 'PT' }
      },
      fields: 'fontSize'
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

  // Upload all play images to Drive first (batch upload for efficiency)
  // Also upload fullPage blank page images (roster/splits pages)
  const uploadedImages: { playId: number; imageUrl: string }[] = [];
  const uploadedBlankPageImages: { pageId: number; imageUrl: string }[] = [];
  
  for (const play of plays) {
    if (play.itemType === 'blankPage') {
      // Handle fullPage blank pages (roster/splits) with images
      if (play.fullPage && play.imageBase64) {
        const imageBuffer = Buffer.from(play.imageBase64, 'base64');
        const imageFile = await drive.files.create({
          requestBody: {
            name: `page_${play.id}_${play.pageType || 'page'}_image.png`,
            mimeType: 'image/png'
          },
          media: {
            mimeType: 'image/png',
            body: Readable.from(imageBuffer)
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

        uploadedBlankPageImages.push({
          pageId: play.id,
          imageUrl: `https://drive.google.com/uc?id=${imageFile.data.id}`
        });
      }
      continue;
    }
    
    // Regular play images
    if (play.imageBase64) {
      const imageBuffer = Buffer.from(play.imageBase64, 'base64');
      const imageFile = await drive.files.create({
        requestBody: {
          name: `play_${play.id}_image.png`,
          mimeType: 'image/png'
        },
        media: {
          mimeType: 'image/png',
          body: Readable.from(imageBuffer)
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

      uploadedImages.push({
        playId: play.id,
        imageUrl: `https://drive.google.com/uc?id=${imageFile.data.id}`
      });
    }
  }

  // Create maps for quick lookup
  const imageUrlMap = new Map(uploadedImages.map(img => [img.playId, img.imageUrl]));
  const blankPageImageUrlMap = new Map(uploadedBlankPageImages.map(img => [img.pageId, img.imageUrl]));

  // Calculate image dimensions based on playsPerPage
  // Field aspect ratio is 694:392 ≈ 1.77:1
  // Standard US Letter page: 612 PT x 792 PT with 1" margins = 468 PT x 648 PT usable
  // For 2-column layout: 468 / 2 = 234 PT per column, minus small gap = ~230 PT
  const imageWidthByLayout: Record<number, number> = {
    1: 468,   // 1 play/page: full usable width
    2: 468,   // 2 plays/page: stacked vertically, full width
    4: 230,   // 4 plays/page: 2x2 grid (half page width minus small gap)
    8: 230    // 8 plays/page: 2x4 grid
  };
  const imageWidth = imageWidthByLayout[playsPerPage] || 468;
  const defaultImageHeight = Math.round(imageWidth * (392 / 694)); // Default to field aspect ratio

  // For 4 or 8 plays per page, use table-based 2x2 Tecmo Bowl grid layout
  if (playsPerPage === 4 || playsPerPage === 8) {
    const playsPerTablePage = playsPerPage;
    
    // For grid layouts, we need to handle blank pages separately
    // We'll iterate through items and insert section dividers as full pages
    // Plays will be grouped into grids
    let currentPlaysBuffer: PlayInfo[] = [];
    
    // Helper function to render a grid page of plays
    const renderGridPage = async (pagePlays: PlayInfo[]) => {
      if (pagePlays.length === 0) return;
      
      // Insert a 2-column table with appropriate rows
      const tableRows = Math.ceil(pagePlays.length / 2);
      
      requests.push({
        insertTable: {
          location: { index: currentIndex },
          rows: tableRows,
          columns: 2
        }
      });
      
      // Execute current requests to get the table structure
      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests }
        });
        requests.length = 0;
      }
      
      // Get the updated document to find table cell indices
      const docContent = await docs.documents.get({ documentId: docId });
      const body = docContent.data.body?.content || [];
      
      // Find the last table in the document
      let lastTable: any = null;
      let lastTableStartIndex: number | undefined;
      for (const element of body) {
        if (element.table) {
          lastTable = element;
          lastTableStartIndex = element.startIndex ?? undefined;
        }
      }
      
      if (lastTable && lastTable.table) {
        const tableElement = lastTable.table;
        const numRows = tableElement.tableRows?.length || 0;
        const numCols = 2;
        
        // Remove table borders
        const zeroBorder = {
          color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } },
          width: { magnitude: 0, unit: 'PT' },
          dashStyle: 'SOLID'
        };
        
        const borderRemovalRequests: any[] = [];
        
        for (let row = 0; row < numRows; row++) {
          for (let col = 0; col < numCols; col++) {
            borderRemovalRequests.push({
              updateTableCellStyle: {
                tableRange: {
                  tableCellLocation: {
                    tableStartLocation: { index: lastTableStartIndex },
                    rowIndex: row,
                    columnIndex: col
                  },
                  rowSpan: 1,
                  columnSpan: 1
                },
                tableCellStyle: {
                  borderTop: zeroBorder,
                  borderBottom: zeroBorder,
                  borderLeft: zeroBorder,
                  borderRight: zeroBorder,
                  paddingTop: { magnitude: 2, unit: 'PT' },
                  paddingBottom: { magnitude: 2, unit: 'PT' },
                  paddingLeft: { magnitude: 2, unit: 'PT' },
                  paddingRight: { magnitude: 2, unit: 'PT' }
                },
                fields: 'borderTop,borderBottom,borderLeft,borderRight,paddingTop,paddingBottom,paddingLeft,paddingRight'
              }
            });
          }
        }
        
        if (borderRemovalRequests.length > 0) {
          await docs.documents.batchUpdate({
            documentId: docId,
            requestBody: { requests: borderRemovalRequests }
          });
        }
        
        // Re-fetch document after border styling
        const docAfterBorders = await docs.documents.get({ documentId: docId });
        const bodyAfterBorders = docAfterBorders.data.body?.content || [];
        
        let tableForImages: any = null;
        for (const element of bodyAfterBorders) {
          if (element.table) {
            tableForImages = element;
          }
        }
        
        if (tableForImages) {
          // Insert images in reverse order
          for (let playIdx = pagePlays.length - 1; playIdx >= 0; playIdx--) {
            const play = pagePlays[playIdx];
            const rowIdx = Math.floor(playIdx / 2);
            const colIdx = playIdx % 2;
            
            const imageUrl = imageUrlMap.get(play.id);
            if (!imageUrl) continue;
            
            const tableRow = tableForImages.table.tableRows?.[rowIdx];
            const tableCell = tableRow?.tableCells?.[colIdx];
            const cellContent = tableCell?.content?.[0];
            
            if (cellContent?.paragraph) {
              const cellStartIndex = cellContent.startIndex;
              
              const imageHeight = play.imageWidth && play.imageHeight
                ? Math.round(imageWidth * (play.imageHeight / play.imageWidth))
                : defaultImageHeight;
              
              await docs.documents.batchUpdate({
                documentId: docId,
                requestBody: { 
                  requests: [{
                    insertInlineImage: {
                      location: { index: cellStartIndex },
                      uri: imageUrl,
                      objectSize: {
                        width: { magnitude: imageWidth, unit: 'PT' },
                        height: { magnitude: imageHeight, unit: 'PT' }
                      }
                    }
                  }]
                }
              });
            }
          }
        }
      }
      
      // Update currentIndex
      const docAfterGrid = await docs.documents.get({ documentId: docId });
      const bodyAfterGrid = docAfterGrid.data.body?.content || [];
      const lastElement = bodyAfterGrid[bodyAfterGrid.length - 1];
      currentIndex = (lastElement?.endIndex || 2) - 1;
    };
    
    // Helper to insert a full-page image (for roster/splits pages)
    const insertFullPageImage = async (imageUrl: string, title: string) => {
      requests.push({
        insertPageBreak: {
          location: { index: currentIndex }
        }
      });
      currentIndex += 1;
      
      // Add title at top
      const pageTitle = `${title}\n`;
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: pageTitle
        }
      });
      
      const titleEnd = currentIndex + pageTitle.length - 1;
      
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: currentIndex, endIndex: currentIndex + pageTitle.length },
          paragraphStyle: {
            alignment: 'CENTER',
            spaceAbove: { magnitude: 18, unit: 'PT' }
          },
          fields: 'alignment,spaceAbove'
        }
      });
      
      requests.push({
        updateTextStyle: {
          range: { startIndex: currentIndex, endIndex: titleEnd },
          textStyle: {
            fontSize: { magnitude: 24, unit: 'PT' },
            bold: true
          },
          fields: 'fontSize,bold'
        }
      });
      currentIndex += pageTitle.length;
      
      // Execute title requests
      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests }
        });
        requests.length = 0;
      }
      
      // Insert the full-page image
      // US Letter: 612 x 792 PT, with 1" margins = 540 x 648 usable
      // Leave room for title, use most of the page width
      const imageWidth = 468; // ~6.5 inches to fit within margins
      
      requests.push({
        insertInlineImage: {
          location: { index: currentIndex },
          uri: imageUrl,
          objectSize: {
            width: { magnitude: imageWidth, unit: 'PT' }
          }
        }
      });
      currentIndex += 1;
      
      // Center the image
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: currentIndex - 1, endIndex: currentIndex },
          paragraphStyle: {
            alignment: 'CENTER'
          },
          fields: 'alignment'
        }
      });
      
      // Execute image insertion
      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests }
        });
        requests.length = 0;
      }
      
      // Add page break after full-page image (like section dividers do)
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: '\n'
        }
      });
      requests.push({
        insertPageBreak: {
          location: { index: currentIndex + 1 }
        }
      });
      
      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests }
        });
        requests.length = 0;
      }
      
      // Update currentIndex
      const docAfterImage = await docs.documents.get({ documentId: docId });
      const bodyAfterImage = docAfterImage.data.body?.content || [];
      const lastElement = bodyAfterImage[bodyAfterImage.length - 1];
      currentIndex = (lastElement?.endIndex || 2) - 1;
    };
    
    // Helper to insert a section divider
    const insertSectionDivider = async (title: string, notes?: string | null) => {
      requests.push({
        insertPageBreak: {
          location: { index: currentIndex }
        }
      });
      currentIndex += 1;
      
      const dividerTitle = `${title}\n`;
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: dividerTitle
        }
      });
      
      const titleEnd = currentIndex + dividerTitle.length - 1;
      
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: currentIndex, endIndex: currentIndex + dividerTitle.length },
          paragraphStyle: {
            alignment: 'CENTER',
            spaceAbove: { magnitude: 180, unit: 'PT' }
          },
          fields: 'alignment,spaceAbove'
        }
      });
      
      requests.push({
        updateTextStyle: {
          range: { startIndex: currentIndex, endIndex: titleEnd },
          textStyle: {
            fontSize: { magnitude: 36, unit: 'PT' },
            bold: true
          },
          fields: 'fontSize,bold'
        }
      });
      currentIndex += dividerTitle.length;
      
      if (notes) {
        const notesText = `${notes}\n`;
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: notesText
          }
        });
        
        const notesEnd = currentIndex + notesText.length - 1;
        
        requests.push({
          updateParagraphStyle: {
            range: { startIndex: currentIndex, endIndex: currentIndex + notesText.length },
            paragraphStyle: { alignment: 'CENTER' },
            fields: 'alignment'
          }
        });
        
        requests.push({
          updateTextStyle: {
            range: { startIndex: currentIndex, endIndex: notesEnd },
            textStyle: { fontSize: { magnitude: 18, unit: 'PT' } },
            fields: 'fontSize'
          }
        });
        currentIndex += notesText.length;
      }
      
      // Execute the section divider requests
      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests }
        });
        requests.length = 0;
      }
      
      // Add page break after divider
      requests.push({
        insertPageBreak: {
          location: { index: currentIndex }
        }
      });
      currentIndex += 1;
      
      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests }
        });
        requests.length = 0;
      }
      
      // Update currentIndex
      const docAfterDivider = await docs.documents.get({ documentId: docId });
      const bodyAfterDivider = docAfterDivider.data.body?.content || [];
      const lastElement = bodyAfterDivider[bodyAfterDivider.length - 1];
      currentIndex = (lastElement?.endIndex || 2) - 1;
    };
    
    // Process all items
    for (let i = 0; i < plays.length; i++) {
      const item = plays[i];
      
      if (item.itemType === 'blankPage') {
        // Flush any buffered plays first
        if (currentPlaysBuffer.length > 0) {
          await renderGridPage(currentPlaysBuffer);
          currentPlaysBuffer = [];
        }
        
        // Check if this is a fullPage item with an image (roster/splits)
        const blankPageImageUrl = blankPageImageUrlMap.get(item.id);
        if (item.fullPage && blankPageImageUrl) {
          // Insert as full-page image
          await insertFullPageImage(blankPageImageUrl, item.name);
        } else {
          // Insert as section divider (text-only)
          await insertSectionDivider(item.name, item.notes);
        }
      } else {
        // Add to buffer
        currentPlaysBuffer.push(item);
        
        // If buffer is full, render the grid page
        if (currentPlaysBuffer.length >= playsPerTablePage) {
          await renderGridPage(currentPlaysBuffer);
          currentPlaysBuffer = [];
          
          // Add page break if not at the end
          if (i < plays.length - 1) {
            requests.push({
              insertText: {
                location: { index: currentIndex },
                text: '\n'
              }
            });
            requests.push({
              insertPageBreak: {
                location: { index: currentIndex + 1 }
              }
            });
            
            if (requests.length > 0) {
              await docs.documents.batchUpdate({
                documentId: docId,
                requestBody: { requests }
              });
              requests.length = 0;
            }
            
            const docAfterBreak = await docs.documents.get({ documentId: docId });
            const bodyAfterBreak = docAfterBreak.data.body?.content || [];
            const lastElementAfterBreak = bodyAfterBreak[bodyAfterBreak.length - 1];
            currentIndex = (lastElementAfterBreak?.endIndex || 2) - 1;
          }
        }
      }
    }
    
    // Render any remaining plays
    if (currentPlaysBuffer.length > 0) {
      await renderGridPage(currentPlaysBuffer);
    }
    
  } else {
    // For 1 or 2 plays per page, use simple vertical stacking (original behavior)
    let playsOnCurrentPage = 0;
    
    for (let i = 0; i < plays.length; i++) {
      const play = plays[i];
      
      // Handle blank pages (section dividers or fullPage images)
      if (play.itemType === 'blankPage') {
        // If there's content on the current page, add a page break first
        if (playsOnCurrentPage > 0 || i > 0) {
          requests.push({
            insertPageBreak: {
              location: { index: currentIndex }
            }
          });
          currentIndex += 1;
        }
        
        // Check if this is a fullPage item with an image (roster/splits)
        const blankPageImageUrl = blankPageImageUrlMap.get(play.id);
        if (play.fullPage && blankPageImageUrl) {
          // Insert title for fullPage image
          const pageTitle = `${play.name}\n`;
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: pageTitle
            }
          });
          
          const titleEnd = currentIndex + pageTitle.length - 1;
          
          requests.push({
            updateParagraphStyle: {
              range: { startIndex: currentIndex, endIndex: currentIndex + pageTitle.length },
              paragraphStyle: {
                alignment: 'CENTER',
                spaceAbove: { magnitude: 18, unit: 'PT' }
              },
              fields: 'alignment,spaceAbove'
            }
          });
          
          requests.push({
            updateTextStyle: {
              range: { startIndex: currentIndex, endIndex: titleEnd },
              textStyle: {
                fontSize: { magnitude: 24, unit: 'PT' },
                bold: true
              },
              fields: 'fontSize,bold'
            }
          });
          currentIndex += pageTitle.length;
          
          // Insert the full-page image
          const fullPageImageWidth = 468; // Full usable width
          requests.push({
            insertInlineImage: {
              location: { index: currentIndex },
              uri: blankPageImageUrl,
              objectSize: {
                width: { magnitude: fullPageImageWidth, unit: 'PT' }
              }
            }
          });
          currentIndex += 1;
          
          // Center the image
          requests.push({
            updateParagraphStyle: {
              range: { startIndex: currentIndex - 1, endIndex: currentIndex },
              paragraphStyle: {
                alignment: 'CENTER'
              },
              fields: 'alignment'
            }
          });
        } else {
          // Regular section divider (text-only)
          const dividerTitle = `${play.name}\n`;
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: dividerTitle
            }
          });
          
          const titleEnd = currentIndex + dividerTitle.length - 1;
          
          // Center and style the title
          requests.push({
            updateParagraphStyle: {
              range: { startIndex: currentIndex, endIndex: currentIndex + dividerTitle.length },
              paragraphStyle: {
                alignment: 'CENTER',
                spaceAbove: { magnitude: 180, unit: 'PT' } // Push down to center vertically
              },
              fields: 'alignment,spaceAbove'
            }
          });
          
          requests.push({
            updateTextStyle: {
              range: { startIndex: currentIndex, endIndex: titleEnd },
              textStyle: {
                fontSize: { magnitude: 36, unit: 'PT' },
                bold: true
              },
              fields: 'fontSize,bold'
            }
          });
          currentIndex += dividerTitle.length;
          
          // Add notes if present
          if (play.notes) {
            const notesText = `${play.notes}\n`;
            requests.push({
              insertText: {
                location: { index: currentIndex },
                text: notesText
              }
            });
            
            const notesEnd = currentIndex + notesText.length - 1;
            
            requests.push({
              updateParagraphStyle: {
                range: { startIndex: currentIndex, endIndex: currentIndex + notesText.length },
                paragraphStyle: {
                  alignment: 'CENTER'
                },
                fields: 'alignment'
              }
            });
            
            requests.push({
              updateTextStyle: {
                range: { startIndex: currentIndex, endIndex: notesEnd },
                textStyle: {
                  fontSize: { magnitude: 18, unit: 'PT' }
                },
                fields: 'fontSize'
              }
            });
            currentIndex += notesText.length;
          }
        }
        
        // Reset plays counter for new section
        playsOnCurrentPage = 0;
        
        // Add page break after section divider (if not last item)
        if (i < plays.length - 1) {
          requests.push({
            insertPageBreak: {
              location: { index: currentIndex }
            }
          });
          currentIndex += 1;
        }
        continue;
      }
      
      // Handle regular plays
      const imageUrl = imageUrlMap.get(play.id);
      
      if (imageUrl) {
        const imageHeight = play.imageWidth && play.imageHeight
          ? Math.round(imageWidth * (play.imageHeight / play.imageWidth))
          : defaultImageHeight;
        
        requests.push({
          insertInlineImage: {
            location: { index: currentIndex },
            uri: imageUrl,
            objectSize: {
              width: { magnitude: imageWidth, unit: 'PT' },
              height: { magnitude: imageHeight, unit: 'PT' }
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
      
      playsOnCurrentPage++;

      // Page break based on playsPerPage setting (except for the last one)
      if (playsOnCurrentPage % playsPerPage === 0 && i < plays.length - 1) {
        requests.push({
          insertPageBreak: {
            location: { index: currentIndex }
          }
        });
        currentIndex += 1;
        playsOnCurrentPage = 0;
      }
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
// playsPerSlide: 1 (full slide), 2 (stacked), or 4 (2x2 grid)
export async function generateTeamSlides(
  tokens: GoogleDriveTokens,
  team: TeamInfo,
  plays: PlayInfo[],
  updateTokensCallback?: (newTokens: GoogleDriveTokens) => Promise<void>,
  documentTitle?: string,
  playsPerSlide: number = 1
): Promise<{ slidesUrl: string; presentationId: string }> {
  const drive = await getGoogleDriveClientForUser(tokens, updateTokensCallback);
  const slides = await getGoogleSlidesClientForUser(tokens, updateTokensCallback);

  // Use custom document title or default
  const slidesTitle = documentTitle || `${team.name} Playbook - ${team.year || new Date().getFullYear()}`;

  // Create a new Google Slides presentation
  const presentation = await slides.presentations.create({
    requestBody: {
      title: slidesTitle
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
      const playCount = plays.filter(p => p.itemType !== 'blankPage').length;
      requests.push({
        insertText: {
          objectId: subtitleShape.objectId,
          text: `${team.year || new Date().getFullYear()} Season\n${playCount} Plays`
        }
      });
    }
  }

  // Google Slides default size is 720pt x 405pt (16:9)
  const slideWidth = 720;
  const slideHeight = 405;
  const margin = 10;

  // Calculate layout based on playsPerSlide
  // 1 play: Full slide with title
  // 2 plays: Stacked vertically (2 rows, 1 column)
  // 4 plays: 2x2 grid
  const layoutConfig = {
    1: { cols: 1, rows: 1 },
    2: { cols: 1, rows: 2 },
    4: { cols: 2, rows: 2 }
  };
  const layout = layoutConfig[playsPerSlide as 1 | 2 | 4] || layoutConfig[1];

  // Upload all images first to avoid interleaving API calls
  // Also upload fullPage blank page images (roster/splits)
  const imageUrls: Record<number, string> = {};
  const blankPageImageUrls: Record<number, string> = {};
  
  for (const play of plays) {
    if (play.itemType === 'blankPage') {
      // Handle fullPage blank pages with images
      if (play.fullPage && play.imageBase64) {
        console.log(`Uploading image for ${play.pageType || 'blank'} page ${play.id}: ${play.name}`);
        const imageBuffer = Buffer.from(play.imageBase64, 'base64');
        const imageFile = await drive.files.create({
          requestBody: {
            name: `slide_page_${play.id}_${play.pageType || 'page'}_image.png`,
            mimeType: 'image/png'
          },
          media: {
            mimeType: 'image/png',
            body: Readable.from(imageBuffer)
          },
          fields: 'id'
        });

        await drive.permissions.create({
          fileId: imageFile.data.id!,
          requestBody: {
            role: 'reader',
            type: 'anyone'
          }
        });

        blankPageImageUrls[play.id] = `https://drive.google.com/uc?id=${imageFile.data.id}`;
      }
      continue;
    }
    
    // Regular play images
    if (play.imageBase64) {
      console.log(`Uploading image for play ${play.id}: ${play.name}`);
      const imageBuffer = Buffer.from(play.imageBase64, 'base64');
      const imageFile = await drive.files.create({
        requestBody: {
          name: `slide_play_${play.id}_image.png`,
          mimeType: 'image/png'
        },
        media: {
          mimeType: 'image/png',
          body: Readable.from(imageBuffer)
        },
        fields: 'id'
      });

      await drive.permissions.create({
        fileId: imageFile.data.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      imageUrls[play.id] = `https://drive.google.com/uc?id=${imageFile.data.id}`;
    }
  }

  // Group plays into slides, handling blank pages as section dividers
  // Blank pages get their own slide, plays are grouped by playsPerSlide
  const slideItems: { type: 'plays' | 'divider'; plays?: PlayInfo[]; divider?: PlayInfo }[] = [];
  let currentPlayBuffer: PlayInfo[] = [];
  
  for (const item of plays) {
    if (item.itemType === 'blankPage') {
      // Flush any buffered plays first
      if (currentPlayBuffer.length > 0) {
        slideItems.push({ type: 'plays', plays: currentPlayBuffer });
        currentPlayBuffer = [];
      }
      // Add section divider
      slideItems.push({ type: 'divider', divider: item });
    } else {
      currentPlayBuffer.push(item);
      if (currentPlayBuffer.length >= playsPerSlide) {
        slideItems.push({ type: 'plays', plays: currentPlayBuffer });
        currentPlayBuffer = [];
      }
    }
  }
  
  // Flush remaining plays
  if (currentPlayBuffer.length > 0) {
    slideItems.push({ type: 'plays', plays: currentPlayBuffer });
  }

  // Create slides for each item
  for (let slideIndex = 0; slideIndex < slideItems.length; slideIndex++) {
    const slideItem = slideItems[slideIndex];
    const slideId = `play_slide_${slideIndex}`;

    // Create new slide
    requests.push({
      createSlide: {
        objectId: slideId,
        insertionIndex: slideIndex + 1,
        slideLayoutReference: {
          predefinedLayout: 'BLANK'
        }
      }
    });
    
    // Handle section divider slides
    if (slideItem.type === 'divider' && slideItem.divider) {
      const divider = slideItem.divider;
      
      // Check if this is a fullPage item with an image (roster/splits)
      const fullPageImageUrl = blankPageImageUrls[divider.id];
      if (divider.fullPage && fullPageImageUrl) {
        // Insert as image slide with title
        const titleShapeId = `divider_title_${slideIndex}`;
        const imageShapeId = `divider_image_${slideIndex}`;
        
        // Add title at top
        requests.push({
          createShape: {
            objectId: titleShapeId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
              pageObjectId: slideId,
              size: {
                width: { magnitude: slideWidth - margin * 2, unit: 'PT' },
                height: { magnitude: 30, unit: 'PT' }
              },
              transform: {
                scaleX: 1,
                scaleY: 1,
                translateX: margin,
                translateY: 5,
                unit: 'PT'
              }
            }
          }
        });
        
        requests.push({
          insertText: {
            objectId: titleShapeId,
            text: divider.name
          }
        });
        
        requests.push({
          updateTextStyle: {
            objectId: titleShapeId,
            textRange: { type: 'ALL' },
            style: {
              fontSize: { magnitude: 20, unit: 'PT' },
              bold: true
            },
            fields: 'fontSize,bold'
          }
        });
        
        requests.push({
          updateParagraphStyle: {
            objectId: titleShapeId,
            textRange: { type: 'ALL' },
            style: {
              alignment: 'CENTER'
            },
            fields: 'alignment'
          }
        });
        
        // Add full-page image
        // Calculate image size to fit the slide (below title)
        const imageTop = 40; // Below title
        const imageMaxWidth = slideWidth - margin * 2;
        const imageMaxHeight = slideHeight - imageTop - margin;
        
        requests.push({
          createImage: {
            objectId: imageShapeId,
            url: fullPageImageUrl,
            elementProperties: {
              pageObjectId: slideId,
              size: {
                width: { magnitude: imageMaxWidth, unit: 'PT' },
                height: { magnitude: imageMaxHeight, unit: 'PT' }
              },
              transform: {
                scaleX: 1,
                scaleY: 1,
                translateX: margin,
                translateY: imageTop,
                unit: 'PT'
              }
            }
          }
        });
      } else {
        // Regular section divider (text only)
        const titleShapeId = `divider_title_${slideIndex}`;
        
        // Add centered section title
        requests.push({
          createShape: {
            objectId: titleShapeId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
              pageObjectId: slideId,
              size: {
                width: { magnitude: slideWidth - margin * 2, unit: 'PT' },
                height: { magnitude: 60, unit: 'PT' }
              },
              transform: {
                scaleX: 1,
                scaleY: 1,
                translateX: margin,
                translateY: slideHeight / 2 - 50,
                unit: 'PT'
              }
            }
          }
        });
        
        requests.push({
          insertText: {
            objectId: titleShapeId,
            text: divider.name
          }
        });
        
        requests.push({
          updateTextStyle: {
            objectId: titleShapeId,
            textRange: { type: 'ALL' },
            style: {
              fontSize: { magnitude: 48, unit: 'PT' },
              bold: true
            },
            fields: 'fontSize,bold'
          }
        });
        
        requests.push({
          updateParagraphStyle: {
            objectId: titleShapeId,
            textRange: { type: 'ALL' },
            style: {
              alignment: 'CENTER'
            },
            fields: 'alignment'
          }
        });
        
        // Add notes if present
        if (divider.notes) {
          const notesShapeId = `divider_notes_${slideIndex}`;
          
          requests.push({
            createShape: {
              objectId: notesShapeId,
              shapeType: 'TEXT_BOX',
              elementProperties: {
                pageObjectId: slideId,
                size: {
                  width: { magnitude: slideWidth - margin * 2, unit: 'PT' },
                  height: { magnitude: 40, unit: 'PT' }
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: margin,
                  translateY: slideHeight / 2 + 20,
                  unit: 'PT'
                }
              }
            }
          });
          
          requests.push({
            insertText: {
              objectId: notesShapeId,
              text: divider.notes
            }
          });
          
          requests.push({
            updateTextStyle: {
              objectId: notesShapeId,
              textRange: { type: 'ALL' },
              style: {
                fontSize: { magnitude: 24, unit: 'PT' }
              },
              fields: 'fontSize'
            }
          });
          
          requests.push({
            updateParagraphStyle: {
              objectId: notesShapeId,
              textRange: { type: 'ALL' },
              style: {
                alignment: 'CENTER'
              },
              fields: 'alignment'
            }
          });
        }
      }
      
      continue;
    }
    
    // Handle regular plays slide
    const group = slideItem.plays || [];

    // Calculate cell dimensions
    const cellWidth = (slideWidth - margin * (layout.cols + 1)) / layout.cols;
    const cellHeight = (slideHeight - margin * (layout.rows + 1)) / layout.rows;
    const titleHeight = playsPerSlide === 1 ? 40 : 24;
    const titleFontSize = playsPerSlide === 1 ? 20 : 12;

    // Add each play to its position in the grid
    for (let playIndex = 0; playIndex < group.length; playIndex++) {
      const play = group[playIndex];
      const col = playIndex % layout.cols;
      const row = Math.floor(playIndex / layout.cols);
      
      const cellX = margin + col * (cellWidth + margin);
      const cellY = margin + row * (cellHeight + margin);

      const titleShapeId = `play_title_${slideIndex}_${playIndex}`;
      const imageShapeId = `play_image_${slideIndex}_${playIndex}`;

      // Add play title
      requests.push({
        createShape: {
          objectId: titleShapeId,
          shapeType: 'TEXT_BOX',
          elementProperties: {
            pageObjectId: slideId,
            size: {
              width: { magnitude: cellWidth, unit: 'PT' },
              height: { magnitude: titleHeight, unit: 'PT' }
            },
            transform: {
              scaleX: 1,
              scaleY: 1,
              translateX: cellX,
              translateY: cellY,
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
            fontSize: { magnitude: titleFontSize, unit: 'PT' },
            bold: true
          },
          fields: 'fontSize,bold'
        }
      });

      requests.push({
        updateParagraphStyle: {
          objectId: titleShapeId,
          style: {
            alignment: 'CENTER'
          },
          fields: 'alignment'
        }
      });

      // Add play image if available
      const imageUrl = imageUrls[play.id];
      if (imageUrl) {
        const availableImageWidth = cellWidth;
        const availableImageHeight = cellHeight - titleHeight - margin;

        // Calculate scaled dimensions maintaining aspect ratio
        const sourceWidth = play.imageWidth || 694 * 2;
        const sourceHeight = play.imageHeight || 392 * 2;
        const sourceAspect = sourceWidth / sourceHeight;
        const targetAspect = availableImageWidth / availableImageHeight;

        let displayWidth: number;
        let displayHeight: number;

        if (sourceAspect > targetAspect) {
          displayWidth = availableImageWidth;
          displayHeight = availableImageWidth / sourceAspect;
        } else {
          displayHeight = availableImageHeight;
          displayWidth = availableImageHeight * sourceAspect;
        }

        const imageX = cellX + (cellWidth - displayWidth) / 2;
        const imageY = cellY + titleHeight + margin / 2;

        requests.push({
          createImage: {
            objectId: imageShapeId,
            url: imageUrl,
            elementProperties: {
              pageObjectId: slideId,
              size: {
                width: { magnitude: displayWidth, unit: 'PT' },
                height: { magnitude: displayHeight, unit: 'PT' }
              },
              transform: {
                scaleX: 1,
                scaleY: 1,
                translateX: imageX,
                translateY: imageY,
                unit: 'PT'
              }
            }
          }
        });
      }
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
  options: { generateDoc: boolean; generateSlides: boolean; customDocName?: string; playsPerPage?: number; slidesPlaysPerPage?: number },
  updateTokensCallback?: (newTokens: GoogleDriveTokens) => Promise<void>
): Promise<ExportResult> {
  const result: ExportResult = { errors: [] };

  // Use custom document name for the file title, but keep team name for content
  const documentTitle = options.customDocName || `${team.name} Playbook - ${team.year || new Date().getFullYear()}`;
  console.log('Starting Google Drive export with title:', documentTitle);

  const playsPerPage = options.playsPerPage || 2;
  const slidesPlaysPerPage = options.slidesPlaysPerPage || 1;
  
  try {
    if (options.generateDoc) {
      console.log('Generating Google Doc...');
      const docResult = await generateTeamDoc(tokens, team, plays, updateTokensCallback, documentTitle, playsPerPage);
      result.docUrl = docResult.docUrl;
      console.log('Google Doc created:', docResult.docUrl);
    }
  } catch (error: any) {
    console.error('Error generating Google Doc:', error);
    result.errors.push(`Failed to generate Google Doc: ${error.message}`);
  }

  try {
    if (options.generateSlides) {
      console.log('Generating Google Slides...');
      const slidesResult = await generateTeamSlides(tokens, team, plays, updateTokensCallback, documentTitle, slidesPlaysPerPage);
      result.slidesUrl = slidesResult.slidesUrl;
      console.log('Google Slides created:', slidesResult.slidesUrl);
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

// Upload a single play image to Google Drive and return the file URL
export async function uploadSinglePlayImage(
  tokens: GoogleDriveTokens,
  imageBase64: string,
  fileName: string,
  updateTokensCallback?: (newTokens: GoogleDriveTokens) => Promise<void>
): Promise<{ fileUrl: string; fileId: string }> {
  const drive = await getGoogleDriveClientForUser(tokens, updateTokensCallback);
  
  // Convert base64 to buffer
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  
  // Create the file in Google Drive
  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: 'image/png'
    },
    media: {
      mimeType: 'image/png',
      body: Readable.from(imageBuffer)
    },
    fields: 'id, webViewLink'
  });
  
  const fileId = file.data.id!;
  const fileUrl = file.data.webViewLink!;
  
  return { fileUrl, fileId };
}
