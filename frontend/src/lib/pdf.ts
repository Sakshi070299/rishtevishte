// ═══════════════════════════════════════════════════════
// FEATURE 2 & 3 (Frontend): Biodata PDF + Print Card
// Opens backend-generated HTML in new tab for browser Print/Save as PDF
// ═══════════════════════════════════════════════════════

import { getToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/**
 * Download Biodata as printable HTML (user can Ctrl+P to save as PDF)
 */
export async function downloadBiodata(profileId: string) {
  const token = getToken();
  const url = `${API_URL}/pdf/biodata/${profileId}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to generate biodata');

    const html = await response.text();

    // Open in new tab with print-ready HTML
    const newTab = window.open('', '_blank');
    if (newTab) {
      newTab.document.write(html);
      newTab.document.close();
      // Auto-trigger print dialog after content loads
      newTab.onload = () => {
        setTimeout(() => newTab.print(), 500);
      };
    }
  } catch (error) {
    console.error('Biodata download failed:', error);
    alert('Failed to generate biodata. Please try again.');
  }
}

/**
 * Print compact marriage card
 */
export async function printCard(profileId: string) {
  const token = getToken();
  const url = `${API_URL}/pdf/card/${profileId}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to generate card');

    const html = await response.text();

    const newTab = window.open('', '_blank');
    if (newTab) {
      newTab.document.write(html);
      newTab.document.close();
      newTab.onload = () => {
        setTimeout(() => newTab.print(), 500);
      };
    }
  } catch (error) {
    console.error('Print card failed:', error);
    alert('Failed to generate card. Please try again.');
  }
}

/**
 * Upload photo to backend (Feature 5 frontend)
 */
export async function uploadPhoto(file: File): Promise<string> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/upload/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Upload failed');
  }

  const data = await response.json();
  return data.url;
}
