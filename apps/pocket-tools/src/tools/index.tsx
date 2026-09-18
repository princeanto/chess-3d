'use client';

/**
 * Every tool's component, each in its own chunk. Opening Split Bill loads Split
 * Bill, not the PDF engine; the service worker still caches them all for
 * offline use.
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

export const TOOL_COMPONENTS: Record<string, ComponentType> = {
  'merge-pdf': dynamic(() => import('./pdf/MergePdf')),
  'split-pdf': dynamic(() => import('./pdf/SplitPdf')),
  'extract-pages': dynamic(() => import('./pdf/ExtractPages')),
  'remove-pages': dynamic(() => import('./pdf/RemovePages')),
  'organize-pdf': dynamic(() => import('./pdf/OrganizePdf')),
  'rotate-pdf': dynamic(() => import('./pdf/RotatePdf')),
  'compress-pdf': dynamic(() => import('./pdf/CompressPdf')),
  'repair-pdf': dynamic(() => import('./pdf/RepairPdf')),
  'pdf-to-jpg': dynamic(() => import('./pdf/PdfToJpg')),
  'jpg-to-pdf': dynamic(() => import('./pdf/JpgToPdf')),
  'pdf-to-text': dynamic(() => import('./pdf/PdfToText')),
  'page-numbers': dynamic(() => import('./pdf/PageNumbers')),
  'watermark-pdf': dynamic(() => import('./pdf/WatermarkPdf')),
  'sign-pdf': dynamic(() => import('./pdf/SignPdf')),
  'crop-pdf': dynamic(() => import('./pdf/CropPdf')),
  'protect-pdf': dynamic(() => import('./pdf/ProtectPdf')),
  'unlock-pdf': dynamic(() => import('./pdf/UnlockPdf')),

  'image-compressor': dynamic(() => import('./image/ImageCompressor')),
  'image-resizer': dynamic(() => import('./image/ImageResizer')),
  'image-converter': dynamic(() => import('./image/ImageConverter')),
  'image-cropper': dynamic(() => import('./image/ImageCropper')),

  percentage: dynamic(() => import('./calculate/Percentage')),
  discount: dynamic(() => import('./calculate/Discount')),
  'split-bill': dynamic(() => import('./calculate/SplitBill')),
  tip: dynamic(() => import('./calculate/Tip')),
  gst: dynamic(() => import('./calculate/Gst')),
  emi: dynamic(() => import('./calculate/Emi')),
  age: dynamic(() => import('./calculate/Age')),

  'unit-converter': dynamic(() => import('./measure/UnitConverter')),
  'data-size': dynamic(() => import('./measure/DataSize')),
  'aspect-ratio': dynamic(() => import('./measure/AspectRatio')),
  'golden-ratio': dynamic(() => import('./measure/GoldenRatio')),
  'grid-calculator': dynamic(() => import('./measure/GridCalculator')),
  'pixel-density': dynamic(() => import('./measure/PixelDensity')),

  receipt: dynamic(() => import('./document/Receipt')),
  invoice: dynamic(() => import('./document/Invoice')),
  'image-sheet': dynamic(() => import('./document/ImageSheet')),

  'qr-code': dynamic(() => import('./quick/QrCode')),
  password: dynamic(() => import('./quick/Password')),
  'random-number': dynamic(() => import('./quick/RandomNumber')),
  'random-picker': dynamic(() => import('./quick/RandomPicker')),
  dice: dynamic(() => import('./quick/Dice')),
  'coin-flip': dynamic(() => import('./quick/CoinFlip')),
  uuid: dynamic(() => import('./quick/Uuid')),
  'lorem-ipsum': dynamic(() => import('./quick/Lorem')),
};
